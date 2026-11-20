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
| `auth` | `Empresa`, `Usuario` | cadastro de empresa, login e JWT (assinado com o `JwtService` do `JwtAuthModule`); não exporta service | — | BE-06 |
| `estoque` | `Estoque`, `MovimentacaoEstoque`, `EstoqueProdutoAcabado`, `MovimentacaoProdutoAcabado` | saldo e histórico de insumos e de produto acabado; exporta `EstoqueService` (`criarRegistroInicial` e `saldosPorInsumo` desde a BE-07) | — | BE-07, BE-11, BE-12 |
| `insumos` | `Insumo` | cadastro de insumos e custo unitário; cria o estoque inicial na mesma transação; exporta `InsumoService` (`buscarVariosDaEmpresa` desde a BE-09) | `estoque` | BE-07 |
| `gastos-indiretos` | `GastoIndireto` | cadastro de gastos e cálculo do rateio (`calcularValorRateado`); exporta `GastoIndiretoService` (`listarPorEmpresa` e `buscarVariosDaEmpresa`) | — | BE-08 |
| `receitas` | `Receita`, `ItemReceita` | receitas, custo para 1 ou N lotes (`calcularCustoReceita`), simulação (`simularCenario`) e preço de venda (`calcularPrecoVenda`), sem gravar; exporta `ReceitaService` (`buscarDaEmpresa`) | `insumos`, `gastos-indiretos` | BE-09, BE-10 |
| `producoes` | `Producao`, `RateioProducao` | produção com rateio, baixa de insumos e entrada de produto acabado | `receitas`, `gastos-indiretos`, `estoque` | BE-12 |
| `vendas` | `Venda`, `ItemVenda` | vendas e conclusão com baixa de produto acabado | `receitas`, `estoque` | BE-13 |

### Tabelas e donos

Schema em `prisma/schema.prisma`, migration inicial `init` (BE-05). Toda tabela de negócio raiz tem `empresa_id` com FK para `empresa` e índice; as tabelas de itens (`item_receita`, `rateio_producao`, `item_venda`) herdam a empresa do pai.

| Tabela (model) | Módulo dono | Chaves estrangeiras (`ON DELETE`) |
| --- | --- | --- |
| `empresa` (`Empresa`) | `auth` | — |
| `usuario` (`Usuario`) | `auth` | `empresa_id` (`CASCADE`) |
| `insumo` (`Insumo`) | `insumos` | `empresa_id` |
| `gasto_indireto` (`GastoIndireto`) | `gastos-indiretos` | `empresa_id` |
| `receita` (`Receita`) | `receitas` | `empresa_id` |
| `item_receita` (`ItemReceita`) | `receitas` | `receita_id` (`CASCADE`), `insumo_id` (`RESTRICT` → 409 `INSUMO_EM_USO`) |
| `estoque` (`Estoque`) | `estoque` | `empresa_id`, `insumo_id` (`CASCADE`, único) |
| `movimentacao_estoque` (`MovimentacaoEstoque`) | `estoque` | `empresa_id`, `insumo_id` (`CASCADE`) |
| `estoque_produto_acabado` (`EstoqueProdutoAcabado`) | `estoque` | `empresa_id`, `receita_id` (`CASCADE`, único) |
| `movimentacao_produto_acabado` (`MovimentacaoProdutoAcabado`) | `estoque` | `empresa_id`, `receita_id` (`CASCADE`) |
| `producao` (`Producao`) | `producoes` | `empresa_id`, `receita_id` (`RESTRICT`) |
| `rateio_producao` (`RateioProducao`) | `producoes` | `producao_id` (`CASCADE`), `gasto_indireto_id` (`SET NULL`; o rateio guarda a `descricao` do gasto) |
| `venda` (`Venda`) | `vendas` | `empresa_id` |
| `item_venda` (`ItemVenda`) | `vendas` | `venda_id` (`CASCADE`), `receita_id` (`RESTRICT`) |

`empresa_id` sem indicação é `RESTRICT` (padrão do Prisma): excluir empresa não é uma funcionalidade. A exclusão de insumo leva junto o saldo e as movimentações de estoque dele, e a de receita leva o saldo e as movimentações de produto acabado (quando não há produção nem venda, que a bloqueiam).

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

Só o módulo `vendas` tem também `domain/venda.entity.ts` (e o `venda.entity.spec.ts`). Módulo com várias tabelas (ex.: `estoque`) tem um repositório e, se fizer sentido, um service por tabela principal, nas mesmas pastas. Não crie submódulos, interfaces de repositório, tokens `Symbol` nem `OVERVIEW.md`.

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
- Recebe DTOs validados e o `empresaId` do token, e devolve DTOs de saída. Nunca devolve o registro do Prisma.
- Lança só os erros de `src/shared/domain/errors/domain.error.ts`.
- Abre transação com `TransactionManager.run()` quando grava em mais de uma tabela ou em mais de um módulo.

### DTOs

- Entrada: `create-<entidade>.dto.ts`, `update-<entidade>.dto.ts` (`PartialType` de `@nestjs/swagger`), `list-<entidades>-query.dto.ts` quando há filtro. Decorators do `class-validator` em toda propriedade; o nome da propriedade é o do JSON do contrato, mesmo em `snake_case` ([api.md](api.md)).
- Saída: `<entidade>.dto.ts`, com a classe (para o Swagger) e a função `to<Entidade>Dto(registro)`. Campos que o contrato **omite** sem valor são convertidos de `null` para `undefined`; os que vêm como `null` ficam `null`.
- JSDoc com `@example` nas propriedades: o CLI plugin do Swagger transforma em documentação. Não use `@ApiProperty` nem decorators de Swagger próprios.

