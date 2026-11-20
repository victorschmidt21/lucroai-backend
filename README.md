# LucroAI Backend

Backend do LucroAI: custos, preço sugerido, estoque, produções e vendas para pequenos produtores de alimentos.

> **Este repositório substitui o [`GrupoDoisENG/lucroai-backend`](https://github.com/GrupoDoisENG/lucroai-backend)**, que tinha 5 microsserviços com RabbitMQ. Não há mais `auth`, `catalog`, `recipe`, `operations` e `sales` separados: tudo roda aqui.

## Arquitetura

É um **monolito modular**: um único app NestJS 12 (TypeScript, ESM) e um único banco Postgres 17 acessado pelo Prisma 7. O código é dividido em módulos de domínio em `src/modules/<modulo>/`, cada um dono das suas tabelas, que conversam só pelos services exportados, no mesmo processo e, quando preciso, na mesma transação. A API mantém o contrato dos microsserviços (mesmas rotas e campos, JSON puro, JWT HS256), então o frontend web ([`lucroai-frontend`](https://github.com/victorschmidt21/lucroai-frontend)) a usa sem mudança. Detalhes em [docs/architecture.md](docs/architecture.md).

| Módulo | O que faz | Rotas principais |
| --- | --- | --- |
| `auth` | empresas, usuários, login e JWT | `/auth` |
| `insumos` | insumos e custo unitário | `/insumos` |
| `gastos-indiretos` | gastos indiretos e rateio | `/gastos-indiretos` |
| `receitas` | receitas, custo por lotes, simulação e preço de venda | `/receitas` |
| `estoque` | saldo e movimentações de insumos e de produto acabado | `/estoque` |
| `producoes` | produções com rateio e baixa de insumos | `/producoes` |
| `vendas` | vendas, conclusão e cancelamento | `/vendas` |

- API: `http://localhost:3100`
- Saúde: `GET /health` (faz `SELECT 1` no banco)
- Swagger: `http://localhost:3100/docs`

## Com Docker

```bash
docker compose up --build
```

Sobe o Postgres 17 (porta do host `55640`) e a API com hot reload na `3100`. Nenhum `.env` é necessário: o Compose tem valores padrão de desenvolvimento.

## Sem Docker

Requer Node 24.

```bash
cp .env.example .env
docker compose up -d postgres   # ou um Postgres próprio, ajustando DATABASE_URL
npm install                     # também gera o Prisma Client
npm run db:deploy
npm run db:seed                 # opcional: dados de demonstração
npm run start:dev
```

## Dados de demonstração

`npm run db:seed` cria a **Padaria Pão Feliz Ltda** com 12 insumos (3 abaixo do mínimo), 4 gastos indiretos, 4 receitas, 4 produções e 8 vendas (concluídas, uma pendente e uma cancelada) espalhadas pelos últimos 6 meses. Login: **`joao@padariapaofeliz.com.br` / `123456`** (ou `maria@padariapaofeliz.com.br`, mesma senha), com os dados na mesma empresa.

O seed (`prisma/seed.ts`) é idempotente: apaga e recria os dados da empresa do seed (achada pelo CNPJ), sem tocar nas outras. Os custos são calculados com as funções de `domain/` dos módulos, então batem com os da API (ex.: Pão Francês com custo de produção R$ 8.438,31, unitário R$ 168,77 e preço sugerido R$ 270,03). Recusa rodar com `NODE_ENV=production`. Com Docker: `docker compose exec api npm run db:seed`.

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run start:dev` | API com hot reload |
| `npm run build` | compila para `dist/` |
| `npm run lint` / `npm run format:check` | oxlint e Prettier |
| `npm test` | testes unitários (Vitest) |
| `npm run test:e2e` | testes e2e no banco `lucroai_test` (precisa do Postgres do Compose no ar) |
| `npm run db:generate` / `db:migrate` / `db:deploy` | Prisma: gerar client, criar migration, aplicar migrations |
| `npm run db:seed` | dados de demonstração (Padaria Pão Feliz), idempotente |

## Variáveis de ambiente

Documentadas em [`.env.example`](.env.example). A aplicação não sobe sem `DATABASE_URL` nem, fora de `development`/`test`, sem um `JWT_SECRET` de pelo menos 32 caracteres.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `DATABASE_URL` | — (obrigatória) | URL do Postgres (`postgresql://...`) |
| `JWT_SECRET` | segredo fictício em `development`/`test` | assinatura dos tokens; em produção, aleatório com 32+ caracteres |
| `PORT` | `3100` | porta HTTP |
| `NODE_ENV` | `development` | `development`, `test` ou `production` (a imagem de produção já define) |

## Deploy

A imagem de produção (`docker build --target production`) aplica as migrations ao subir (`prisma migrate deploy`), roda sem root e tem healthcheck em `GET /health`. Variáveis de produção, como publicar num provedor de containers com Postgres gerenciado, o corte do frontend (as 5 `*_API_URL` apontando para esta API), os dados e a aposentadoria dos microsserviços estão em [docs/deploy.md](docs/deploy.md).

## Documentação

| Arquivo | Conteúdo |
| --- | --- |
| [AGENTS.md](AGENTS.md) | regras do projeto, comandos e convenções (para pessoas e agentes de IA) |
| [docs/architecture.md](docs/architecture.md) | módulos, camadas, comunicação entre módulos, transações e banco |
| [docs/api.md](docs/api.md) | contrato com o frontend: rotas, respostas, erros e teste de contrato |
| [docs/business-rules.md](docs/business-rules.md) | fórmulas, arredondamentos e regras de negócio |
| [docs/deploy.md](docs/deploy.md) | produção, corte do frontend, dados e aposentadoria dos microsserviços |
