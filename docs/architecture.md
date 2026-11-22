# Arquitetura

O backend do LucroAI é um **monolito modular**: uma aplicação NestJS, um processo e um banco Postgres. Ele substitui os 5 microsserviços com RabbitMQ do [`GrupoDoisENG/lucroai-backend`](https://github.com/GrupoDoisENG/lucroai-backend). O código fica dividido em **módulos de domínio** em `src/modules/<modulo>/`, que conversam só pelos services que exportam, dentro do mesmo processo e, quando preciso, da mesma transação.

O padrão vem da Urbizzi, **simplificado** porque o LucroAI é quase todo CRUD com cálculos:

| Urbizzi | LucroAI | Por quê |
| --- | --- | --- |
| Entidade de classe para toda tabela | **Funções puras** em `domain/<modulo>.calculos.ts`; entidade de classe só na `Venda` (status com transições) | A regra está nas fórmulas |
| Interface de repositório + token `Symbol` + implementação Prisma | **Repositório concreto** (`infra/repositories/<entidade>.repository.ts`), injetado pela classe | Só existe uma implementação, e os testes cobrem funções puras |
| Registro → entidade → DTO | Registro do Prisma → DTO de saída com `to<Entidade>Dto` | Um mapeamento a menos |
| `OVERVIEW.md` por módulo | Regras em [business-rules.md](business-rules.md) e rotas em [api.md](api.md) | Um lugar só para cada informação |
| Envelope, paginação, `/v1` | JSON puro, sem paginação e sem versão | Contrato do frontend |

## Estrutura de pastas

```
src/
├── main.ts                  # bootstrap (lê PORT e chama setupApp)
├── app.module.ts            # ConfigModule, PrismaModule, JwtAuthModule, HealthModule e os módulos de domínio
├── app.setup.ts             # ValidationPipe, AllExceptionsFilter e Swagger (sem CORS, sem versão, sem envelope)
├── config/env.validation.ts # schema Zod das variáveis de ambiente
├── generated/prisma/        # Prisma Client gerado (não editar, não versionado)
├── modules/<modulo>/        # módulos de domínio (ver mapa abaixo)
└── shared/                  # código transversal, sem regra de nenhum módulo
    ├── domain/              # erros de domínio, arredondamento
    └── infra/               # database (Prisma, TransactionManager), health, http (filtro e validação), auth (JwtAuthModule, guard e decorators)
test/                        # e2e: fumaça (health) e contrato com o frontend
prisma/                      # schema.prisma, migrations e seed
docs/                        # esta documentação
```

`src/shared/` nunca importa de `src/modules/`. O que já existe lá está na tabela do [AGENTS.md](../AGENTS.md#o-que-já-existe-em-srcshared).

## Mapa de módulos

Cada tabela pertence a **um** módulo, e só ele lê e escreve nela pelo Prisma.

| Módulo | Tabelas (models) | Responsabilidade | Depende de | Issues |
| --- | --- | --- | --- | --- |
| `auth` | `Empresa`, `Usuario` | cadastro de empresa (com a configuração de custos e os canais de venda padrão na mesma transação), login e JWT (assinado com o `JwtService` do `JwtAuthModule`); não exporta service | `configuracao-custos`, `canais` | BE-06, BE-24, BE-25 |
| `estoque` | `Estoque`, `MovimentacaoEstoque`, `EstoqueProdutoAcabado`, `MovimentacaoProdutoAcabado` | saldo e histórico de insumos e de produto acabado; exporta `EstoqueService` (`criarRegistroInicial` e `saldosPorInsumo` desde a BE-07; `baixarPorProducao(itens, lotes, producaoId, empresaId, tx)` desde a BE-11; `registrarEntradaPorCompra(insumoId, quantidade, compraId, observacao, empresaId, tx)` desde a BE-29) e `EstoqueProdutoAcabadoService` (`entradaPorProducao(receitaId, totalUnidades, producaoId, empresaId, tx)` e `saidaPorVenda(receitaId, quantidade, vendaId, empresaId, tx)` desde a BE-12) | — | BE-07, BE-11, BE-12 |
| `insumos` | `Insumo`, `CompraInsumo` | cadastro de insumos; compras (`POST`/`GET /insumos/:id/compras`), com entrada no estoque e custo médio móvel (`calcularCustoMedio`), e custo de reposição (`calcularCustoReposicao`, usado pelas receitas); o cadastro cria a compra inicial e o estoque inicial na mesma transação; exporta `InsumoService` (`buscarVariosDaEmpresa` desde a BE-09) | `estoque` | BE-07, BE-29 |
| `configuracao-custos` | `ConfiguracaoCustos` | configuração de custos da empresa (base de rateio, capacidade mensal, lucro, imposto e maquininha), com os padrões e a validação (`validarConfiguracaoCustos`); exporta `ConfiguracaoCustosService` (`criarPadrao(empresaId, tx)` e `buscarDaEmpresa(empresaId, tx?)`) | — | BE-24, BE-26 |
| `canais` | `CanalVenda` | canais de venda com comissão (Balcão, iFood…), CRUD em `/canais`, com os padrões (`CANAIS_PADRAO`), a regra do Balcão (`garantirCanalExcluivel`) e a taxa no preço (`taxaDoCanal`); exporta `CanalVendaService` (`criarPadrao(empresaId, tx)`, `listarAtivosDaEmpresa(empresaId, tx?)` e, desde a BE-30, `buscarParaVenda(canalId?, empresaId)`, com o Balcão como padrão) | — | BE-25, BE-28, BE-30 |
| `gastos-indiretos` | `GastoIndireto` | cadastro de gastos por tipo (`MENSAL`, `POR_UNIDADE`, `PERCENTUAL_VENDA`), validação por tipo (`validarGasto`) e a parte de cada gasto no custo (`calcularGastoNoCusto`); exporta `GastoIndiretoService` (`listarPorEmpresa` e `buscarVariosDaEmpresa`) | — | BE-08, BE-26 |
| `receitas` | `Receita`, `ItemReceita` | receitas com a ficha técnica (`validarFichaTecnica`); custo para 1 ou N lotes, com o custo de reposição dos insumos (BE-29) (`calcularCustoReceita`, com embalagem e perda) e preço por canal ativo (`calcularPrecoNoCanal`) e percentuais sem o lucro (`calcularPercentuaisSemLucro`, BE-30), calculados na leitura e nunca gravados; simulação por canal com lucro real e ponto de equilíbrio do produto (`simularCenario`, `calcularMargemContribuicao`, `calcularPontoEquilibrioProduto`, BE-31) e preço de venda (`calcularPrecoVenda`), sem gravar; exporta `ReceitaService` (`buscarDaEmpresa`, com o custo de 1 lote ao custo médio dos insumos e a base do preço, BE-30) | `insumos`, `gastos-indiretos`, `configuracao-custos`, `canais` | BE-09, BE-10, BE-26, BE-27, BE-28, BE-30, BE-31 |
| `producoes` | `Producao`, `RateioProducao` | produção com o custo dos ingredientes ao custo médio e o rateio dos gastos mensais, uma vez só (`calcularProducao`), baixa de insumos e entrada de produto acabado, numa transação só; não exporta service | `receitas`, `gastos-indiretos`, `estoque`, `configuracao-custos` | BE-12, BE-26, BE-30 |
| `vendas` | `Venda`, `ItemVenda` | vendas por canal com a entidade `Venda` (total, margem, lucro real e transições de status) e conclusão com baixa de produto acabado (`saidaPorVenda`) na mesma transação; resumo do painel com o ponto de equilíbrio da empresa (`GET /vendas/resumo`, `calcularPontoEquilibrioEmpresa` em `vendas.calculos.ts`, BE-31); não exporta service | `receitas`, `estoque`, `canais`, `gastos-indiretos` | BE-13, BE-30, BE-31 |

### Tabelas e donos

Schema em `prisma/schema.prisma`, migration inicial `init` (BE-05). Toda tabela de negócio raiz tem `empresa_id` com FK para `empresa` e índice; as tabelas de itens (`item_receita`, `rateio_producao`, `item_venda`) herdam a empresa do pai.

| Tabela (model) | Módulo dono | Chaves estrangeiras (`ON DELETE`) |
| --- | --- | --- |
| `empresa` (`Empresa`) | `auth` | — |
| `usuario` (`Usuario`) | `auth` | `empresa_id` (`CASCADE`) |
| `configuracao_custos` (`ConfiguracaoCustos`) | `configuracao-custos` | `empresa_id` (único) |
| `canal_venda` (`CanalVenda`) | `canais` | `empresa_id` |
| `insumo` (`Insumo`) | `insumos` | `empresa_id` |
| `compra_insumo` (`CompraInsumo`) | `insumos` | `empresa_id`, `insumo_id` (`CASCADE`) |
| `gasto_indireto` (`GastoIndireto`) | `gastos-indiretos` | `empresa_id` |
| `receita` (`Receita`) | `receitas` | `empresa_id` |
| `item_receita` (`ItemReceita`) | `receitas` | `receita_id` (`CASCADE`), `insumo_id` (`RESTRICT` → 409 `INSUMO_EM_USO`) |
| `estoque` (`Estoque`) | `estoque` | `empresa_id`, `insumo_id` (`CASCADE`, único) |
| `movimentacao_estoque` (`MovimentacaoEstoque`) | `estoque` | `empresa_id`, `insumo_id` (`CASCADE`) |
| `estoque_produto_acabado` (`EstoqueProdutoAcabado`) | `estoque` | `empresa_id`, `receita_id` (`CASCADE`, único) |
| `movimentacao_produto_acabado` (`MovimentacaoProdutoAcabado`) | `estoque` | `empresa_id`, `receita_id` (`CASCADE`) |
| `producao` (`Producao`) | `producoes` | `empresa_id`, `receita_id` (`RESTRICT`) |
| `rateio_producao` (`RateioProducao`) | `producoes` | `producao_id` (`CASCADE`), `gasto_indireto_id` **sem FK** (BE-12: o id fica depois da exclusão do gasto, como nos microsserviços, porque o frontend espera um inteiro; o rateio guarda a `descricao` do gasto) |
| `venda` (`Venda`) | `vendas` | `empresa_id`, `canal_id` (`SET NULL`, BE-30: excluir o canal não apaga as vendas) |
| `item_venda` (`ItemVenda`) | `vendas` | `venda_id` (`CASCADE`), `receita_id` (`RESTRICT`) |

`empresa_id` sem indicação é `RESTRICT` (padrão do Prisma): excluir empresa não é uma funcionalidade. A exclusão de insumo leva junto o saldo, as movimentações de estoque e as compras dele, e a de receita leva o saldo e as movimentações de produto acabado (quando não há produção nem venda, que a bloqueiam).

**Sem ciclos.** Se A depende de B, B não depende de A. O `estoque` não depende de `insumos`: ele confere a empresa pelo `empresa_id` do próprio registro de estoque (BE-05). Ao criar um módulo ou uma dependência, atualize esta tabela no mesmo PR.

A única exceção ao dono da tabela é o seed (`prisma/seed.ts`, BE-14), que grava tudo com o Prisma direto e calcula os custos com as funções de `domain/` dos módulos.

## Estrutura de um módulo

```
src/modules/<modulo>/
├── <modulo>.module.ts
├── domain/
│   ├── <modulo>.calculos.ts         # fórmulas e regras em funções puras
│   └── <modulo>.calculos.spec.ts    # teste unitário das funções
├── application/
│   ├── dto/                         # entrada (create/update/query) e saída (<entidade>.dto.ts com to<Entidade>Dto)
│   └── services/<entidade>.service.ts
└── infra/
    ├── controllers/<recurso>.controller.ts
    ├── repositories/<entidade>.repository.ts
    └── guards/<nome>.guard.ts       # só quando o módulo precisa de guard próprio (ex.: auth/AuthThrottlerGuard)
```

Só o módulo `vendas` tem também `domain/venda.entity.ts` (e o `venda.entity.spec.ts`), ao lado do `vendas.calculos.ts` (BE-31). Módulo com várias tabelas (ex.: `estoque`) tem um repositório e, se fizer sentido, um service por tabela principal, nas mesmas pastas. Não crie submódulos, interfaces de repositório, tokens `Symbol` nem `OVERVIEW.md`.

### Camadas

| Camada | Contém | Pode importar | Não pode |
| --- | --- | --- | --- |
| `domain/` | funções puras (`*.calculos.ts`) e a entidade `Venda` | `src/shared/domain/` e o `domain/*.calculos.ts` de um módulo do qual depende | NestJS, Prisma, DTOs, `application/`, `infra/`, I/O |
| `application/` | services e DTOs | `domain/` do módulo, `src/shared/domain/`, `@nestjs/common`, `class-validator`, `class-transformer`, `@nestjs/swagger` (só `PartialType` e afins nos DTOs), tipos e enums de `src/generated/prisma/`, o repositório do próprio módulo, services exportados por outros módulos, `TransactionManager` | `PrismaService`, `HttpException`, `Request`/`Response` |
| `infra/` | controllers e repositórios | tudo do módulo e de `src/shared/` | regra de negócio |

- **Fórmula ou regra que depende só de valores** → função pura em `domain/<modulo>.calculos.ts`. Ex.: custo unitário, rateio, custo da receita, saldo.
- **Regra que depende do banco** (existe? é da empresa? está em uso?) → service.
- **Controller** → um método por rota, uma chamada ao service, sem `if` de regra.

### Repositório

- Classe concreta `@Injectable()` em `infra/repositories/<entidade>.repository.ts`, a **única** que usa `PrismaService` para as tabelas do módulo. O service a recebe pelo construtor, sem `@Inject` nem token.
- Todo método filtra por `empresaId` quando a tabela tem empresa.
- Métodos que podem participar de transação recebem `tx?: PrismaTransaction` como **último** parâmetro e usam `const db = tx ?? this.prisma`.
- Devolvem o registro do Prisma (ou `null`). O service converte com `to<Entidade>Dto`. Erros conhecidos do Prisma viram erro de domínio aqui (ex.: `P2003` de FK `RESTRICT` → `ConflictError('INSUMO_EM_USO', ...)`).
- Nomes: `findById...`, `list...`, `create`, `update`, `delete`, `exists...`.

### Service

- Um por entidade principal (`GastoIndiretoService`).
- CRUD com nomes em inglês (`list`, `findById`, `create`, `update`, `delete`); ações e métodos para outros módulos em português (`concluir`, `buscarVariosDaEmpresa`, `baixarPorProducao`).
- Recebe DTOs validados e o `empresaId` do token, e devolve DTOs de saída. Nunca devolve o registro do Prisma para o controller. **Exceção (BE-23):** um método para outro módulo cujos valores entram em outra conta devolve o registro, sem o arredondamento do DTO de saída (`InsumoService.buscarVariosDaEmpresa`, `ReceitaService.buscarDaEmpresa`).
- Lança só os erros de `src/shared/domain/errors/domain.error.ts`.
- Abre transação com `TransactionManager.run()` quando grava em mais de uma tabela ou em mais de um módulo.

### DTOs

- Entrada: `create-<entidade>.dto.ts`, `update-<entidade>.dto.ts` (`PartialType` de `@nestjs/swagger`), `list-<entidades>-query.dto.ts` quando há filtro. Decorators do `class-validator` em toda propriedade; o nome da propriedade é o do JSON do contrato, mesmo em `snake_case` ([api.md](api.md)).
- Saída: `<entidade>.dto.ts`, com a classe (para o Swagger) e a função `to<Entidade>Dto(registro)`. Campos que o contrato **omite** sem valor são convertidos de `null` para `undefined`; os que vêm como `null` ficam `null`.
- JSDoc com `@example` nas propriedades: o CLI plugin do Swagger transforma em documentação. Não use `@ApiProperty` nem decorators de Swagger próprios.

## Comunicação entre módulos

1. **Service exportado.** O módulo A coloca `BModule` em `imports` e injeta um service listado em `exports` do `BModule`. Esses métodos devolvem DTOs.
2. **Funções puras.** A pode importar `src/modules/<b>/domain/<b>.calculos.ts` de um módulo do qual depende (ex.: `receitas` e `producoes` usam `calcularGastoNoCusto` de `gastos-indiretos`, e `receitas` usa `taxaDoCanal` de `canais`, e `vendas` usa `calcularPercentuaisSemLucro`, `calcularMargemContribuicao` e `somarGastosMensais` de `receitas`). É o único arquivo interno de outro módulo que se pode importar.
3. **Transação.** Quem orquestra abre a transação e passa o `tx` aos services dos outros módulos, que o repassam aos repositórios. Tudo ou nada:

   ```ts
   // src/modules/producoes/application/services/producao.service.ts (resumido)
   async create(dto: CreateProducaoDto, empresaId: number): Promise<ProducaoDto> {
     const receita = await this.receitaService.buscarDaEmpresa(dto.receita_id, empresaId); // 404
     const gastos = dto.gasto_indireto_ids
       ? await this.gastoIndiretoService.buscarVariosDaEmpresa(dto.gasto_indireto_ids, empresaId)
       : await this.gastoIndiretoService.listarPorEmpresa(empresaId);
     const calculo = calcularProducao(receita, dto.quantidade, gastos); // domain/producoes.calculos.ts

     return this.transactionManager.run(async (tx) => {
       const producao = await this.producaoRepository.create({ ...calculo, empresaId }, tx);
       await this.estoqueService.baixarPorProducao(receita.itens, dto.quantidade, producao.id, empresaId, tx);
       await this.estoqueProdutoAcabadoService.entradaPorProducao(receita.id, calculo.totalUnidades, producao.id, empresaId, tx);
       return toProducaoDto(producao);
     });
   }
   ```

Proibido: importar `application/` ou `infra/` de outro módulo, injetar o repositório de outro módulo, ou ler e gravar as tabelas de outro módulo pelo Prisma (inclusive com `include`). Não há eventos nem mensageria: o que era evento nos microsserviços vira chamada direta na mesma transação.

## Fluxo de uma requisição

```
HTTP → JwtAuthGuard global (401 NAO_AUTENTICADO ou TOKEN_INVALIDO; @Public() dispensa)
     → ValidationPipe global (400 DADOS_INVALIDOS; whitelist, forbidNonWhitelisted, transform)
     → Controller (infra): extrai params, corpo e @CurrentUser() e chama o service
     → Service (application): confere empresa e existência, chama domain/ e outros módulos, abre transação
     → Repositório (infra): Prisma
     → DTO de saída → JSON puro

Qualquer exceção → AllExceptionsFilter → { statusCode, code, message, details?, path, timestamp }
```

- O `JwtAuthModule` (`src/shared/infra/auth/jwt-auth.module.ts`) é global: registra o `JwtService` (HS256, `expiresIn: '4h'`, segredo `JWT_SECRET`) e o `JwtAuthGuard` como `APP_GUARD`. O módulo `auth` só injeta o `JwtService` para assinar o token; não registre o `JwtModule` de novo.
- O guard confere o token e o formato mínimo do payload (`sub`, `email`, `empresa.id`) e põe o `UsuarioAutenticado` em `request.user`, lido por `@CurrentUser()`.
- O `AllExceptionsFilter` traduz os erros de domínio pelo status da classe, os de validação para `DADOS_INVALIDOS` com `details`, as exceções que o próprio Nest lança em inglês (rota inexistente, `ParseIntPipe`, JSON malformado, throttler) para um `code` e uma mensagem padrão em português, e qualquer outro erro para 500 `ERRO_INTERNO`, registrando a stack só no log.

## Banco

- Um schema só, `prisma/schema.prisma` (BE-05), com chaves estrangeiras reais entre as tabelas. Nomes de tabela e coluna em `snake_case` com `@@map`/`@map`, iguais aos dos microsserviços; models em `PascalCase` singular e campos em `camelCase`.
- Ids `Int @default(autoincrement())`; valores e quantidades `Float`. Custo e preço são gravados sem arredondar e arredondados só nos DTOs de resposta (BE-23, [business-rules.md](business-rules.md#arredondamento)).
- `empresa_id` em toda tabela de negócio, com índice.
- Migration nova: `npm run db:migrate -- --name <verbo>_<descricao>`. Nunca edite uma migration já mergeada nem `src/generated/`.
- Transações: `TransactionManager.run(async (tx) => ...)` em `src/shared/infra/database/transaction.manager.ts`, injetável em qualquer service (o `PrismaModule` é global e o exporta). O tipo do `tx` é `PrismaTransaction` (`prisma.transaction.ts`).

## Exemplo completo: módulo `gastos-indiretos`

É o módulo da BE-08, curto e no padrão. Use-o como molde de **forma**; os campos e regras de cada módulo vêm da issue, do [api.md](api.md) e do [business-rules.md](business-rules.md). Caminhos relativos a `src/modules/gastos-indiretos/`.

### `domain/gastos-indiretos.calculos.ts`

Resumo; o arquivo real tem também a compatibilidade com o `metodo_rateio` antigo (`tipoDoMetodoRateio`, `metodoRateioDoTipo` e `resolverTipoGasto`, BE-26).

```ts
import { InvalidInputError } from '../../../shared/domain/errors/domain.error.js';

export type TipoGasto = 'MENSAL' | 'POR_UNIDADE' | 'PERCENTUAL_VENDA';

export interface GastoParaCusto {
  valor: number;
  tipo: TipoGasto;
}

export interface UsoDoGasto {
  lotes: number;
  totalUnidades: number;
  capacidadeMensal: number;
  /** Fornadas ou minutos de 1 lote: o `usoPorLote` da receita (BE-27); omitido, 1. */
  usoPorLote?: number;
}

/** Parte de um gasto no custo de `lotes` lotes (BE-26), sem arredondar (BE-23). */
export function calcularGastoNoCusto(gasto: GastoParaCusto, uso: UsoDoGasto): number {
  switch (gasto.tipo) {
    case 'MENSAL':
      return (gasto.valor * (uso.usoPorLote ?? 1) * uso.lotes) / uso.capacidadeMensal;
    case 'POR_UNIDADE':
      return gasto.valor * uso.totalUnidades;
    case 'PERCENTUAL_VENDA':
      return 0; // fração do preço, não custo (BE-28)
  }
}

/** `PERCENTUAL_VENDA` é fração do preço: 0 ≤ valor < 1. */
export function validarGasto(gasto: GastoParaCusto): void {
  if (gasto.tipo === 'PERCENTUAL_VENDA' && (gasto.valor < 0 || gasto.valor >= 1)) {
    throw new InvalidInputError('DADOS_INVALIDOS', 'Os dados enviados são inválidos', [
      { field: 'valor', messages: ['valor de um gasto PERCENTUAL_VENDA deve ser ...'] },
    ]);
  }
}
```

### `domain/gastos-indiretos.calculos.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { calcularGastoNoCusto, validarGasto } from './gastos-indiretos.calculos.js';

const uso = { lotes: 1, totalUnidades: 50, capacidadeMensal: 40 };

describe('calcularGastoNoCusto', () => {
  it('MENSAL de R$ 1.800 não entra inteiro num lote: divide pela capacidade', () => {
    expect(calcularGastoNoCusto({ valor: 1800, tipo: 'MENSAL' }, uso)).toBe(45);
  });

  it('POR_UNIDADE é valor por unidade: multiplica pelo total de unidades', () => {
    expect(calcularGastoNoCusto({ valor: 0.25, tipo: 'POR_UNIDADE' }, uso)).toBe(12.5);
  });
});

describe('validarGasto', () => {
  it('PERCENTUAL_VENDA de 12 (em vez de 0.12) → 400', () => {
    expect(() => validarGasto({ valor: 12, tipo: 'PERCENTUAL_VENDA' })).toThrow();
  });
});
```

### `application/dto/create-gasto-indireto.dto.ts`

```ts
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { TipoGasto } from '../../../../generated/prisma/client.js';
import { METODOS_RATEIO, type MetodoRateio } from '../../domain/gastos-indiretos.calculos.js';

export class CreateGastoIndiretoDto {
  /** @example 'Aluguel' */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  descricao: string;

  /** @example 1800 */
  @IsNumber()
  @Min(0)
  valor: number;

  /** Obrigatório se `metodo_rateio` não vier. @example 'MENSAL' */
  @ValidateIf((dto: CreateGastoIndiretoDto) => dto.metodo_rateio === undefined)
  @IsEnum(TipoGasto)
  tipo?: TipoGasto;

  /** Legado, em snake_case como no contrato do frontend. @deprecated Use `tipo`. @example 'FIXO' */
  @IsOptional()
  @IsIn(METODOS_RATEIO)
  metodo_rateio?: MetodoRateio;
}
```

### `application/dto/update-gasto-indireto.dto.ts`

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateGastoIndiretoDto } from './create-gasto-indireto.dto.js';

export class UpdateGastoIndiretoDto extends PartialType(CreateGastoIndiretoDto) {}
```

### `application/dto/gasto-indireto.dto.ts`

```ts
import type { GastoIndireto, TipoGasto } from '../../../../generated/prisma/client.js';
import { metodoRateioDoTipo, type MetodoRateio } from '../../domain/gastos-indiretos.calculos.js';

export class GastoIndiretoDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  empresaId: number;
  /** @example 'Aluguel' */
  descricao: string;
  /** @example 1800 */
  valor: number;
  /** @example 'MENSAL' */
  tipo: TipoGasto;
  /** Legado, derivado do `tipo`. @deprecated Use `tipo`. @example 'FIXO' */
  metodoRateio: MetodoRateio;
}

export function toGastoIndiretoDto(row: GastoIndireto): GastoIndiretoDto {
  return {
    id: row.id,
    empresaId: row.empresaId,
    descricao: row.descricao,
    valor: row.valor,
    tipo: row.tipo,
    metodoRateio: metodoRateioDoTipo(row.tipo),
  };
}
```

### `infra/repositories/gasto-indireto.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import type { GastoIndireto, TipoGasto } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';

interface GastoIndiretoData {
  descricao: string;
  valor: number;
  tipo: TipoGasto;
}

@Injectable()
export class GastoIndiretoRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByEmpresa(empresaId: number, tx?: PrismaTransaction): Promise<GastoIndireto[]> {
    const db = tx ?? this.prisma;
    return db.gastoIndireto.findMany({ where: { empresaId }, orderBy: { id: 'desc' } });
  }

  findByIdAndEmpresa(id: number, empresaId: number): Promise<GastoIndireto | null> {
    return this.prisma.gastoIndireto.findFirst({ where: { id, empresaId } });
  }

  listByIdsAndEmpresa(
    ids: number[],
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<GastoIndireto[]> {
    const db = tx ?? this.prisma;
    return db.gastoIndireto.findMany({ where: { id: { in: ids }, empresaId } });
  }

  create(empresaId: number, data: GastoIndiretoData): Promise<GastoIndireto> {
    return this.prisma.gastoIndireto.create({ data: { ...data, empresaId } });
  }

  update(id: number, data: Partial<GastoIndiretoData>): Promise<GastoIndireto> {
    return this.prisma.gastoIndireto.update({ where: { id }, data });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.gastoIndireto.delete({ where: { id } });
  }
}
```

### `application/services/gasto-indireto.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import type { GastoIndireto } from '../../../../generated/prisma/client.js';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { resolverTipoGasto, validarGasto } from '../../domain/gastos-indiretos.calculos.js';
import { GastoIndiretoRepository } from '../../infra/repositories/gasto-indireto.repository.js';
import type { CreateGastoIndiretoDto } from '../dto/create-gasto-indireto.dto.js';
import { type GastoIndiretoDto, toGastoIndiretoDto } from '../dto/gasto-indireto.dto.js';
import type { UpdateGastoIndiretoDto } from '../dto/update-gasto-indireto.dto.js';

@Injectable()
export class GastoIndiretoService {
  constructor(private readonly repository: GastoIndiretoRepository) {}

  async list(empresaId: number): Promise<GastoIndiretoDto[]> {
    const rows = await this.repository.listByEmpresa(empresaId);
    return rows.map(toGastoIndiretoDto);
  }

  async findById(id: number, empresaId: number): Promise<GastoIndiretoDto> {
    return toGastoIndiretoDto(await this.getOrFail(id, empresaId));
  }

  async create(dto: CreateGastoIndiretoDto, empresaId: number): Promise<GastoIndiretoDto> {
    const gasto = { valor: dto.valor, tipo: resolverTipoGasto(dto) };
    validarGasto(gasto);
    const row = await this.repository.create(empresaId, { descricao: dto.descricao, ...gasto });
    return toGastoIndiretoDto(row);
  }

  async update(id: number, dto: UpdateGastoIndiretoDto, empresaId: number): Promise<GastoIndiretoDto> {
    const atual = await this.getOrFail(id, empresaId);
    const gasto = { valor: dto.valor ?? atual.valor, tipo: resolverTipoGasto(dto, atual.tipo) };
    validarGasto(gasto);
    const row = await this.repository.update(id, { descricao: dto.descricao, ...gasto });
    return toGastoIndiretoDto(row);
  }

  async delete(id: number, empresaId: number): Promise<void> {
    await this.getOrFail(id, empresaId);
    await this.repository.delete(id); // os rateios antigos ficam, com o id e a descrição do gasto (sem FK, BE-12)
  }

  /** Para outros módulos: todos os gastos da empresa. */
  async listarPorEmpresa(empresaId: number, tx?: PrismaTransaction): Promise<GastoIndiretoDto[]> {
    const rows = await this.repository.listByEmpresa(empresaId, tx);
    return rows.map(toGastoIndiretoDto);
  }

  /** Para outros módulos: 404 se algum id não existir ou for de outra empresa. */
  async buscarVariosDaEmpresa(
    ids: number[],
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<GastoIndiretoDto[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return [];
    const rows = await this.repository.listByIdsAndEmpresa(unicos, empresaId, tx);
    if (rows.length !== unicos.length) {
      throw new NotFoundError('GASTO_INDIRETO_NAO_ENCONTRADO', 'Gasto indireto não encontrado');
    }
    return rows.map(toGastoIndiretoDto);
  }

  private async getOrFail(id: number, empresaId: number): Promise<GastoIndireto> {
    const row = await this.repository.findByIdAndEmpresa(id, empresaId);
    if (!row) {
      throw new NotFoundError('GASTO_INDIRETO_NAO_ENCONTRADO', 'Gasto indireto não encontrado');
    }
    return row;
  }
}
```

### `infra/controllers/gastos-indiretos.controller.ts`

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/usuario-autenticado.js';
import { CreateGastoIndiretoDto } from '../../application/dto/create-gasto-indireto.dto.js';
import type { GastoIndiretoDto } from '../../application/dto/gasto-indireto.dto.js';
import { UpdateGastoIndiretoDto } from '../../application/dto/update-gasto-indireto.dto.js';
import { GastoIndiretoService } from '../../application/services/gasto-indireto.service.js';

@ApiTags('gastos-indiretos')
@ApiBearerAuth()
@Controller('gastos-indiretos')
export class GastosIndiretosController {
  constructor(private readonly service: GastoIndiretoService) {}

  /** Lista os gastos indiretos da empresa, o mais novo primeiro */
  @Get()
  list(@CurrentUser() usuario: UsuarioAutenticado): Promise<GastoIndiretoDto[]> {
    return this.service.list(usuario.empresa.id);
  }

  /** Detalha um gasto indireto */
  @Get(':id')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<GastoIndiretoDto> {
    return this.service.findById(id, usuario.empresa.id);
  }

  /** Cria um gasto indireto */
  @Post()
  create(
    @Body() dto: CreateGastoIndiretoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<GastoIndiretoDto> {
    return this.service.create(dto, usuario.empresa.id);
  }

  /** Atualiza um gasto indireto (campos opcionais) */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGastoIndiretoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<GastoIndiretoDto> {
    return this.service.update(id, dto, usuario.empresa.id);
  }

  /** Exclui um gasto indireto */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.service.delete(id, usuario.empresa.id);
  }
}
```

### `gastos-indiretos.module.ts`

```ts
import { Module } from '@nestjs/common';
import { GastoIndiretoService } from './application/services/gasto-indireto.service.js';
import { GastosIndiretosController } from './infra/controllers/gastos-indiretos.controller.js';
import { GastoIndiretoRepository } from './infra/repositories/gasto-indireto.repository.js';

@Module({
  // imports: [OutroModule],  ← módulos dos quais este depende (nenhum aqui)
  controllers: [GastosIndiretosController],
  providers: [GastoIndiretoService, GastoIndiretoRepository],
  exports: [GastoIndiretoService],
})
export class GastosIndiretosModule {}
```

O `PrismaModule` é global. Registre `GastosIndiretosModule` em `src/app.module.ts` e confira as rotas em <http://localhost:3100/docs>.
