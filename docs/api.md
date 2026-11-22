# API

Contrato HTTP do monolito. Ele é **o mesmo dos microsserviços**, que o frontend ([`lucroai-frontend`](https://github.com/victorschmidt21/lucroai-frontend)) já consome: mesmas rotas, mesmos métodos e mesmos nomes de campo, inclusive os em `snake_case`. A tabela parte de `docs/api-integration.md` do frontend, e os schemas Zod das respostas ficam em `lucroai-frontend/src/shared/api/contracts/`.

**Regra de ouro: o frontend não pode precisar de mudança.** Não renomeie campo, não troque método, não mude status de sucesso. Campo novo só se for aditivo (o frontend ignora o que não conhece). Mudança que quebra o contrato pede uma issue no frontend antes.

Fórmulas e regras de cada rota estão em [business-rules.md](business-rules.md).

## Convenções

| Item | Regra |
| --- | --- |
| Base | `http://localhost:3100` (local). Swagger em `/docs`. |
| Versão | **sem prefixo**: `/insumos`, não `/v1/insumos` (sem `enableVersioning`). |
| Corpo da resposta | **JSON puro** do recurso ou da lista, sem envelope `{ data, links }`. O `unwrap()` do frontend usa o corpo como está quando não há `data` e `links`. |
| Listas | array completo, **sem paginação** e sem busca por texto (o frontend filtra no cliente). |
| `DELETE` | 204 sem corpo. |
| `POST` de criação | 201. `POST` de ação ou cálculo (`/auth/login`, `/simular`, `/preco-venda`, `/entrada`) segue o status de hoje, conferido na coluna "Sucesso". |
| Ids | inteiros (`autoincrement`). Parâmetro de rota inválido → 400 (`ParseIntPipe`). |
| Datas | ISO 8601 em UTC (`2026-06-01T07:00:00.000Z`). |
| Dinheiro e quantidade | `number`, já arredondado pelo backend na resposta: 6 casas no custo do insumo, 4 no custo unitário, preço e frações, 2 nos totais em reais (BE-23, [business-rules.md](business-rules.md#arredondamento)). |
| Margem | fração (`0.6` = 60%). |
| Campo sem valor | **omitido** ou **`null`**, conforme o recurso (ver [Respostas](#respostas)). Não troque um pelo outro: os schemas do frontend distinguem `.optional()` de `.nullable()`. |
| Empresa | vem do token. O cliente nunca envia `empresaId`. Recurso de outra empresa → 404. |
| Autenticação | `Authorization: Bearer <jwt>` em todas as rotas, menos as marcadas como públicas. Não existe rota `/internal`. |

## Rotas

"Sucesso" é o status HTTP de hoje. As rotas marcadas **nova** não existem nos microsserviços e são só aditivas.

| Módulo | Método e rota | Corpo | Resposta | Sucesso | Issue |
| --- | --- | --- | --- | --- | --- |
| — | `GET /health` (pública) | — | `{ status, database }` | 200 | BE-01 |
| `auth` | `POST /auth/empresa` (pública) | `{ nome_empresa, cnpj?, segmento?, nome_usuario?, email, senha }` | `{ sub, email, nome, empresa, access_token }` | 201 | BE-06 |
| `auth` | `POST /auth/login` (pública) | `{ email, senha }` | `{ access_token }` | 200 | BE-06 |
| `insumos` | `GET /insumos` | — | `Insumo[]` (por nome) | 200 | BE-07 |
| `insumos` | `GET /insumos/:id` | — | `Insumo` | 200 | BE-07 |
| `insumos` | `POST /insumos` | `{ nome, quantidadeBaseCusto, unidade, valorPago, quantidadeDisponivelInicial? }` | `Insumo` | 201 | BE-07 |
| `insumos` | `PATCH /insumos/:id` | `{ nome?, quantidadeBaseCusto?, unidade?, valorPago?, precoMercado? }` | `Insumo` | 200 | BE-07, BE-29 |
| `insumos` | `DELETE /insumos/:id` | — | vazio | 204 | BE-07 |
| `insumos` | `GET /insumos/:id/compras` (**nova**) | — | `CompraInsumo[]` (mais recentes primeiro) | 200 | BE-29 |
| `insumos` | `POST /insumos/:id/compras` (**nova**) | `{ quantidade, valorTotal, observacao? }` | `CompraInsumo` | 201 | BE-29 |
| `gastos-indiretos` | `GET /gastos-indiretos` | — | `GastoIndireto[]` (id decrescente) | 200 | BE-08 |
| `gastos-indiretos` | `GET /gastos-indiretos/:id` | — | `GastoIndireto` | 200 | BE-08 |
| `gastos-indiretos` | `POST /gastos-indiretos` | `{ descricao, valor, tipo }` (ou o legado `metodo_rateio` no lugar de `tipo`) | `GastoIndireto` | 201 | BE-08, BE-26 |
| `gastos-indiretos` | `PUT /gastos-indiretos/:id` | `{ descricao?, valor?, tipo?, metodo_rateio? }` | `GastoIndireto` | 200 | BE-08, BE-26 |
| `gastos-indiretos` | `DELETE /gastos-indiretos/:id` | — | vazio | 204 | BE-08 |
| `receitas` | `GET /receitas` | — | `Receita[]` (`dataCriacao` decrescente) | 200 | BE-09, BE-28 |
| `receitas` | `GET /receitas/:id` | — | `Receita` | 200 | BE-09, BE-28 |
| `receitas` | `POST /receitas` | `{ nome, rendimento, unidadeRendimento, uso_por_lote?, embalagem_por_unidade?, perda_percentual?, lucro_percentual?, margem_lucro? (legado), insumos: [{ insumo_id, quantidade }] }` | `Receita` | 201 | BE-09, BE-27 |
| `receitas` | `PUT /receitas/:id` | os mesmos campos, todos opcionais; `lucro_percentual: null` (ou `margem_lucro: null`) volta ao lucro padrão | `Receita` | 200 | BE-09, BE-27 |
| `receitas` | `DELETE /receitas/:id` | — | vazio | 204 | BE-09 |
| `receitas` | `GET /receitas/:id/custo` | — | `ReceitaCusto` | 200 | BE-10 |
| `receitas` | `POST /receitas/:id/custo/simular` | `{ quantidadeLotes }` | `ReceitaCusto` | 201 | BE-10 |
| `receitas` | `POST /receitas/:id/simular` | `{ novoCusto?, novoPreco?, volume?, canalId? }` | `SimulacaoCenario` | 201 | BE-10, BE-31 |
| `receitas` | `POST /receitas/:id/preco-venda` | `{ margem_lucro }` | `PrecoVenda` | 201 | BE-10 |
| `estoque` | `GET /estoque/insumos` (**nova**) | — | `Estoque[]`, um por insumo da empresa | 200 | BE-11 |
| `estoque` | `GET /estoque/insumos/:id` | — | `Estoque` | 200 | BE-11 |
| `estoque` | `POST /estoque/insumos/:id/entrada` | `{ quantidade, observacao? }` | `Estoque` | 201 | BE-11 |
| `estoque` | `PATCH /estoque/insumos/:id/minimo` (**nova**) | `{ quantidadeMinima }` | `Estoque` | 200 | BE-11 |
| `estoque` | `GET /estoque/insumos/:id/movimentacoes` | — | `MovimentacaoEstoque[]` (mais recentes primeiro) | 200 | BE-11 |
| `estoque` | `GET /estoque/produtos` (**nova**) | — | `EstoqueProduto[]` | 200 | BE-12 |
| `producoes` | `GET /producoes?receitaId=` | — | `Producao[]` (`dataProducao` decrescente) | 200 | BE-12 |
| `producoes` | `GET /producoes/:id` | — | `Producao` | 200 | BE-12 |
| `producoes` | `POST /producoes` | `{ receita_id, quantidade, gasto_indireto_ids? }` | `Producao` | 201 | BE-12, BE-30 |
| `vendas` | `GET /vendas?status=&dataInicio=&dataFim=` | — | `Venda[]` (`dataVenda` decrescente) | 200 | BE-13 |
| `vendas` | `GET /vendas/resumo` (**nova**) | — | `ResumoVendas` | 200 | BE-31 |
| `vendas` | `GET /vendas/:id` | — | `Venda` | 200 | BE-13 |
| `vendas` | `POST /vendas` | `{ canal_id?, itens: [{ receita_id, quantidade, preco_unitario_real }] }` | `Venda` | 201 | BE-13, BE-30 |
| `vendas` | `PATCH /vendas/:id/status` | `{ status }` | `Venda` | 200 | BE-13 |
| `configuracao-custos` | `GET /configuracao-custos` (**nova**) | — | `ConfiguracaoCustos` | 200 | BE-24 |
| `configuracao-custos` | `PUT /configuracao-custos` (**nova**) | `{ baseRateio?, capacidadeMensal?, lucroPadrao?, impostoPercentual?, taxaMaquininha? }` | `ConfiguracaoCustos` | 200 | BE-24 |
| `canais` | `GET /canais` (**nova**) | — | `CanalVenda[]` | 200 | BE-25 |
| `canais` | `POST /canais` (**nova**) | `{ nome, comissaoPercentual, ativo? }` | `CanalVenda` | 201 | BE-25 |
| `canais` | `PUT /canais/:id` (**nova**) | `{ nome?, comissaoPercentual?, ativo? }` | `CanalVenda` | 200 | BE-25 |
| `canais` | `DELETE /canais/:id` (**nova**) | — | — | 204 | BE-25 |

Observações:

- Os corpos misturam convenções: insumos, custo e simulação usam `camelCase` (`quantidadeBaseCusto`, `quantidadeLotes`, `novoPreco`); gastos, receitas, produções e vendas usam `snake_case` (`metodo_rateio`, `margem_lucro`, `receita_id`, `preco_unitario_real`). As respostas são `camelCase`, menos `ReceitaCusto` e `PrecoVenda`. **Mantenha os nomes como estão**: no DTO, o nome da propriedade é o nome do campo do JSON.
- `POST /auth/empresa`: o `CreateEmpresaDto` atual exige `cnpj` e `nome_usuario`; a BE-06 os torna opcionais, o que é compatível (o banco já aceita `null`, e o payload os devolve como `null`). Textos são aparados (vazio = sem valor), com os limites das colunas: `nome_empresa` até 100, `cnpj` até 18, `segmento`, `nome_usuario` e `email` até 80; `senha` com no mínimo 6.
- `POST /auth/login` e `POST /auth/empresa`: `email` é aparado e passado para minúsculas antes da validação (`@IsEmail`).
- `POST /insumos` e `PATCH /insumos/:id`: `nome` aparado, não vazio e com até 80 caracteres; `quantidadeBaseCusto ≥ 0.000001`; `valorPago ≥ 0`; `unidade` do enum `UnidadeMedida`; `quantidadeDisponivelInicial ≥ 0` só no `POST` (no `PATCH` → 400). `DELETE` de insumo usado em receita → 409 `INSUMO_EM_USO`.
  - **Muda (BE-29):** o `POST` cria também a compra inicial. O `PATCH` aceita `precoMercado` (≥ 0 ou `null`, por unidade do insumo), o preço de mercado informado sem compra; `null` volta ao último custo. Sem `precoMercado`, um `valorPago` ou `quantidadeBaseCusto` diferente do salvo informa o preço de mercado `valorPago / quantidadeBaseCusto` (o formulário atual continua mudando o preço). Ver [Insumos](business-rules.md#insumos).
- `POST /insumos/:id/compras` (BE-29): `quantidade ≥ 0.000001` (na unidade do insumo), `valorTotal ≥ 0`, `observacao` opcional, aparada, até 200 (vazia vira `null`). Dá entrada no estoque e recalcula o custo médio na mesma transação ([Compras de insumo](business-rules.md#compras-de-insumo)). Insumo de outra empresa → 404 `INSUMO_NAO_ENCONTRADO`, também no `GET`.
- `POST /gastos-indiretos` e `PUT /gastos-indiretos/:id`: `descricao` aparada, não vazia e com até 100 caracteres; `valor ≥ 0`. Gasto de outra empresa → 404 `GASTO_INDIRETO_NAO_ENCONTRADO`.
  - **Muda (BE-26):** `tipo` (enum `TipoGasto`: `MENSAL`, `POR_UNIDADE`, `PERCENTUAL_VENDA`) substitui o `metodo_rateio`. Para o frontend atual não quebrar, o `metodo_rateio` (`FIXO`, `PROPORCIONAL`, `POR_UNIDADE`) continua aceito: `FIXO` e `PROPORCIONAL` viram `MENSAL`, `POR_UNIDADE` continua `POR_UNIDADE`. No `POST`, um dos dois é obrigatório (sem nenhum → 400 no campo `tipo`); se vierem os dois, vale o `tipo`. No `PUT`, um `metodo_rateio` igual ao `metodoRateio` que a resposta mostra para o tipo salvo mantém o tipo (o formulário atual reenvia o que recebeu; um `PERCENTUAL_VENDA` não vira `MENSAL` só por isso).
  - `PERCENTUAL_VENDA` com `valor` fora de `0 ≤ valor < 1` (fração do preço: `0.12` = 12%) → 400 `DADOS_INVALIDOS` com `details` no campo `valor`, conferido depois de mesclar o `PUT` com o salvo.
- `POST /receitas` e `PUT /receitas/:id`: `nome` aparado, não vazio e com até 80 caracteres; `rendimento` (unidades boas por lote) inteiro > 0; `unidadeRendimento` do enum `UnidadeMedida`; `insumos` não vazio, com `insumo_id` inteiro > 0 e `quantidade ≥ 0.001`. Insumo de outra empresa → 404 `INSUMO_NAO_ENCONTRADO`; receita de outra empresa → 404 `RECEITA_NAO_ENCONTRADA`. `DELETE` de receita usada em produção ou venda → 409 `RECEITA_EM_USO`.
  - **Muda (BE-27):** campos novos da [ficha técnica](business-rules.md#ficha-técnica), todos opcionais e com padrão (o formulário atual continua funcionando): `uso_por_lote` > 0 (padrão 1), `embalagem_por_unidade` ≥ 0 (padrão 0), `perda_percentual` de 0 até menos de 1 (padrão 0) e `lucro_percentual` de 0 até menos de 1 (fração do **preço**; omitido ou `null` usa o `lucroPadrao` da empresa). Perda ou lucro ≥ 1 → 400 `DADOS_INVALIDOS` com `details` no campo, conferido depois de mesclar o `PUT` com o salvo.
  - **Muda (BE-27):** `margem_lucro` (markup) deixa de ser gravada, mas continua aceita (`≥ 0`) e vira `lucro_percentual = margem ÷ (1 + margem)`, que dá o mesmo preço sugerido; se vierem os dois, vale o `lucro_percentual`. `margem_lucro: null` volta ao lucro padrão (antes removia margem e preço).
- `POST /receitas/:id/custo/simular`: `quantidadeLotes` inteiro > 0. `POST /receitas/:id/simular`: `novoCusto` e `novoPreco` > 0 e `volume` inteiro > 0, todos opcionais (omitidos usam o custo unitário e o preço sugerido calculados na leitura e o rendimento); sem preço → 400 `RECEITA_SEM_PRECO`, preço 0 → 400 `PRECO_INVALIDO`. `POST /receitas/:id/preco-venda`: `margem_lucro ≥ 0` (markup sobre o custo, como hoje). Desde a BE-27 o custo é sempre calculado, então o 400 `RECEITA_SEM_CUSTO` não acontece mais. As quatro rotas não gravam nada e dão 404 `RECEITA_NAO_ENCONTRADA` para receita de outra empresa. **Muda (BE-28):** o `precoSugerido` padrão da simulação é o preço do Balcão; `preco-venda` continua com o markup do corpo. **Novo (BE-31):** `canalId` opcional na simulação, inteiro > 0 (camelCase, como o resto do corpo): o canal simulado, ativo ou não; omitido → Balcão; canal de outra empresa → 404 `CANAL_VENDA_NAO_ENCONTRADO`. O preço padrão passa a ser o sugerido **no canal** (no Balcão, o `precoSugerido`); sem preço possível no canal → 400 `RECEITA_SEM_PRECO`. Ver [Simulação e ponto de equilíbrio](business-rules.md#simulação-e-ponto-de-equilíbrio).
- `GET /vendas/resumo` (BE-31): sem parâmetros; usa as vendas `CONCLUIDA` da empresa dos últimos 30 dias. Sem vendas na janela, responde 200 com `pontoEquilibrio: { valor: null, motivo: "SEM_VENDAS" }`.
- `GET /producoes?receitaId=`: `receitaId` inteiro > 0 opcional; inválido → 400 `DADOS_INVALIDOS`. Receita de outra empresa só devolve lista vazia.
- `POST /producoes`: `receita_id` e `quantidade` (lotes) inteiros > 0; `gasto_indireto_ids` opcional, lista de inteiros > 0 (omitido rateia todos os gastos da empresa; `[]` não rateia nenhum; ids repetidos contam uma vez). Receita de outra empresa → 404 `RECEITA_NAO_ENCONTRADA`; gasto de outra empresa → 404 `GASTO_INDIRETO_NAO_ENCONTRADO`; produção de outra empresa no `GET /producoes/:id` → 404 `PRODUCAO_NAO_ENCONTRADA`. Saldo de insumo insuficiente não bloqueia (lacuna 10). **Muda (BE-30):** o custo é o dos ingredientes ao custo médio mais os gastos `MENSAL` pelo uso de forno, uma vez só; só os gastos `MENSAL` geram rateio (`POR_UNIDADE` e `PERCENTUAL_VENDA` da lista são ignorados). Ver [Produções](business-rules.md#produções).
- `GET /vendas`: `status` do enum `StatusVenda`; `dataInicio` e `dataFim` em ISO 8601 com data e hora (a web envia o início e o fim do dia local), comparados como instantes (`dataVenda ≥ dataInicio` e `≤ dataFim`). Qualquer filtro inválido → 400 `DADOS_INVALIDOS`; só a data (`2026-11-19`) ou data sem fuso também. Venda de outra empresa no `GET /vendas/:id` e no `PATCH` → 404 `VENDA_NAO_ENCONTRADA`.
- `POST /vendas`: `itens` não vazio; `receita_id` e `quantidade` inteiros > 0; `preco_unitario_real` > 0 com até 2 casas. Receita de outra empresa → 404 `RECEITA_NAO_ENCONTRADA`. Não confere o estoque. **Novo (BE-30):** `canal_id` opcional, inteiro > 0 (`snake_case`, como o resto do corpo): o canal da venda, ativo ou não; omitido → Balcão. Canal de outra empresa → 404 `CANAL_VENDA_NAO_ENCONTRADO`. Ver [Vendas](business-rules.md#vendas).
- `PUT /configuracao-custos` (BE-24): campos em `camelCase`, todos opcionais (omitido mantém o valor salvo); `baseRateio` do enum `BaseRateio`; números finitos. Depois de mesclar com o salvo, `capacidadeMensal` precisa ser > 0 e `lucroPadrao`, `impostoPercentual` e `taxaMaquininha` entre 0 e 1 (frações do preço); fora disso → 400 `DADOS_INVALIDOS` com um `details` por campo. A configuração é sempre a da empresa do token.
- `/canais` (BE-25): campos em `camelCase`. `nome` texto aparado, não vazio, até 100 caracteres; `comissaoPercentual` número finito entre 0 e 1 (fração do preço); `ativo` booleano, omitido no `POST` → `true`. No `PUT`, campo omitido mantém o valor salvo, e ativar ou desativar é `{ "ativo": true | false }` (vale também para o Balcão). `balcao` só de leitura. `GET /canais` lista em ordem de criação (Balcão primeiro). Excluir o Balcão → 422 `CANAL_BALCAO_NAO_EXCLUIVEL`; canal de outra empresa no `PUT` e no `DELETE` → 404 `CANAL_VENDA_NAO_ENCONTRADO`.
- `PATCH /vendas/:id/status`: `status` do enum `StatusVenda`. Venda já `CONCLUIDA` ou `CANCELADA` → 422 `VENDA_FINALIZADA`; `PENDENTE` → `PENDENTE` → 422 `TRANSICAO_INVALIDA`; concluir sem saldo de produto acabado → 422 `ESTOQUE_INSUFICIENTE` e nada é gravado (a venda continua `PENDENTE`).

## Teste de contrato

`test/contrato.e2e-spec.ts` (BE-15) é a barreira contra quebra do contrato. Ele roda com `npm run test:e2e` (local no `lucroai_test`; no CI, no Postgres de serviço) e cria os próprios dados com e-mails únicos, então não depende do seed nem de banco limpo. Percorre o fluxo principal (cadastro e login; insumo, gasto e receita; custo, simulação e preço; entrada de estoque e produção; venda, conclusão e conclusão recusada sem saldo), chama todas as rotas da tabela acima, confere o isolamento entre duas empresas (404) e o 401 sem token, e valida cada resposta com os schemas Zod do frontend. Erros são validados contra o [formato padrão](#erros); as rotas novas (`/estoque/produtos`, cadastro de empresa, compras de insumo, `/vendas/resumo`) e os campos novos da simulação (BE-31) contra schemas locais no próprio teste.

Os schemas ficam em `test/contrato/`, copiados de `lucroai-frontend/src/shared/api/contracts/` (sem os `*.test.ts`). Cada arquivo diz o commit de origem e a data da cópia, e a única mudança é o `.js` nos imports relativos. Para atualizar, com o frontend clonado ao lado:

```bash
FE=../lucroai-frontend; COMMIT=$(git -C $FE log -1 --format=%h -- src/shared/api/contracts/); HOJE=$(date +%F)
for f in auth catalog enums operations recipe sales; do
  { echo "// Cópia de lucroai-frontend/src/shared/api/contracts/$f.ts (commit $COMMIT),"
    echo "// copiada em $HOJE. Não edite: atualize pelo procedimento de docs/api.md."
    echo '// Única mudança: imports relativos com `.js` (ESM nodenext).'; echo
    sed "s#from './enums'#from './enums.js'#" $FE/src/shared/api/contracts/$f.ts; } > test/contrato/$f.ts
done
npm run format && npm run test:e2e
```

Arquivo novo em `contracts/` entra na lista do `for`. Se o teste falhar depois da cópia, corrija a API, não a cópia.

## Respostas

"omitido" = sem valor, o campo não vem no JSON; "`null`" = vem como `null`. Campos marcados **novo** são aditivos.

| Tipo | Campos |
| --- | --- |
| `Insumo` | `id`, `empresaId`, `nome`, `quantidadeBaseCusto`, `quantidadeDisponivel`, `quantidadeMinima` (**novo**), `unidade`, `valorPago`, `custoUnitario`, `precoUnitario` (alias de `custoUnitario`), `dataCriacao`. **Muda (BE-29):** `custoUnitario` é o custo de reposição (`precoMercado ?? ultimoCusto`), e `valorPago`/`quantidadeBaseCusto` são o último preço de referência (cadastro, compra ou `PATCH`). **Novos (BE-29):** `custoMedio`, `ultimoCusto`, `custoReposicao` (6 casas), `precoMercado` e `precoMercadoData` (`null` sem preço de mercado) |
| `CompraInsumo` (**novo**, BE-29) | `id`, `insumoId`, `quantidade`, `valorTotal`, `custoUnitario` (`valorTotal / quantidade`, 6 casas), `observacao` (`null`), `dataCompra` |
| `GastoIndireto` | `id`, `empresaId`, `descricao`, `valor`, `tipo` (**novo**, BE-26: `MENSAL \| POR_UNIDADE \| PERCENTUAL_VENDA`), `metodoRateio` (**legado**, derivado do `tipo` para o schema atual do frontend: `FIXO` para `MENSAL` e `PERCENTUAL_VENDA`, `POR_UNIDADE` para `POR_UNIDADE`; sai quando o frontend passar a usar o `tipo`, BE-33) |
| `Receita` | `id`, `empresaId`, `nome`, `rendimento` (inteiro, unidades boas por lote), `unidadeRendimento`, `custoProducao`, `custoUnitario`, `margemLucro`, `precoSugerido`, `usoPorLote` (**novo**), `embalagemPorUnidade` (**novo**), `perdaPercentual` (**novo**), `lucroPercentual` (**novo**, omitido quando a receita usa o lucro padrão), `dataCriacao`, `itens: [{ insumoId, quantidade, custoCalculado }]`. **Muda (BE-27):** custo e preço são calculados na leitura, com os custos atuais (não são mais gravados), e por isso sempre vêm; o preço usa o lucro sobre o preço da receita ou o `lucroPadrao` da empresa. `margemLucro` é **legada**, derivada do lucro (`lucro ÷ (1 − lucro)`), e `margemLucro`/`precoSugerido` só são omitidos quando não há preço possível. **Muda (BE-28):** `custoUnitario` inclui embalagem e perda, `custoProducao = custoUnitario × rendimento`, e `precoSugerido` é o preço do **Balcão** (com imposto, maquininha, gastos `PERCENTUAL_VENDA` e lucro; omitido com percentuais ≥ 100%). **Novos (BE-28):** `custo: { ingredientesLote, gastosMensaisLote, ingredientes, gastosMensais, gastosPorUnidade, embalagem, perdas, unitario }` (lote com 2 casas, por unidade com 4) e `precos: [{ canalId, canal, balcao, percentuais, preco, motivo, composicao }]`, um por canal **ativo** em ordem de criação: `preco` e `motivo` sempre presentes (`preco: null` com `motivo: "PERCENTUAIS_ACIMA_DE_100"`; com preço, `motivo: null`), `composicao` com `{ valor, fracao }` para `ingredientes`, `gastosMensais`, `gastosPorUnidade`, `embalagem`, `perdas`, `imposto`, `taxaCanal`, `gastosPercentuais` e `lucro` (ou `null` sem preço). Ver [Preço por canal](business-rules.md#preço-por-canal) |
| `ReceitaCusto` | `quantidade_lotes`, `total_unidades`, `custo_invisivel`, `custo_total_producao`, `custo_por_unidade`. **Muda (BE-28):** `custo_por_unidade` é o custo novo (com embalagem e perda) e `custo_total_producao = custo_por_unidade × total_unidades`; `custo_invisivel` continua só com os gastos `MENSAL` e `POR_UNIDADE` |
| `SimulacaoCenario` | `custoUnitario`, `precoVenda`, `volume`, `lucroEstimado`, `margemProjetada` (fração), `breakEven` (**legado**). **Muda (BE-31):** `lucroEstimado` é o `lucroMes` e `margemProjetada` é o `lucroReal` (os dois agora descontam imposto, taxa do canal e gastos `PERCENTUAL_VENDA`); `breakEven` (`ceil(custo × volume ÷ preço)`) continua só porque o schema atual do frontend o exige e sai com a BE-33, no lugar do `pontoEquilibrio`. **Novos (BE-31):** `canalId`, `canal` (nome), `custoSemGastosMensais` (4 casas), `percentuaisSemLucro` (fração, 4 casas), `margemContribuicao` (MCu, 4 casas), `lucroPorUnidade` (4 casas), `lucroReal` (fração do preço, 4 casas, pode ser negativo), `lucroMes` (2 casas), `gastosMensais` (2 casas) e `pontoEquilibrio: { unidades, motivo }` (unidades inteiras por mês; `unidades: null` com `motivo: "MARGEM_NEGATIVA"`; com unidades, `motivo: null`) |
| `PrecoVenda` | `custo_total_unitario`, `preco_sugerido`, `lucro_por_unidade` |
| `Estoque` | `id`, `insumoId`, `quantidadeDisponivel` (pode ser negativa), `quantidadeMinima`, `dataAlteracao` (`null` sem alteração; no monolito vem preenchida desde a criação, pelo `@updatedAt`). O `id` nunca é 0: todo insumo nasce com o registro de estoque (BE-07) |
| `MovimentacaoEstoque` | `id`, `insumoId`, `tipo` (`ENTRADA \| SAIDA`), `origem` (`COMPRA \| PRODUCAO`), `quantidade`, `referenciaId` (`null`; id da produção na saída por produção e, **novo (BE-29)**, id da compra na entrada por compra), `observacao` (`null`, **novo**), `dataMovimentacao` |
| `EstoqueProduto` (**novo**) | `receitaId`, `quantidadeDisponivel`, `dataAlteracao`; um por receita que já teve produção, em ordem de `receitaId` |
| `Producao` | `id`, `receitaId`, `empresaId`, `quantidade` (lotes), `totalUnidades` (**novo**), `custoTotal` (`null`), `custoUnitario` (`null`), `dataProducao`, `rateios: [{ gastoIndiretoId (o id continua depois da exclusão do gasto), descricao (**novo**), valorRateado }]`. Na resposta, `custoTotal` e `custoUnitario` sempre vêm preenchidos. **Muda (BE-30):** `custoTotal` = ingredientes ao custo médio + gastos mensais do forno (sem somar os gastos duas vezes), e `rateios` só tem gastos `MENSAL` |
| `Venda` | `id`, `empresaId`, `total` (`null`), `status`, `dataVenda`, `canalId` (**novo**, BE-30; `null` nas vendas antigas e com o canal excluído), `itens: [{ id, vendaId, receitaId, quantidade, precoUnitarioReal, custoUnitario (`null`), margemRealizada (`null`, legada), lucroReal (**novo**, BE-30: fração do preço com 4 casas, pode ser negativo; `null` nas vendas antigas) }]`. **Muda (BE-30):** `custoUnitario` é o custo da receita com o custo médio dos insumos |
| `ResumoVendas` (**novo**, BE-31) | `dias` (30), `dataInicio` (início da janela, ISO), `vendas` (vendas concluídas na janela), `receita` (2 casas), `margemContribuicao` (2 casas), `indiceMargemContribuicao` (fração com 4 casas; `null` sem vendas), `gastosMensais` (2 casas), `pontoEquilibrio: { valor, motivo }` (reais por mês, 2 casas; `valor: null` com `motivo` `SEM_VENDAS` ou `MARGEM_NEGATIVA`; com valor, `motivo: null`) |
| `ConfiguracaoCustos` (**novo**, BE-24) | `empresaId`, `baseRateio` (`FORNADAS \| MINUTOS`), `capacidadeMensal`, `lucroPadrao`, `impostoPercentual`, `taxaMaquininha` (frações, sem arredondar) |
| `CanalVenda` (**novo**, BE-25) | `id`, `empresaId`, `nome`, `comissaoPercentual` (fração, sem arredondar), `ativo`, `balcao` (o canal padrão, que não pode ser excluído) |
| Login | `{ access_token }` |
| Cadastro de empresa | `{ sub, email, nome, empresa: { id, nome, cnpj, segmento }, access_token }` |

Payload do JWT (HS256, 4 h): `{ sub, email, nome, empresa: { id, nome, cnpj, segmento }, iat, exp }`. `nome`, `cnpj` e `segmento` podem ser `null`.

## Erros

Formato único, gerado pelo `AllExceptionsFilter` (`src/shared/infra/http/`), o mesmo da Urbizzi:

```json
{
  "statusCode": 404,
  "code": "INSUMO_NAO_ENCONTRADO",
  "message": "Insumo não encontrado",
  "path": "/insumos/99",
  "timestamp": "2026-11-19T12:00:00.000Z"
}
```

- `details` aparece só na validação (e num `InvalidInputError` que o receba): `[{ "field": "itens.0.quantidade", "messages": ["..."] }]`. O `message` é sempre "Os dados enviados são inválidos"; as `messages` de cada campo são as do `class-validator` (em inglês, a menos que o DTO defina `message` no decorator).
- O frontend lê `statusCode` e `message` (string ou lista); `error` é opcional para ele e não é enviado. `code` é novo e estável, para quem quiser tratar.
- Mensagens em português. Erro inesperado → 500 com mensagem genérica, sem stack nem texto interno.

| HTTP | Classe (`src/shared/domain/errors/domain.error.ts`) | Quando | `code` (exemplos) |
| --- | --- | --- | --- |
| 400 | `ValidationPipe` | corpo, query ou parâmetro inválido | `DADOS_INVALIDOS` |
| 400 | `InvalidInputError` | entrada que só o service confere | `PRECO_INVALIDO`, `RECEITA_SEM_CUSTO`, `RECEITA_SEM_PRECO`, `RENDIMENTO_INVALIDO` |
| 400 | exceção do Nest | `ParseIntPipe`, JSON malformado | `DADOS_INVALIDOS` |
| 401 | `UnauthorizedError` / `JwtAuthGuard` | sem token (`NAO_AUTENTICADO`, "Autenticação necessária"), token inválido ou expirado (`TOKEN_INVALIDO`, "Token inválido ou expirado"), credenciais inválidas | `NAO_AUTENTICADO`, `TOKEN_INVALIDO`, `CREDENCIAIS_INVALIDAS` |
| 403 | `ForbiddenError` | reservado; outra empresa responde 404 | — |
| 404 | `NotFoundError` | inexistente **ou de outra empresa** | `<ENTIDADE>_NAO_ENCONTRADO` |
| 404 | exceção do Nest | rota inexistente | `RECURSO_NAO_ENCONTRADO` |
| 409 | `ConflictError` | duplicidade ou registro em uso | `CNPJ_JA_CADASTRADO`, `EMAIL_JA_CADASTRADO`, `INSUMO_EM_USO`, `RECEITA_EM_USO` |
| 422 | `BusinessRuleError` | entrada válida que viola uma regra | `ESTOQUE_INSUFICIENTE`, `VENDA_FINALIZADA`, `TRANSICAO_INVALIDA` |
| 429 | `@nestjs/throttler` | limite de tentativas do `AuthController` (login e cadastro): 10 por minuto por IP e e-mail | `MUITAS_REQUISICOES` |
| 503 | `GET /health` | banco fora do ar | `SERVICO_INDISPONIVEL` |
| 500 | qualquer outro erro | falha inesperada | `ERRO_INTERNO` |

As exceções que o próprio Nest lança em inglês nunca repassam o texto original: viram o `code` e a mensagem padrão do status, em português. Um `P2002`/`P2025` do Prisma que escape do repositório vira 409 `REGISTRO_DUPLICADO`/404 `RECURSO_NAO_ENCONTRADO`, mas o repositório deve traduzi-los antes num erro com `code` próprio.

Mensagens que o frontend reconhece pelo texto e que **não podem mudar**: as de estoque insuficiente começam com "Estoque insuficiente" (`isEstoqueInsuficiente`). As mensagens de negócio de hoje ("Insumo não encontrado", "Venda já finalizada não pode ser alterada", "CNPJ já cadastrado"...) são mantidas.
