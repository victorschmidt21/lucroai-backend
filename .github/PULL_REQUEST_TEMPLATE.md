Closes #<!-- número da issue -->

## Objetivo

<!-- O que este PR entrega e por quê, em 2 a 4 frases. Se for um PR empilhado, diga sobre qual branch ele está. -->

## O que mudou

<!-- Lista das principais mudanças (módulos, rotas, tabelas, configuração). -->

-

## Testes realizados

- [ ] `npm run lint` sem erros
- [ ] `npm run format:check` ok
- [ ] `npm run build` ok
- [ ] `npm test` passando (unitários novos/alterados: <!-- quais -->)
- [ ] `npm run test:e2e` passando, se mexeu em rota, banco ou contrato
- [ ] Testado manualmente com `npm run start:dev` ou `docker compose up` (descreva abaixo, se aplicável)

<!-- Passos manuais executados e resultado. -->

## Contrato e números

- [ ] Rotas, corpos e nomes de campo iguais aos de `docs/api.md` (inclusive `snake_case` e `null` × omitido); campos novos só aditivos
- [ ] Respostas conferidas com os schemas Zod do frontend (`lucroai-frontend/src/shared/api/contracts/`)
- [ ] Fórmulas e arredondamentos iguais aos de `docs/business-rules.md`; mudança de número só quando a issue corrige uma lacuna
- [ ] Nenhum acesso entre empresas (recurso de outra empresa → 404)

## Decisões tomadas

<!-- Escolhas de design, alternativas descartadas e desvios em relação à issue ou aos docs. Escreva "Nenhuma" se não houver. -->

## Documentação

- [ ] Rotas documentadas no Swagger (`@ApiTags`, resumo em JSDoc, `@example` nos DTOs) e conferidas em `/docs`
- [ ] `docs/api.md` e `docs/business-rules.md` atualizados se mudou rota ou regra
- [ ] Mapa de módulos (`docs/architecture.md`) atualizado se criou módulo, tabela ou dependência entre módulos
- [ ] Tabela "O que já existe em `src/shared/`" do `AGENTS.md` atualizada
- [ ] `.env.example` e README atualizados se criou variável de ambiente

## Checklist de padrões

- [ ] Segue a estrutura de módulo: funções puras em `domain/`, repositório concreto, controller fino
- [ ] Só o repositório acessa o Prisma, e só as tabelas do próprio módulo
- [ ] Outros módulos usados só pelos services exportados, sem ciclo
- [ ] Erros de negócio com as classes de `domain.error.ts` e `code` estável
- [ ] Migration nova revisada (sem editar migrations antigas)
- [ ] Sem senha, token ou segredo em logs, erros ou respostas
- [ ] Dependência nova justificada em "Decisões tomadas"
- [ ] Commits no padrão Conventional Commits