## Comunicação entre módulos

1. **Service exportado.** O módulo A coloca `BModule` em `imports` e injeta um service listado em `exports` do `BModule`. Esses métodos devolvem DTOs.
2. **Funções puras.** A pode importar `src/modules/<b>/domain/<b>.calculos.ts` de um módulo do qual depende (ex.: `receitas` e `producoes` usam `calcularValorRateado` de `gastos-indiretos`). É o único arquivo interno de outro módulo que se pode importar.
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
       await this.estoqueService.entradaPorProducao(receita.id, calculo.totalUnidades, producao.id, empresaId, tx);
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
- Ids `Int @default(autoincrement())`; valores e quantidades `Float`, arredondados antes de gravar ([business-rules.md](business-rules.md#arredondamento)).
- `empresa_id` em toda tabela de negócio, com índice.
- Migration nova: `npm run db:migrate -- --name <verbo>_<descricao>`. Nunca edite uma migration já mergeada nem `src/generated/`.
- Transações: `TransactionManager.run(async (tx) => ...)` em `src/shared/infra/database/transaction.manager.ts`, injetável em qualquer service (o `PrismaModule` é global e o exporta). O tipo do `tx` é `PrismaTransaction` (`prisma.transaction.ts`).

## Exemplo completo: módulo `gastos-indiretos`

É o módulo da BE-08, curto e no padrão. Use-o como molde de **forma**; os campos e regras de cada módulo vêm da issue, do [api.md](api.md) e do [business-rules.md](business-rules.md). Caminhos relativos a `src/modules/gastos-indiretos/`.

### `domain/gastos-indiretos.calculos.ts`

```ts
import { round2 } from '../../../shared/domain/arredondamento.js';

export type MetodoRateio = 'FIXO' | 'PROPORCIONAL' | 'POR_UNIDADE';

export interface GastoParaRateio {
  valor: number;
  metodoRateio: MetodoRateio;
}

/**
 * Valor de um gasto rateado para `lotes` lotes que rendem `totalUnidades`.
 * Origem: producao.service.ts (calcularValorRateado) do operations-service.
 */
export function calcularValorRateado(
  gasto: GastoParaRateio,
  lotes: number,
  totalUnidades: number,
): number {
  switch (gasto.metodoRateio) {
    case 'FIXO':
      return round2(gasto.valor);
    case 'PROPORCIONAL':
      return round2(gasto.valor * lotes);
    case 'POR_UNIDADE':
      return round2(gasto.valor * totalUnidades);
  }
}
```

### `domain/gastos-indiretos.calculos.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { calcularValorRateado } from './gastos-indiretos.calculos.js';

describe('calcularValorRateado', () => {
  it('FIXO não depende de lotes nem de unidades', () => {
    expect(calcularValorRateado({ valor: 1800, metodoRateio: 'FIXO' }, 3, 150)).toBe(1800);
  });

  it('PROPORCIONAL multiplica pelos lotes', () => {
    expect(calcularValorRateado({ valor: 12.5, metodoRateio: 'PROPORCIONAL' }, 3, 150)).toBe(37.5);
  });

  it('POR_UNIDADE multiplica pelo total de unidades, com o round2 de toFixed', () => {
    // 0.015 × 101 = 1.515 no ponto flutuante, e toFixed(2) dá '1.51'
    expect(calcularValorRateado({ valor: 0.015, metodoRateio: 'POR_UNIDADE' }, 1, 101)).toBe(1.51);
  });
});
```

### `application/dto/create-gasto-indireto.dto.ts`

```ts
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { MetodoRateio } from '../../../../generated/prisma/client.js';

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

  /** Nome em snake_case, como no contrato do frontend. @example 'FIXO' */
  @IsEnum(MetodoRateio)
  metodo_rateio: MetodoRateio;
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
import type { GastoIndireto, MetodoRateio } from '../../../../generated/prisma/client.js';

export class GastoIndiretoDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  empresaId: number;
  /** @example 'Aluguel' */
  descricao: string;
  /** @example 1800 */
  valor: number;
  /** @example 'FIXO' */
  metodoRateio: MetodoRateio;
}

export function toGastoIndiretoDto(row: GastoIndireto): GastoIndiretoDto {
  return {
    id: row.id,
    empresaId: row.empresaId,
    descricao: row.descricao,
    valor: row.valor,
    metodoRateio: row.metodoRateio,
  };
}
```

### `infra/repositories/gasto-indireto.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import type { GastoIndireto, MetodoRateio } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';

interface GastoIndiretoData {
  descricao: string;
  valor: number;
  metodoRateio: MetodoRateio;
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
    const row = await this.repository.create(empresaId, {
      descricao: dto.descricao,
      valor: dto.valor,
      metodoRateio: dto.metodo_rateio,
    });
    return toGastoIndiretoDto(row);
  }

  async update(id: number, dto: UpdateGastoIndiretoDto, empresaId: number): Promise<GastoIndiretoDto> {
    await this.getOrFail(id, empresaId);
    const row = await this.repository.update(id, {
      descricao: dto.descricao,
      valor: dto.valor,
      metodoRateio: dto.metodo_rateio,
    });
    return toGastoIndiretoDto(row);
  }

  async delete(id: number, empresaId: number): Promise<void> {
    await this.getOrFail(id, empresaId);
    await this.repository.delete(id); // os rateios antigos ficam, com gasto_indireto_id nulo (BE-05)
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
