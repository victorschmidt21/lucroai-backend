# LucroAI Backend

Backend do LucroAI: um único app NestJS (monolito modular) com um único banco Postgres, usando Prisma 7.

> **Este repositório substitui o [`GrupoDoisENG/lucroai-backend`](https://github.com/GrupoDoisENG/lucroai-backend)**, que tinha 5 microsserviços com RabbitMQ. Não há mais `auth`, `catalog`, `recipe`, `operations` e `sales` separados: tudo roda aqui.

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

Documentadas em [`.env.example`](.env.example): `NODE_ENV`, `PORT`, `DATABASE_URL` e `JWT_SECRET`. A aplicação não sobe sem `DATABASE_URL` nem, fora de `development`/`test`, sem um `JWT_SECRET` de pelo menos 32 caracteres.
