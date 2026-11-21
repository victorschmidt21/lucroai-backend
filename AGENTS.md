# AGENTS.md

Guia para agentes de IA (Claude Code, Codex, Cursor, Copilot etc.) e para o time. **Leia este arquivo inteiro antes de alterar o código.** Os detalhes estão em `docs/`; em caso de conflito, `docs/` prevalece sobre o que você "acha" que é o padrão do NestJS.

## Visão geral

Backend do **LucroAI**: sistema de custos e lucro para pequenos produtores de alimentos, como padarias e confeitarias. Insumos com custo unitário, gastos indiretos rateados, receitas com custo de produção e preço sugerido, simulações, estoque de insumos e de produto acabado, produções e vendas.

É um **monolito modular**: uma aplicação NestJS e um banco Postgres, com módulos de domínio em `src/modules/<modulo>/`. Ele substitui os 5 microsserviços do [`GrupoDoisENG/lucroai-backend`](https://github.com/GrupoDoisENG/lucroai-backend) e atende o frontend web ([`lucroai-frontend`](https://github.com/victorschmidt21/lucroai-frontend)) **com o mesmo contrato**: o frontend não pode precisar de mudança.

O produto é inicial: entregue rápido e simples. O padrão de módulo é **mais leve que o da Urbizzi** (funções puras, repositório concreto, sem `OVERVIEW.md`), ver [docs/architecture.md](docs/architecture.md).

## Stack

| Item | Tecnologia |
| --- | --- |
| Runtime | Node.js 24, ESM (`"type": "module"`) |
| Framework | NestJS 12, TypeScript `strict` |
| Banco | PostgreSQL 17 + Prisma ORM 7 (`@prisma/adapter-pg`) |
| Validação | `class-validator` / `class-transformer` (DTOs), Zod (variáveis de ambiente e a cópia dos contratos do frontend no teste de contrato) |
| Autenticação | JWT HS256 (`@nestjs/jwt`), senha com `argon2`, limite de tentativas com `@nestjs/throttler` no `AuthController` |
| Documentação da API | `@nestjs/swagger` com CLI plugin, em `/docs` |
| Testes | Vitest + Supertest |
| Lint / formatação | oxlint + Prettier |
| Infra local | Docker Compose (`api` na 3100 + `postgres` na 55640) |
| Produção | imagem `Dockerfile` (target `production`) + Postgres gerenciado, em qualquer provedor de containers ([docs/deploy.md](docs/deploy.md)) |

## Comandos

```bash
docker compose up --build               # API (hot reload, porta 3100) + Postgres (porta 55640)
docker compose up -d postgres           # só o banco, para rodar a API fora do Docker
npm run start:dev                       # API fora do Docker
npm run lint                            # oxlint
npm run format                          # Prettier (escreve)
npm run format:check                    # Prettier (só verifica)
npm run build                           # compila para dist/
npm test                                # testes unitários (src/**/*.spec.ts)
npm run test:e2e                        # e2e no banco lucroai_test, inclusive o de contrato (precisa do Postgres no ar)
npx vitest run caminho/arquivo.spec.ts  # um arquivo só
npm run db:migrate -- --name <nome>     # cria e aplica migration
npm run db:deploy                       # aplica as migrations existentes
npm run db:generate                     # regenera o Prisma Client
npm run db:seed                         # dados de demonstração (idempotente): joao@padariapaofeliz.com.br / 123456
docker build --target production -t lucroai-backend .  # imagem de produção (aplica as migrations ao subir)
```

Antes de dizer que terminou: `npm run lint && npm run format:check && npm run build && npm test` precisam passar (é o que o CI roda). Se mexeu em controller, rota, banco ou contrato, rode também `npm run test:e2e`.

## Mapa de documentação

| Arquivo | Leia quando for... |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | criar ou alterar um módulo: camadas, mapa de módulos (com o dono de cada tabela), comunicação entre módulos, transações, banco e o **exemplo completo** (`gastos-indiretos`) |
| [docs/api.md](docs/api.md) | criar ou alterar uma rota: o contrato com o frontend (rotas, corpos, respostas, `null` × omitido), status e formato de erro |
| [docs/business-rules.md](docs/business-rules.md) | implementar qualquer cálculo ou regra: fórmulas, arredondamentos, validações, com o arquivo de origem nos microsserviços, e o destino de cada lacuna do backend atual |
| [docs/deploy.md](docs/deploy.md) | mexer no `Dockerfile`, nas variáveis de ambiente ou no deploy: imagem de produção (migrations ao subir, sem root, healthcheck), variáveis de produção, corte do frontend e aposentadoria dos microsserviços |
| Frontend: `docs/api-integration.md` e `src/shared/api/contracts/` | conferir como o frontend chama a rota e o schema Zod que valida a resposta |
| Microsserviços: `services/<servico>/src/modules/<modulo>/` | conferir o comportamento atual (o código prevalece sobre o `OVERVIEW.md` de lá) |

## Regras obrigatórias

1. **Siga a estrutura de módulo** de [docs/architecture.md](docs/architecture.md#estrutura-de-um-módulo). Não crie pastas ou camadas novas sem atualizar a documentação no mesmo PR.
2. **Fórmulas e regras que dependem só de valores ficam em funções puras** em `domain/<modulo>.calculos.ts`, com teste. Entidade de classe só na `Venda` (status com transições).
3. **Repositório concreto**: `infra/repositories/<entidade>.repository.ts`, injetado pela classe. Sem interface de repositório e sem token `Symbol`.
4. **Só o repositório acessa o Prisma**, e só as tabelas do próprio módulo ([mapa de módulos](docs/architecture.md#mapa-de-módulos)). A única exceção é o seed (`prisma/seed.ts`).
5. **Controllers são finos**: recebem DTO e `@CurrentUser()`, chamam um método do service e devolvem o DTO de saída.
6. **Um módulo só usa de outro os services exportados** (e as funções puras de `domain/<modulo>.calculos.ts` de um módulo do qual depende). Nada de importar `application/` ou `infra/` de outro módulo, nem criar dependência circular.
7. **Transação entre módulos** com `TransactionManager.run()`, passando o `tx` como último parâmetro aos services e repositórios.
8. **O contrato do frontend é intocável**: mesmas rotas, sem `/v1`, sem envelope, sem paginação, mesmos nomes de campo (inclusive `snake_case`), mesmo `null` × omitido. Campo novo só aditivo ([docs/api.md](docs/api.md)).
9. **Os números precisam bater com os dos microsserviços**: use as fórmulas de [docs/business-rules.md](docs/business-rules.md). Só mude um cálculo quando uma issue corrigir uma lacuna, e registre no `business-rules.md`. **Arredonde só na resposta** (BE-23): as funções de `domain/` não arredondam valores de custo e preço; os DTOs de saída usam `round2`/`round4`/`round6` ([Arredondamento](docs/business-rules.md#arredondamento)).
10. **Erros de negócio usam as classes de `src/shared/domain/errors/domain.error.ts`** (`InvalidInputError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `BusinessRuleError`), com `code` em `UPPER_SNAKE_CASE` e mensagem em português. Não lance `HttpException` em `domain/` nem em `application/`.
11. **A empresa vem sempre do token.** Todo acesso filtra por `empresaId`; recurso de outra empresa responde 404.
12. **DTOs com `class-validator`**, documentados pelo CLI plugin do Swagger (JSDoc com `@example`). Sem `@ApiProperty` e sem decorators de Swagger próprios.
13. **Imports relativos com extensão `.js`** (ESM `nodenext`), sem path alias e sem `index.ts` de reexportação.
14. **Nunca edite `src/generated/`** nem migrations já mergeadas.
15. **Nunca registre senha, hash, token ou segredo** em log, resposta ou erro.
16. **Idioma**: termos de domínio em português sem acento (`Insumo`, `custoUnitario`); termos técnicos em inglês (`Service`, `findById`); textos para pessoas (mensagens, docs, commits) em português.
17. **Não use o que ainda não existe.** O que está "previsto (BE-NN)" depende da issue citada; ao entregá-lo, atualize a tabela de `src/shared/` abaixo.
18. Não adicione dependências novas sem necessidade clara; se adicionar, justifique no PR.

## Como criar um módulo novo (checklist)

1. Leia a issue, o [mapa de módulos](docs/architecture.md#mapa-de-módulos), as rotas em [docs/api.md](docs/api.md), as regras em [docs/business-rules.md](docs/business-rules.md) e o código do módulo equivalente nos microsserviços.
2. Se precisar de tabela ou coluna, altere `prisma/schema.prisma` e rode `npm run db:migrate -- --name <verbo>_<descricao>`.
3. Crie `src/modules/<modulo>/` copiando o [exemplo completo](docs/architecture.md#exemplo-completo-módulo-gastos-indiretos):
   - `domain/<modulo>.calculos.ts` e `domain/<modulo>.calculos.spec.ts` (se houver fórmula ou regra)
   - `application/dto/create-<entidade>.dto.ts`, `update-<entidade>.dto.ts` e `<entidade>.dto.ts` (com `to<Entidade>Dto`)
   - `application/services/<entidade>.service.ts`
   - `infra/repositories/<entidade>.repository.ts`
   - `infra/controllers/<recurso-no-plural>.controller.ts`
   - `<modulo>.module.ts`, exportando os services que outros módulos usam
4. Registre o módulo em `src/app.module.ts`.
5. Confira as respostas contra os schemas Zod do frontend (`lucroai-frontend/src/shared/api/contracts/`) e o Swagger em <http://localhost:3100/docs>.
6. Atualize `docs/api.md` e `docs/business-rules.md` se a issue mudou rota ou regra, e o mapa de módulos se criou módulo ou dependência.
7. Rode a verificação completa ([Comandos](#comandos)) e abra o PR com o template.

## O que já existe em `src/shared/`

| Caminho | O que é |
| --- | --- |
| `domain/errors/domain.error.ts` | `DomainError` e subclasses: `InvalidInputError` (400, aceita `details`), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `BusinessRuleError` (422) |
| `infra/database/prisma.module.ts`, `prisma.service.ts` | `PrismaModule` (global) e `PrismaService` (Prisma 7 com `@prisma/adapter-pg`) |
| `infra/database/transaction.manager.ts`, `prisma.transaction.ts` | `TransactionManager` (`run(async (tx) => ...)`, exportado pelo `PrismaModule`) e o tipo `PrismaTransaction` |
| `infra/http/` | `AllExceptionsFilter` (formato único de erro), `ErrorResponseDto` e `validationExceptionFactory` (400 `DADOS_INVALIDOS` com `details` por campo), registrados em `app.setup.ts` |
| `infra/auth/` | `JwtAuthModule` (global: `JwtService` HS256 com 4 h e `JwtAuthGuard` como guard global), `@Public()`, `@CurrentUser()` e o tipo `UsuarioAutenticado` (`{ sub, email, nome, empresa: { id, nome, cnpj, segmento } }`) |
| `infra/health/` | `GET /health` (pública), com `SELECT 1` no banco |
| `domain/arredondamento.ts` | `round2`, `round4` e `round6` (meio para cima, sem o ruído do ponto flutuante; só nos DTOs de saída, BE-23, [business-rules.md](docs/business-rules.md#arredondamento)) |

## Convenções

| O quê | Padrão | Exemplo |
| --- | --- | --- |
| Pasta do módulo | plural, `kebab-case` | `gastos-indiretos` |
| Módulo | `<modulo>.module.ts` | `GastosIndiretosModule` |
| Funções puras | `domain/<modulo>.calculos.ts` | `calcularValorRateado` |
| Service | `application/services/<entidade>.service.ts` | `GastoIndiretoService` |
| DTO de entrada | `create-<entidade>.dto.ts`, `update-<entidade>.dto.ts` | `CreateGastoIndiretoDto` |
| DTO de saída | `<entidade>.dto.ts` | `GastoIndiretoDto` + `toGastoIndiretoDto` |
| Repositório | `infra/repositories/<entidade>.repository.ts` | `GastoIndiretoRepository` |
| Controller | `infra/controllers/<recurso>.controller.ts` | `GastosIndiretosController` |
| Teste unitário | ao lado do arquivo, `*.spec.ts` | `gastos-indiretos.calculos.spec.ts` |
| Teste e2e | `test/*.e2e-spec.ts` | `test/contrato.e2e-spec.ts` |
| Código de erro | `UPPER_SNAKE_CASE` em português, sem acento | `INSUMO_EM_USO` |
| Rota e campo JSON | os do contrato do frontend ([docs/api.md](docs/api.md)) | `POST /gastos-indiretos`, `metodo_rateio` |
| Tabela e coluna | `snake_case`, iguais às dos microsserviços (`@@map`/`@map`) | `gasto_indireto`, `metodo_rateio` |

- Sem `any`; use `unknown` e refine. `import type` para o que é só tipo.
- Comente o **porquê** de decisões não evidentes (ex.: uma regra mantida por compatibilidade com uma lacuna).
- Dinheiro e quantidade são `number` (`Float` no banco). Custo e preço são gravados sem arredondar e arredondados só na resposta, com as funções de `domain/arredondamento.ts`; saldos de estoque levam `round6` ao gravar.
- Formatação é do Prettier (aspas simples, vírgula final): rode `npm run format`.

**Commits** em [Conventional Commits](https://www.conventionalcommits.org/), em português: `<tipo>(<escopo>): <descrição>`, com tipo `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci` ou `perf`, escopo opcional (módulo ou área: `receitas`, `prisma`, `shared`) e descrição no presente, com inicial minúscula e sem ponto final. Ex.: `feat(receitas): calcula o custo da receita`. Commits pequenos, e cada um compila.

**Branches**: `<tipo>/be-<nn>-<descricao-curta>` (ex.: `feat/be-09-receitas`), ou uma branch por épico com PRs empilhados até a `main`. Todo código entra por PR, com o template preenchido.

## Segurança

- **JWT** HS256 com validade de 4 h, assinado com `JWT_SECRET` (mínimo de 32 caracteres fora de `development`/`test`). Guard global: toda rota exige `Authorization: Bearer`, menos as marcadas com `@Public()` (`/health`, `/auth/login`, `/auth/empresa`). Não existe rota `/internal`.
- **Multiempresa**: o `empresaId` vem de `@CurrentUser().empresa.id`. O cliente nunca o envia. Ids recebidos no corpo (insumos, receitas, gastos) também são conferidos contra a empresa. Outra empresa → 404, nunca 403.
- **Senhas** com `argon2`; a mesma mensagem para e-mail inexistente e senha errada. Limite de tentativas só no `AuthController` (`AuthThrottlerGuard`: 10 por minuto, contadas por IP **e** e-mail, porque todo mundo chega pelo IP do BFF).
- **Sem CORS**: o navegador nunca chama a API, só o servidor do frontend (BFF).
- **Segredos** só em variáveis de ambiente. O repositório é público: nada de `.env` real, token ou senha de produção em código, docs, testes ou CI.
- Erro inesperado responde 500 com mensagem genérica, sem stack nem texto interno.

## Testes

Política do produto inicial:

- **Unitário** só das funções de `domain/` (fórmulas e regras) e da entidade `Venda`. Cada ramo de uma fórmula tem um caso, com os números conferidos nos microsserviços.
- **E2E** só no teste de fumaça (`test/health.e2e-spec.ts`, BE-01) e no teste de contrato com o frontend (`test/contrato.e2e-spec.ts`, BE-15). O de contrato valida as respostas com a cópia dos schemas Zod do frontend em `test/contrato/`; rota nova ou mudança de resposta entra nele, e a cópia se atualiza como em [docs/api.md](docs/api.md#teste-de-contrato).
- **Não escreva** testes de controller, de repositório ou de service com mocks.
- Sem meta de cobertura.
- Teste extra só quando a issue pedir na seção "Testes".
