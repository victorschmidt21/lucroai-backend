---
title: "Campos antigos do contrato ficam até o frontend migrar, e migrations são geradas sem o migrate dev"
author: Victorschmidt21
date: 2026-11-22
branch: feat/e7-calculo-de-custo-e-preco
cost: { minutes: 44, tokens: 300858 }
id: l-eb137190
scope: repo
status: active
src: agent
touches:
  - AGENTS.md
  - README.md
  - docs/api.md
  - docs/business-rules.md
  - src/modules/receitas/application/dto/simular-cenario.dto.ts
  - src/modules/receitas/domain/receitas.calculos.ts
  - test/contrato.e2e-spec.ts
  - test/contrato/auth.ts
  - test/contrato/catalog.ts
---

## Decided
- O cálculo novo de custo e preço (épico E7) só acrescentou campos. Os campos antigos continuam na API, recalculados a partir dos novos, porque os schemas Zod do frontend atual ainda os exigem. Removê-los quebraria a produção. Eles só saem depois que o frontend migrar (FE-41 a FE-47), numa issue de backend própria.
- Campos e rotas novos do E7 são conferidos no teste de contrato por schemas locais, até o frontend publicar os contratos deles.

## Tried and ruled out
- `npm run db:migrate` (prisma migrate dev) não roda em modo não interativo, que é como os agentes executam. As migrations do E7 foram geradas com `prisma migrate diff` ou escritas à mão, com timestamps crescentes escolhidos à mão.

## Watch out
- Não há `shadowDatabaseUrl` configurado, então `prisma migrate diff --from-migrations` não funciona. Para conferir, aplique as migrations e use `migrate status` ou um diff contra o banco.
- No PUT, um valor antigo reenviado pelo formulário igual ao que a resposta mostrou mantém o valor salvo (tipo do gasto, lucro). Se a lógica de derivação mudar, o formulário atual passa a sobrescrever os dados.

In the code:
- campos antigos: metodo_rateio/metodoRateio (gastos), margem_lucro/margemLucro (receitas), margemRealizada (vendas), breakEven, lucroEstimado/margemProjetada (simulação), POST /receitas/:id/preco-venda
- lista completa: docs/api.md, seção "Mudanças de contrato do épico E7"
- schemas locais: test/contrato.e2e-spec.ts; cópia do frontend em test/contrato/ (commit b4ebbd9)
