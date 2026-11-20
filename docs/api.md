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
| Dinheiro e quantidade | `number`, já arredondado pelo backend ([business-rules.md](business-rules.md#arredondamento)). |
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
| `insumos` | `PATCH /insumos/:id` | `{ nome?, quantidadeBaseCusto?, unidade?, valorPago? }` | `Insumo` | 200 | BE-07 |
| `insumos` | `DELETE /insumos/:id` | — | vazio | 204 | BE-07 |
| `gastos-indiretos` | `GET /gastos-indiretos` | — | `GastoIndireto[]` (id decrescente) | 200 | BE-08 |
| `gastos-indiretos` | `GET /gastos-indiretos/:id` | — | `GastoIndireto` | 200 | BE-08 |
| `gastos-indiretos` | `POST /gastos-indiretos` | `{ descricao, valor, metodo_rateio }` | `GastoIndireto` | 201 | BE-08 |
| `gastos-indiretos` | `PUT /gastos-indiretos/:id` | `{ descricao?, valor?, metodo_rateio? }` | `GastoIndireto` | 200 | BE-08 |
| `gastos-indiretos` | `DELETE /gastos-indiretos/:id` | — | vazio | 204 | BE-08 |
| `receitas` | `GET /receitas` | — | `Receita[]` (`dataCriacao` decrescente) | 200 | BE-09 |
| `receitas` | `GET /receitas/:id` | — | `Receita` | 200 | BE-09 |
| `receitas` | `POST /receitas` | `{ nome, rendimento, unidadeRendimento, margem_lucro?, insumos: [{ insumo_id, quantidade }] }` | `Receita` | 201 | BE-09 |
| `receitas` | `PUT /receitas/:id` | os mesmos campos, todos opcionais; `margem_lucro: null` remove a margem | `Receita` | 200 | BE-09 |
| `receitas` | `DELETE /receitas/:id` | — | vazio | 204 | BE-09 |
| `receitas` | `GET /receitas/:id/custo` | — | `ReceitaCusto` | 200 | BE-10 |
| `receitas` | `POST /receitas/:id/custo/simular` | `{ quantidadeLotes }` | `ReceitaCusto` | 201 | BE-10 |
| `receitas` | `POST /receitas/:id/simular` | `{ novoCusto?, novoPreco?, volume? }` | `SimulacaoCenario` | 201 | BE-10 |
| `receitas` | `POST /receitas/:id/preco-venda` | `{ margem_lucro }` | `PrecoVenda` | 201 | BE-10 |
| `estoque` | `GET /estoque/insumos` (**nova**) | — | `Estoque[]`, um por insumo da empresa | 200 | BE-11 |
| `estoque` | `GET /estoque/insumos/:id` | — | `Estoque` | 200 | BE-11 |
| `estoque` | `POST /estoque/insumos/:id/entrada` | `{ quantidade, observacao? }` | `Estoque` | 201 | BE-11 |
| `estoque` | `PATCH /estoque/insumos/:id/minimo` (**nova**) | `{ quantidadeMinima }` | `Estoque` | 200 | BE-11 |
| `estoque` | `GET /estoque/insumos/:id/movimentacoes` | — | `MovimentacaoEstoque[]` (mais recentes primeiro) | 200 | BE-11 |
| `estoque` | `GET /estoque/produtos` (**nova**) | — | `EstoqueProduto[]` | 200 | BE-12 |
| `producoes` | `GET /producoes?receitaId=` | — | `Producao[]` (`dataProducao` decrescente) | 200 | BE-12 |
| `producoes` | `GET /producoes/:id` | — | `Producao` | 200 | BE-12 |
| `producoes` | `POST /producoes` | `{ receita_id, quantidade, gasto_indireto_ids? }` | `Producao` | 201 | BE-12 |
| `vendas` | `GET /vendas?status=&dataInicio=&dataFim=` | — | `Venda[]` (`dataVenda` decrescente) | 200 | BE-13 |
| `vendas` | `GET /vendas/:id` | — | `Venda` | 200 | BE-13 |
| `vendas` | `POST /vendas` | `{ itens: [{ receita_id, quantidade, preco_unitario_real }] }` | `Venda` | 201 | BE-13 |
| `vendas` | `PATCH /vendas/:id/status` | `{ status }` | `Venda` | 200 | BE-13 |

Observações:

- Os corpos misturam convenções: insumos, custo e simulação usam `camelCase` (`quantidadeBaseCusto`, `quantidadeLotes`, `novoPreco`); gastos, receitas, produções e vendas usam `snake_case` (`metodo_rateio`, `margem_lucro`, `receita_id`, `preco_unitario_real`). As respostas são `camelCase`, menos `ReceitaCusto` e `PrecoVenda`. **Mantenha os nomes como estão**: no DTO, o nome da propriedade é o nome do campo do JSON.
- `POST /auth/empresa`: o `CreateEmpresaDto` atual exige `cnpj` e `nome_usuario`; a BE-06 os torna opcionais, o que é compatível (o banco já aceita `null`, e o payload os devolve como `null`). Textos são aparados (vazio = sem valor), com os limites das colunas: `nome_empresa` até 100, `cnpj` até 18, `segmento`, `nome_usuario` e `email` até 80; `senha` com no mínimo 6.
- `POST /auth/login` e `POST /auth/empresa`: `email` é aparado e passado para minúsculas antes da validação (`@IsEmail`).
- `POST /insumos` e `PATCH /insumos/:id`: `nome` aparado, não vazio e com até 80 caracteres; `quantidadeBaseCusto ≥ 0.000001`; `valorPago ≥ 0`; `unidade` do enum `UnidadeMedida`; `quantidadeDisponivelInicial ≥ 0` só no `POST` (no `PATCH` → 400). `DELETE` de insumo usado em receita → 409 `INSUMO_EM_USO`.
- `GET /producoes?receitaId=`: `receitaId` inteiro opcional; inválido → 400.
- `GET /vendas`: `status` do enum `StatusVenda`; `dataInicio` e `dataFim` em ISO 8601 com data e hora (a web envia o início e o fim do dia local), comparados como instantes (`dataVenda ≥ dataInicio` e `≤ dataFim`). Qualquer filtro inválido → 400.

## Respostas

"omitido" = sem valor, o campo não vem no JSON; "`null`" = vem como `null`. Campos marcados **novo** são aditivos.

| Tipo | Campos |
| --- | --- |
| `Insumo` | `id`, `empresaId`, `nome`, `quantidadeBaseCusto`, `quantidadeDisponivel`, `quantidadeMinima` (**novo**), `unidade`, `valorPago`, `custoUnitario`, `precoUnitario` (alias de `custoUnitario`), `dataCriacao` |
| `GastoIndireto` | `id`, `empresaId`, `descricao`, `valor`, `metodoRateio` |
| `Receita` | `id`, `empresaId`, `nome`, `rendimento` (inteiro), `unidadeRendimento`, `custoProducao`, `custoUnitario`, `margemLucro`, `precoSugerido` (os quatro omitidos sem valor), `dataCriacao`, `itens: [{ insumoId, quantidade, custoCalculado (omitido sem valor) }]` |
| `ReceitaCusto` | `quantidade_lotes`, `total_unidades`, `custo_invisivel`, `custo_total_producao`, `custo_por_unidade` |
| `SimulacaoCenario` | `custoUnitario`, `precoVenda`, `volume`, `lucroEstimado`, `margemProjetada` (fração), `breakEven` |
| `PrecoVenda` | `custo_total_unitario`, `preco_sugerido`, `lucro_por_unidade` |
| `Estoque` | `id`, `insumoId`, `quantidadeDisponivel` (pode ser negativa), `quantidadeMinima`, `dataAlteracao` (`null` sem alteração) |
| `MovimentacaoEstoque` | `id`, `insumoId`, `tipo` (`ENTRADA \| SAIDA`), `origem` (`COMPRA \| PRODUCAO`), `quantidade`, `referenciaId` (`null`), `observacao` (`null`, **novo**), `dataMovimentacao` |
| `EstoqueProduto` (**novo**) | `receitaId`, `quantidadeDisponivel`, `dataAlteracao` |
| `Producao` | `id`, `receitaId`, `empresaId`, `quantidade` (lotes), `totalUnidades` (**novo**), `custoTotal` (`null`), `custoUnitario` (`null`), `dataProducao`, `rateios: [{ gastoIndiretoId (`null` se o gasto foi excluído), descricao (**novo**), valorRateado }]` |
| `Venda` | `id`, `empresaId`, `total` (`null`), `status`, `dataVenda`, `itens: [{ id, vendaId, receitaId, quantidade, precoUnitarioReal, custoUnitario (`null`), margemRealizada (`null`) }]` |
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
| 400 | `InvalidInputError` | entrada que só o service confere | `PRECO_INVALIDO`, `RECEITA_SEM_CUSTO` |
| 400 | exceção do Nest | `ParseIntPipe`, JSON malformado | `DADOS_INVALIDOS` |
| 401 | `UnauthorizedError` / `JwtAuthGuard` | sem token (`NAO_AUTENTICADO`, "Autenticação necessária"), token inválido ou expirado (`TOKEN_INVALIDO`, "Token inválido ou expirado"), credenciais inválidas | `NAO_AUTENTICADO`, `TOKEN_INVALIDO`, `CREDENCIAIS_INVALIDAS` |
| 403 | `ForbiddenError` | reservado; outra empresa responde 404 | — |
| 404 | `NotFoundError` | inexistente **ou de outra empresa** | `<ENTIDADE>_NAO_ENCONTRADO` |
| 404 | exceção do Nest | rota inexistente | `RECURSO_NAO_ENCONTRADO` |
| 409 | `ConflictError` | duplicidade ou registro em uso | `CNPJ_JA_CADASTRADO`, `EMAIL_JA_CADASTRADO`, `INSUMO_EM_USO`, `RECEITA_EM_USO` |
| 422 | `BusinessRuleError` | entrada válida que viola uma regra | `ESTOQUE_INSUFICIENTE`, `VENDA_FINALIZADA` |
| 429 | `@nestjs/throttler` | limite de tentativas do `AuthController` (login e cadastro): 10 por minuto por IP e e-mail | `MUITAS_REQUISICOES` |
| 503 | `GET /health` | banco fora do ar | `SERVICO_INDISPONIVEL` |
| 500 | qualquer outro erro | falha inesperada | `ERRO_INTERNO` |

As exceções que o próprio Nest lança em inglês nunca repassam o texto original: viram o `code` e a mensagem padrão do status, em português. Um `P2002`/`P2025` do Prisma que escape do repositório vira 409 `REGISTRO_DUPLICADO`/404 `RECURSO_NAO_ENCONTRADO`, mas o repositório deve traduzi-los antes num erro com `code` próprio.

Mensagens que o frontend reconhece pelo texto e que **não podem mudar**: as de estoque insuficiente começam com "Estoque insuficiente" (`isEstoqueInsuficiente`). As mensagens de negócio de hoje ("Insumo não encontrado", "Venda já finalizada não pode ser alterada", "CNPJ já cadastrado"...) são mantidas.
