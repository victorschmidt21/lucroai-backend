# Regras de negócio

Fórmulas, arredondamentos e regras do Doce Fatia. Foram conferidos no código dos microsserviços ([`GrupoDoisENG/lucroai-backend`](https://github.com/GrupoDoisENG/lucroai-backend)), e cada seção cita o arquivo de origem. Os caminhos começam em `services/` daquele repositório. Quando o `OVERVIEW.md` de lá diverge do código, vale o código.

**Os números do monolito precisam ser iguais aos dos microsserviços**, exceto onde esta página diz "muda" e cita a issue que corrige uma lacuna. O frontend mostra esses números e repete alguns cálculos nas prévias.

Cada fórmula vira uma função pura em `src/modules/<modulo>/domain/<modulo>.calculos.ts`, com teste unitário (ver [AGENTS.md](../AGENTS.md#testes)).

## Arredondamento

**Muda (BE-23): arredondar só na saída.** Os microsserviços arredondavam no meio da conta (cada item da receita com 2 casas antes da soma: 15 g × R$ 0,017 = R$ 0,255 virava R$ 0,26), e o erro crescia em produtos baratos com muitos itens. No monolito, toda a cadeia de custo e preço (custo do insumo, itens, custo invisível, custo de produção, custo unitário, preço sugerido, simulação, preço de venda, produção, margem e total da venda) é calculada **sem arredondamento intermediário**, e o banco guarda os valores exatos. Só a resposta da API arredonda, nos DTOs de saída (`to<Entidade>Dto`):

| Valor na resposta | Casas | Função | Campos |
| --- | --- | --- | --- |
| Custo por unidade-base do insumo | 6 | `round6` | `custoUnitario`, `precoUnitario`, `custoMedio`, `ultimoCusto`, `custoReposicao` e `precoMercado` do insumo (BE-29), `custoUnitario` da compra |
| Custo unitário e preço | 4 | `round4` | `custoUnitario` e `precoSugerido` da receita, as partes por unidade de `custo`, `preco` e os `valor` da `composicao` de `precos` (BE-28), `custo_por_unidade`, `custo_total_unitario`, `preco_sugerido`, `lucro_por_unidade`, `custoUnitario` e `precoVenda` da simulação, `custoUnitario` da produção e do item de venda |
| Totais em reais | 2 | `round2` | `custoCalculado` do item, `custoProducao`, `custo.ingredientesLote` e `custo.gastosMensaisLote` (BE-28), `custo_invisivel`, `custo_total_producao`, `lucroEstimado`, `custoTotal` e `valorRateado` da produção, `total` da venda |
| Frações (margens e percentuais) | 4 | `round4` | `margemProjetada`, `lucroReal` e `percentuaisSemLucro` da simulação (eram 2 casas; os dois últimos, BE-31), `indiceMargemContribuicao` do resumo de vendas (BE-31), `margemRealizada` da venda, `margemLucro` e `lucroPercentual` da receita (BE-27), `percentuais` e as `fracao` da `composicao` (BE-28) |

Exemplo (critério da BE-23): farinha 1 kg a R$ 3,00/kg, sal 0,02 kg a R$ 2,50/kg e fermento 15 g a R$ 0,017/g dão custo de ingredientes **R$ 3,305** (`custoIngredientes` de `calcularCustoReceita`), não R$ 3,31 da soma de itens arredondados. Com rendimento 50, o custo unitário é R$ 0,0661 (era R$ 0,07).

- Valores digitados (`valorPago`, `valorTotal` e `quantidade` da compra, `valor` do gasto, `preco_unitario_real`, quantidades, `usoPorLote`, `embalagemPorUnidade` e `perdaPercentual` da receita) voltam como vieram.
- Quantidades de estoque e saldos continuam com `round6` ao gravar (não são custo nem preço).
- O ponto de equilíbrio do produto (BE-31) e o `breakEven` legado da simulação são unidades inteiras: `Math.ceil` de um valor passado antes pelo `round6`, que só tira o ruído do ponto flutuante (`0.1 × 3 / 0.1` dá `3.0000000000000004`, e o teto daria 4).
- Os services exportados para outros módulos devolvem os valores **sem arredondar**, não o DTO de resposta: `InsumoService.buscarVariosDaEmpresa` devolve os insumos como estão no banco (com `custoMedio`, `ultimoCusto` e `precoMercado` sem arredondar) e `ReceitaService.buscarDaEmpresa`, a receita com os itens e o custo de 1 lote calculado na leitura (BE-27).
- Cálculo em `number` (`double`), sem biblioteca de decimal: com ~15 dígitos significativos, o erro do ponto flutuante fica muito abaixo das 4 ou 6 casas da resposta, e o arredondamento o elimina.

As três funções ficam em `src/shared/domain/arredondamento.ts`, com teste unitário. **Muda (BE-23):** arredondam meio para cima, longe do zero, e passam o valor escalado por `toPrecision(15)` antes do `Math.round`, para o ruído do ponto flutuante não derrubar o meio (`round2(1.005)` dá `1.01`, e `round2(3 + 0.05 + 0.255)` dá `3.31`). O `Number(v.toFixed(n))` dos microsserviços dava `1` e `3.3`. Não troque por `toFixed` nem por `Math.round(v * 100) / 100`.

Valores e quantidades são `Float` no banco (`double precision`) e `number` na API, como hoje (BE-05).

## Enumerações

| Enum | Valores |
| --- | --- |
| `UnidadeMedida` | `G`, `KG`, `ML`, `L`, `UN` |
| `TipoGasto` (**muda**, BE-26; substitui o `MetodoRateio`) | `MENSAL`, `POR_UNIDADE`, `PERCENTUAL_VENDA` |
| `StatusVenda` | `PENDENTE`, `CONCLUIDA`, `CANCELADA` |
| `TipoMovimentacaoEstoque` | `ENTRADA`, `SAIDA` |
| `OrigemMovimentacaoEstoque` | `COMPRA`, `PRODUCAO` |
| `OrigemMovimentacaoProdutoAcabado` (**novo**, BE-05) | `PRODUCAO`, `VENDA` |
| `BaseRateio` (**novo**, BE-24) | `FORNADAS`, `MINUTOS` |

## Multiempresa

- Todo registro de negócio tem `empresa_id`. A empresa vem **sempre** do token (`@CurrentUser().empresa.id`), nunca da URL, da query ou do corpo.
- Recurso de outra empresa responde **404**, igual a um inexistente. Isso vale também para ids informados no corpo (insumos da receita, receita e gastos da produção, receita do item de venda).

## Auth

Origem: `auth-service/src/modules/auth/application/services/auth.service.ts` e `auth.module.ts`.

- Cadastro (`POST /auth/empresa`) cria empresa, usuário e a [configuração de custos](#configuração-de-custos) padrão (BE-24) e os [canais de venda](#canais-de-venda) padrão (BE-25) na mesma transação. CNPJ já cadastrado → 409 `CNPJ_JA_CADASTRADO` "CNPJ já cadastrado"; e-mail já cadastrado → 409 `EMAIL_JA_CADASTRADO` "E-mail já cadastrado". Com os dois repetidos, vale o do CNPJ (a empresa é criada antes do usuário, como a ordem das conferências de hoje). A duplicidade é detectada pelo índice único do banco (`P2002`), o que também cobre dois cadastros simultâneos.
- **Muda (BE-06):** `cnpj` e `nome_usuario` são opcionais; sem valor, ficam `null` no banco e no payload.
- Senha com `argon2` (hash no cadastro, `verify` no login). E-mail inexistente e senha errada dão a **mesma** resposta: 401 `CREDENCIAIS_INVALIDAS` "Credenciais inválidas". Com e-mail inexistente, o login confere a senha contra um hash fictício, para o tempo de resposta não revelar quais e-mails existem.
- JWT HS256, validade de **4 h**, payload `{ sub, email, nome, empresa: { id, nome, cnpj, segmento } }`. O frontend lê esse payload: não mude os nomes.
- **Muda (BE-06):** o e-mail é normalizado (trim e minúsculas) no cadastro e no login (`normalizarEmail` em `auth/domain/auth.calculos.ts`). O payload é montado por `montarPayloadJwt`, no mesmo arquivo.
- Limite de tentativas (BE-06): `POST /auth/login` e `POST /auth/empresa` aceitam 10 requisições por minuto para cada par IP + e-mail; acima disso, 429 `MUITAS_REQUISICOES`. As outras rotas não têm limite (exigem token).

## Insumos

Origem: `catalog-service/src/modules/insumos/domain/models/insumo.entity.ts` e `application/dto/create-insumo.dto.ts`.

**Muda (BE-29): três custos por insumo**, para responder ao "paguei R$ 8, hoje está R$ 10". O **custo médio** mede o que já foi gasto (estoque, produção e venda, como pedem o CPC 16 e o RIR/2018); o **custo de reposição** forma o preço.

```
custo informado = quantidadeBaseCusto > 0 ? valorPago / quantidadeBaseCusto : 0     // calcularCustoUnitario
custoReposicao  = precoMercado ?? ultimoCusto                                         // calcularCustoReposicao
```

| Campo | O que é | Muda quando |
| --- | --- | --- |
| `custoMedio` | custo médio móvel por unidade; é o custo de produção e venda (BE-30) | cadastro e [compra](#compras-de-insumo) |
| `ultimoCusto` | custo por unidade da última compra | cadastro e compra |
| `precoMercado`, `precoMercadoData` | preço por unidade informado sem compra (opcional, `null` sem valor) | `PATCH` (ver abaixo); a compra seguinte os limpa |
| `custoReposicao` | `precoMercado ?? ultimoCusto`; é o custo dos ingredientes no [custo da receita](#receitas-custo) e no preço (BE-28) | quando um dos dois acima muda |

- **Sem arredondamento** (`calcularCustoUnitario`, `calcularCustoMedio` e `calcularCustoReposicao`, em `insumos/domain/insumos.calculos.ts`): o banco guarda os custos exatos, e só a resposta os mostra com 6 casas (`round6`, BE-23).
- **Muda (BE-29):** `custoUnitario` (e o alias `precoUnitario`) da resposta passa a ser o **custo de reposição**, o custo que a receita usa. Antes era `valorPago / quantidadeBaseCusto` gravado no insumo; a coluna `custo_unitario` saiu do `insumo`. Campos novos (aditivos): `custoMedio`, `ultimoCusto`, `custoReposicao`, `precoMercado` e `precoMercadoData`.
- `valorPago` e `quantidadeBaseCusto` são o último preço de referência: o do cadastro, o da última compra (`valorTotal` e `quantidade`) ou o do último `PATCH` que os mudou. O formulário do frontend mostra e reenvia esses dois.
- Validação: `quantidadeBaseCusto ≥ 0.000001`, `valorPago ≥ 0` e `quantidadeDisponivelInicial ≥ 0` (opcional).
- **Muda (BE-07):** nome obrigatório, aparado e com até 80 caracteres (lacuna 12); excluir insumo usado em receita → 409 `INSUMO_EM_USO` (lacuna 13); resposta ganha `quantidadeMinima` (lacuna 5).
- **Cadastro (muda, BE-29):** numa transação só, cria o insumo com `custoMedio = ultimoCusto = valorPago / quantidadeBaseCusto` (sem preço de mercado), uma **compra inicial** (`quantidade = quantidadeDisponivelInicial ?? 0`, `valorTotal = quantidade × custo`, `custoUnitario` = o custo informado, observação "Cadastro do insumo") e o registro de estoque (saldo = `quantidadeDisponivelInicial ?? 0`, mínimo 0) por `EstoqueService.criarRegistroInicial` (BE-07). Com quantidade > 0, cria também uma movimentação `ENTRADA/COMPRA` com `referenciaId` = id da compra inicial. Sem saldo inicial, a compra inicial tem quantidade 0 e só guarda o custo informado. O saldo inicial é gravado como veio, sem `round6`.
- `quantidadeDisponivel` e `quantidadeMinima` da resposta vêm do estoque (`EstoqueService.saldosPorInsumo`); insumo sem registro de estoque responde 0 nos dois, como o catalog-service.
- Listagem ordenada por nome (e por id no empate), sem paginação. Hoje a ordem é a do banco.
- `PATCH` aceita `nome`, `quantidadeBaseCusto`, `unidade`, `valorPago` e, **novo (BE-29)**, `precoMercado` (≥ 0 ou `null`); campo omitido mantém o valor salvo. O saldo muda só pelo estoque e pelas compras, e o `custoMedio` e o `ultimoCusto` só pelas compras. O preço de mercado depois do `PATCH` sai de `resolverPrecoMercado`:
  - `precoMercado` no corpo vale como veio (`precoMercadoData` = agora); `null` limpa os dois, e a reposição volta ao último custo;
  - sem ele, um `valorPago` ou `quantidadeBaseCusto` **diferente do salvo** vira `precoMercado = valorPago / quantidadeBaseCusto`. É como o formulário atual muda o preço de um insumo; reenviar os valores salvos (só mudar o nome) não mexe no preço.
- Excluir o insumo leva junto o estoque, as movimentações e as compras dele (`CASCADE`). Usado em receita → 409 `INSUMO_EM_USO` "Insumo usado em receitas não pode ser excluído" (P2003 da FK `RESTRICT`, traduzido no `InsumoRepository`).
- Para outros módulos, `InsumoService` exporta `buscarVariosDaEmpresa(ids, empresaId)` (BE-09): ignora ids repetidos e responde 404 `INSUMO_NAO_ENCONTRADO` se algum não existir ou for de outra empresa. Devolve os insumos como estão no banco, com os custos sem arredondar (BE-23); quem precisa da reposição usa `calcularCustoReposicao` (receitas) e quem precisa do médio usa `custoMedio` (produção e venda, BE-30).

### Compras de insumo

**Novo (BE-29).** `POST /insumos/:id/compras` registra uma compra (`quantidade` na unidade do insumo, `valorTotal` pago e `observacao` opcional), e `GET /insumos/:id/compras` lista as compras do insumo, a mais recente primeiro. A compra é **imutável** (não tem `PUT` nem `DELETE`), e a data é a do registro.

```
custoCompra = valorTotal / quantidade                                                 // calcularCustoUnitario
custoMedio  = saldo ≤ 0 ? custoCompra
            : (saldo × custoMedio + quantidade × custoCompra) ÷ (saldo + quantidade)  // calcularCustoMedio
```

- Numa transação só: grava a compra, dá entrada da `quantidade` no estoque (`EstoqueService.registrarEntradaPorCompra`: `ENTRADA/COMPRA`, `referenciaId` = id da compra, a mesma `observacao`) e atualiza o insumo. `saldo` é o saldo **antes** da entrada, lido com a linha do estoque travada (`FOR UPDATE`), e o insumo é lido de novo depois da trava: duas compras simultâneas do mesmo insumo não ponderam o mesmo saldo nem o mesmo médio.
- Com saldo ≤ 0 (o estoque negativo continua permitido), o médio passa a ser o custo da compra: não há estoque com custo a ponderar, e um saldo negativo daria peso negativo ao médio antigo.
- A compra vira o `ultimoCusto` e o preço de referência (`valorPago = valorTotal`, `quantidadeBaseCusto = quantidade`) e **limpa o preço de mercado**: ela é a informação de preço mais nova. Assim, a reposição depois de uma compra é o custo dela.
- Validação: `quantidade ≥ 0.000001`, `valorTotal ≥ 0`, `observacao` até 200 (aparada; vazia vira `null`). Insumo inexistente ou de outra empresa → 404 `INSUMO_NAO_ENCONTRADO`. Responde 201 com a compra.
- Exemplo (critério da BE-29): saldo de 5 kg com médio R$ 8,00 + compra de 5 kg por R$ 50,00 → médio **R$ 9,00**, último custo e reposição **R$ 10,00**. Informar depois `precoMercado: 12` muda a reposição para R$ 12,00 (e o preço sugerido das receitas), e o médio continua R$ 9,00.
- A entrada manual de estoque (`POST /estoque/insumos/:id/entrada`, sem valor) continua existindo para o frontend atual e **não mexe nos custos**: é como entrar ao custo médio. Compra com valor é pela rota nova.
- Sem migração de dados (não há dados reais): os insumos que já existiam ficaram com médio e último iguais ao custo unitário que tinham, sem compra inicial.

## Configuração de custos

**Novo (BE-24).** Uma por empresa (tabela `configuracao_custos`, `empresa_id` único), com o que o cálculo novo do épico E7 precisa. Não existe nos microsserviços.

| Campo | O que é | Padrão |
| --- | --- | --- |
| `baseRateio` | o que a capacidade conta: `FORNADAS` ou `MINUTOS` de forno | `FORNADAS` |
| `capacidadeMensal` | fornadas (ou minutos de forno) que a empresa faz por mês | 40 |
| `lucroPadrao` | lucro como fração do **preço de venda** | 0,15 |
| `impostoPercentual` | imposto como fração do preço (informal ou MEI: 0; o DAS do MEI entra como gasto mensal) | 0 |
| `taxaMaquininha` | taxa cobrada no balcão, fração do preço | 0 |
| `valorHora` | reais por hora do trabalho da dona (**novo**, BE-45) | 0 |

- Os padrões servem para quem está começando e ainda não fatura. Ficam em `CONFIGURACAO_CUSTOS_PADRAO` (`configuracao-custos/domain/configuracao-custos.calculos.ts`) e são também os defaults das colunas.
- A configuração nasce no cadastro da empresa (`ConfiguracaoCustosService.criarPadrao(empresaId, tx)`, chamado pelo `auth` na transação do cadastro), no seed (que grava a da padaria de demonstração: 100 fornadas e maquininha de 1,36%, BE-33) e, para as empresas que já existiam, na própria migration `criar_configuracao_custos`.
- Validação (`validarConfiguracaoCustos`), feita depois de mesclar o `PUT` com os valores salvos: `capacidadeMensal > 0`; `lucroPadrao`, `impostoPercentual` e `taxaMaquininha` entre 0 e 1, inclusive; `valorHora` finito e ≥ 0 (BE-45). Erro → 400 `DADOS_INVALIDOS`, um `details` por campo, no formato do `ValidationPipe`.
- Os valores são gravados e devolvidos como vieram, sem arredondar.
- Sem regime tributário, anexo do Simples nem faturamento: decisão de simplicidade da BE-24. **Muda (BE-45):** o "sem pró-labore" da BE-24 é revisto só no trabalho da dona: o `valorHora` (padrão 0, então nada muda até ela preencher) vezes os `minutosTrabalhoPorLote` da [ficha técnica](#ficha-técnica) vira custo, não lucro (o `lucroPadrao` continua 15%). A BE-45 cadastra os dois campos; a BE-46 os soma ao custo ([Seu trabalho no custo](#seu-trabalho-no-custo)). Lançar o trabalho como gasto mensal está errado: o gasto mensal é dividido pelas fornadas, e um lote de brigadeiro sem forno pagaria o mesmo que um bolo de 3 h. Na interface é "seu trabalho" e "valor da sua hora". `capacidadeMensal` divide os gastos `MENSAL`; `lucroPadrao`, `impostoPercentual` e `taxaMaquininha` entram no [preço por canal](#preço-por-canal) (BE-28).
- A soma lucro + imposto + maquininha (+ comissão e gastos `PERCENTUAL_VENDA`) ≥ 1 **não** é barrada no `PUT`: cada canal com percentuais ≥ 100% vem sem preço e com o motivo `PERCENTUAIS_ACIMA_DE_100` (BE-28).

## Canais de venda

**Novo (BE-25).** Canais por onde a empresa vende (tabela `canal_venda`), cada um com a comissão que cobra sobre o preço, para o preço por canal das issues seguintes do E7. Não existe nos microsserviços.

| Canal padrão | `comissaoPercentual` | `ativo` | Por quê |
| --- | --- | --- | --- |
| Balcão | 0 | sim | a taxa da maquininha vem da [configuração de custos](#configuração-de-custos) (`taxaMaquininha`) |
| iFood | 0,152 | não | 12% do plano básico + 3,2% do pagamento online |
| iFood com entrega | 0,262 | não | 23% do plano com entrega + 3,2% |

- A comissão é fração do **preço de venda**, entre 0 e 1, gravada e devolvida sem arredondar.
- Os padrões ficam em `CANAIS_PADRAO` (`canais/domain/canais.calculos.ts`). Nascem no cadastro da empresa (`CanalVendaService.criarPadrao(empresaId, tx)`, chamado pelo `auth` na transação do cadastro), no seed (que os recria com o iFood ativo, BE-33) e, para as empresas que já existiam, na migration `criar_canal_venda`. Todos são editáveis.
- O Balcão é marcado pela coluna `balcao` (o nome pode mudar), que a API não deixa alterar e que canal criado pelo `POST` nunca tem. Excluir o Balcão → 422 `CANAL_BALCAO_NAO_EXCLUIVEL` "O canal Balcão não pode ser excluído" (`garantirCanalExcluivel`). Desativá-lo é permitido: a issue só proíbe a exclusão.
- Os outros canais podem ser excluídos. As vendas deles ficam com `canalId: null` (FK `SET NULL`, BE-30); o lucro real já gravado não muda.
- Taxa do canal no preço (BE-28, `taxaDoCanal`): no Balcão, a `taxaMaquininha` da configuração (a `comissaoPercentual` dele é ignorada); nos outros, a `comissaoPercentual`. Só os canais **ativos** entram em `precos` da receita; para outros módulos, `CanalVendaService` exporta `listarAtivosDaEmpresa(empresaId, tx?)` e, desde a BE-30, `buscarParaVenda(canalId?, empresaId)`: o canal informado, ativo ou não (404 `CANAL_VENDA_NAO_ENCONTRADO` se for de outra empresa), ou o Balcão quando omitido.

## Gastos indiretos e rateio

Origem do cadastro: `catalog-service/src/modules/gastos-indiretos/` (`create-gasto-indireto.dto.ts`). **Muda (BE-26):** o rateio dos microsserviços (`calcularValorRateado` do `producao.service.ts` e do `default-custo-invisivel-result.provider.ts`) foi removido: ele cobrava os gastos do mês inteiros em cada lote de cada receita (o pão francês do seed chegava a R$ 270). Cada gasto passa a ter um **tipo**, que diz como ele entra no custo.

| `tipo` | O que é o `valor` | Exemplos | Parte no custo de `lotes` lotes |
| --- | --- | --- | --- |
| `MENSAL` | valor do mês | aluguel, luz, gás, água, DAS do MEI, internet | `valor × usoPorLote × lotes ÷ capacidadeMensal` |
| `POR_UNIDADE` | reais por unidade vendida que não é da ficha | saco de pão genérico, etiqueta | `valor × totalUnidades` |
| `PERCENTUAL_VENDA` | fração do preço (0 a menos de 1) | comissão de revendedora | 0: não é custo; entra nos [percentuais do preço](#preço-por-canal) de todo canal (BE-28) |

- `capacidadeMensal` vem da [configuração de custos](#configuração-de-custos). `usoPorLote` é o uso de forno do lote (fornadas ou minutos), da [ficha técnica](#ficha-técnica) da receita (BE-27; padrão 1). Com isso, um gasto mensal de R$ 1.800 e a capacidade padrão de 40 fornadas custam R$ 45 por lote, nunca R$ 1.800.
- `totalUnidades = lotes × rendimento`. O `POR_UNIDADE` sempre foi valor por unidade; o seed antigo é que gravava R$ 120 de embalagem como se fosse o total do mês.
- Sem arredondamento (BE-23): a parte do gasto entra no custo da receita e da produção sem arredondar.
- Funções puras em `gastos-indiretos/domain/gastos-indiretos.calculos.ts`: `calcularGastoNoCusto(gasto, { lotes, totalUnidades, capacidadeMensal, usoPorLote? })`, usada pelas receitas e pelas produções; `validarGasto`; e a compatibilidade com o `metodo_rateio` (`tipoDoMetodoRateio`, `metodoRateioDoTipo`, `resolverTipoGasto`).
- Migration `recria_tipo_gasto`: troca a coluna `metodo_rateio` pela `tipo` e o enum `MetodoRateio` pelo `TipoGasto`. Não há dados reais; os gastos dos bancos de desenvolvimento e de teste são convertidos como o `metodo_rateio` legado (abaixo).

Cadastro:

- Descrição até 100 caracteres, `valor ≥ 0`, `tipo` obrigatório. **Muda (BE-08):** a descrição passa a ser obrigatória e aparada.
- **Validação por tipo (BE-26, `validarGasto`):** `PERCENTUAL_VENDA` exige `0 ≤ valor < 1` (um gasto de 100% do preço não deixa preço possível); fora disso → 400 `DADOS_INVALIDOS` com `details` no campo `valor`. `MENSAL` e `POR_UNIDADE` aceitam qualquer `valor ≥ 0`. No `PUT`, a conferência é feita depois de mesclar com o salvo (trocar só o tipo para `PERCENTUAL_VENDA` de um gasto de R$ 1.800 → 400).
- **Compatibilidade com o frontend atual (BE-26):** o frontend ainda envia `metodo_rateio` e valida `metodoRateio` na resposta (`FIXO`, `PROPORCIONAL`, `POR_UNIDADE`). Por isso:
  - a entrada aceita `metodo_rateio` no lugar de `tipo`: `FIXO` e `PROPORCIONAL` viram `MENSAL` (eram os valores do mês) e `POR_UNIDADE` continua `POR_UNIDADE`. Se vierem os dois, vale o `tipo`;
  - a resposta traz o `tipo` (campo novo) e um `metodoRateio` derivado: `POR_UNIDADE` para `POR_UNIDADE` e `FIXO` para os outros (o `PERCENTUAL_VENDA` não tem equivalente; `FIXO` é o de menor efeito no cálculo local do frontend);
  - no `PUT`, um `metodo_rateio` igual ao `metodoRateio` mostrado para o tipo salvo mantém o tipo, porque o formulário atual reenvia o método que recebeu; sem isso, editar a descrição de um `PERCENTUAL_VENDA` o transformaria em `MENSAL`.
  - Um gasto criado como `PROPORCIONAL` volta como `FIXO`: o frontend aceita, e os dois viraram o mesmo tipo. O legado continua enquanto o frontend atual o exigir ([api.md](api.md#campos-legados-mantidos)).
- `valor` é gravado como veio, sem `round2`, como no catalog-service.
- Listagem por `id` decrescente (o mais novo primeiro), como hoje. `PUT` com campos opcionais: campo omitido mantém o valor salvo.
- Gasto de outra empresa ou inexistente → 404 `GASTO_INDIRETO_NAO_ENCONTRADO`.
- Excluir um gasto não apaga os rateios das produções antigas: `rateio_producao.gasto_indireto_id` não tem FK e guarda o id, como nos microsserviços, e o rateio guarda a `descricao`. **Muda (BE-12):** a BE-05 previa `SET NULL`, mas o `gastoIndiretoId` nulo quebraria o schema do frontend (`z.number().int()`, que mostra "Gasto #id").
- Para outros módulos, `GastoIndiretoService` exporta `listarPorEmpresa(empresaId, tx?)` e `buscarVariosDaEmpresa(ids, empresaId, tx?)`. Este último ignora ids repetidos, devolve `[]` para lista vazia e responde 404 se algum id não existir ou for de outra empresa (base da correção da lacuna 11, aplicada na produção pela BE-12).

## Cálculo de custo e preço (épico E7)

**Muda (BE-23 a BE-33).** Resumo do cálculo novo, que substitui o `custo × (1 + margem)` dos microsserviços. Cada passo tem a seção própria abaixo, com as fórmulas completas.

| Passo | Regra | Seção |
| --- | --- | --- |
| Custo do insumo | três custos: **médio** (o que já foi pago: produção e venda), **último** (última compra) e **reposição** (`precoMercado ?? ultimoCusto`: forma o preço) | [Insumos](#insumos), [Compras](#compras-de-insumo) |
| Gastos | pelo tipo: `MENSAL` ÷ capacidade mensal × uso de forno do lote; `POR_UNIDADE` por unidade; `PERCENTUAL_VENDA` no preço | [Gastos](#gastos-indiretos-e-rateio), [Configuração](#configuração-de-custos) |
| Custo da unidade | `((ingredientes + gastos mensais do lote) ÷ rendimento + embalagem + gastos por unidade) ÷ (1 − perda)`, sem arredondar no meio | [Receitas: custo](#receitas-custo) |
| Preço | por canal: `custo ÷ (1 − imposto − taxa do canal − gastos percentuais − lucro)`, com o lucro sobre o **preço** | [Preço por canal](#preço-por-canal) |
| Produção | ingredientes ao custo médio + gastos `MENSAL` do forno, uma vez | [Produções](#produções) |
| Venda | canal da venda e `lucroReal = 1 − percentuais sem lucro − custo ÷ preço` | [Vendas](#vendas) |
| Ponto de equilíbrio | do produto (unidades por mês) e da empresa (faturamento por mês), pela margem de contribuição | [Simulação e ponto de equilíbrio](#simulação-e-ponto-de-equilíbrio) |
| Alertas | estoque negativo e reposição mais de 10% acima do médio | [Alertas](#alertas) |

Exemplo com o seed (BE-33): Padaria Pão Feliz com gastos mensais de R$ 2.515 (aluguel, luz, gás e DAS), 100 fornadas por mês, saquinho de R$ 0,05 por unidade, lucro de 15% e maquininha de 1,36%. O Pão Francês leva 1 kg de farinha (reposição R$ 3,50/kg, médio R$ 3,37), 0,02 kg de sal e 15 g de fermento, rende 28 pães, ocupa 0,2 fornada e perde 5%:

```
ingredientes do lote = 3,50 + 0,05 + 0,255                 = R$ 3,805
gastos mensais       = 2.515 × 0,2 ÷ 100                   = R$ 5,03
custo da unidade     = ((3,805 + 5,03) ÷ 28 + 0,05) ÷ 0,95 = R$ 0,3848
preço no Balcão      = 0,3848 ÷ (1 − 0,15 − 0,0136)        = R$ 0,4600
preço no iFood       = 0,3848 ÷ (1 − 0,15 − 0,152)         = R$ 0,5513
```

Com o custo médio da farinha, a venda a R$ 0,46 no Balcão registra custo de R$ 0,3799 e lucro real de 16,05%. A simulação no Balcão dá margem de contribuição de R$ 0,2581 e ponto de equilíbrio de 9.745 pães por mês (todos os gastos mensais pagos só com pão).

## Receitas: custo

Origem: `recipe-service/src/modules/custos/application/services/custo.service.ts` (`calcularReceita`, `calcularItens`, `calcularCustoTotalProducao`, `calcularCustoPorUnidade`, `calcularPrecoSugerido`) e `default-custo-invisivel-result.provider.ts`.

**Muda (BE-27): o custo não é mais gravado.** A receita guarda só a ficha técnica; `custoProducao`, `custoUnitario`, `precoSugerido` e o `custoCalculado` dos itens são calculados **na leitura** (listagem, detalhe, cadastro, edição, custo, simulação, preço de venda e `buscarDaEmpresa`), com os custos de reposição dos insumos (BE-29; no `buscarDaEmpresa`, para produção e venda, o custo médio, BE-30), os gastos atuais e a configuração de custos da empresa. Mudar o custo de um insumo ou um gasto passa a mudar o custo das receitas na hora.

**Muda (BE-28): fórmula nova**, igual em todas as telas, que substitui `custo × (1 + margem)` e o custo invisível somado ao lote. Custo de 1 unidade:

```
ingredientesLote  = Σ item.quantidade × insumo.custoReposicao           // BE-29: precoMercado ?? ultimoCusto
gastosMensaisLote = Σ gastos MENSAL × usoPorLote ÷ capacidadeMensal
trabalhoLote      = minutosTrabalhoPorLote ÷ 60 × valorHora             // BE-46
custoUnitario     = ((ingredientesLote + gastosMensaisLote + trabalhoLote) ÷ rendimento
                     + embalagemPorUnidade + Σ gastos POR_UNIDADE) ÷ (1 − perdaPercentual)   // rendimento ≤ 0 → 400
```

Para `lotes` lotes (as respostas de receita usam `lotes = 1`):

```
quantidadeItem    = item.quantidade × lotes
custoCalculado    = quantidadeItem × insumo.custoReposicao               // por item
custoIngredientes = Σ custoCalculado
totalUnidades     = rendimento × lotes
custoInvisivel    = Σ calcularGastoNoCusto(gasto, { lotes, totalUnidades, capacidadeMensal, usoPorLote })  // MENSAL e POR_UNIDADE (BE-26)
custoProducao     = custoUnitario × totalUnidades                       // BE-28: com embalagem e perda
```

Sem embalagem nem perda, os números são os mesmos da BE-27 (o custo invisível dividido pelas unidades é a mesma coisa que somá-lo ao lote). O preço é o do [canal](#preço-por-canal).

Exemplo (critério da BE-28): pão francês com ingredientes de R$ 3,305, rendimento 50, gastos mensais de R$ 2.435, capacidade de 100 fornadas, uso de 1 fornada e perda de 5%: `(3,305 + 24,35) ÷ 50 ÷ 0,95` = **R$ 0,5822** por unidade.

Detalhamento na resposta da receita (`custo`): `ingredientesLote`, `gastosMensaisLote` e `trabalhoLote` (BE-46) com 2 casas e, por unidade (4 casas), `ingredientes` (`ingredientesLote ÷ rendimento`), `gastosMensais` (`gastosMensaisLote ÷ rendimento`), `trabalho` (`trabalhoLote ÷ rendimento`, BE-46), `gastosPorUnidade`, `embalagem`, `perdas` (`custoUnitario − custo sem perda`) e `unitario`; as partes por unidade somam o `unitario`.

**Muda (BE-23):** hoje cada linha arredonda com `round2`; o monolito não arredonda no meio. A resposta arredonda (`custoCalculado`, `custoProducao` e `custo_invisivel` com 2 casas; `custoUnitario` e `precoSugerido` com 4), ver [Arredondamento](#arredondamento).

#### Seu trabalho no custo

**Novo (BE-46).** O trabalho da dona entra no custo de cada receita pelo tempo que ela fica ocupada com o lote, e não como gasto do mês (que seria dividido pelas fornadas):

```text
trabalhoLote = minutosTrabalhoPorLote ÷ 60 × valorHora    // calcularTrabalhoLote, sem arredondar
trabalho     = trabalhoLote ÷ rendimento                   // por unidade, antes da perda
```

- Soma junto de ingredientes, gastos mensais, embalagem e gastos por unidade, **antes** da perda: a unidade perdida também levou trabalho. O que a perda acrescenta sobre o trabalho vai para `perdas`, como nas outras partes.
- Entra no custo variável (`custoSemGastosMensais`): não depende da capacidade do mês.
- O `valorHora` é o atual da configuração de custos: mudá-lo muda custo e preço na próxima leitura (nada é gravado). Com `valorHora` 0 (o padrão) ou minutos 0, custo e preço ficam iguais aos de antes.
- O lucro padrão continua 15% sobre o preço: o trabalho é custo, não lucro.
- Preço por canal, composição (parte `trabalho`), simulação, ponto de equilíbrio, preço de venda e alerta de preço defasado seguem o custo novo sem mudança de fórmula. `buscarDaEmpresa` (produção e venda) também: a venda copia o `custoUnitario` com o trabalho. A produção soma o trabalho das receitas usadas pelo `custoParaUso` ([Custo com receita dentro de receita](#custo-com-receita-dentro-de-receita)) e, desde a BE-47, o da própria receita, gravado em `custoTrabalho` ([Produções](#produções)).

Exemplo (critério da BE-46): com o valor da hora de R$ 18,75, um lote de 40 min rende `40 ÷ 60 × 18,75` = R$ 12,50 de trabalho; se rende 50 unidades, soma **R$ 0,25** por unidade. Com perda de 10%, soma `0,25 ÷ 0,9` = **R$ 0,2778** ao custo unitário (R$ 0,25 em `trabalho` e R$ 0,0278 em `perdas`). Sem imposto, taxa nem gastos de venda, o preço sobe `0,25 ÷ 0,85` = R$ 0,2941 com o lucro de 15%.

- **Custo invisível (lacuna 18):** soma **todos** os gastos indiretos da empresa. **Muda (BE-26):** cada gasto entra pelo [tipo](#gastos-indiretos-e-rateio): o mensal dividido pela capacidade mensal e multiplicado pelo `usoPorLote` (BE-27), o por unidade multiplicado pelas unidades e o percentual de venda fora do custo (entra no preço, BE-28). Antes, o Aluguel de R$ 1.800 `FIXO` subia R$ 1.800 o custo de cada receita; agora sobe R$ 45 com a capacidade padrão de 40.
- O resultado do custo invisível precisa ser finito e ≥ 0, senão 400 (`obterCustoInvisivel`). Com valores ≥ 0 validados no cadastro, isso não acontece, e o monolito não repete a conferência.
- Rendimento ≤ 0 → 400 `RENDIMENTO_INVALIDO` "Rendimento da receita deve ser maior que zero" (`validarRendimento`). O DTO já exige inteiro positivo.
- Funções puras em `receitas/domain/receitas.calculos.ts`: `calcularCustoItem`, `calcularCustoInvisivel(gastos, rendimento, capacidadeMensal, lotes = 1, usoPorLote = 1)` (usa `calcularGastoNoCusto` de `gastos-indiretos`), `somarGastosMensaisLote`, `somarGastosPorUnidade`, `somarGastosPercentuais`, `calcularCustoUnitario` e `calcularCustoReceita` (`lotes`, `usoPorLote`, `embalagemPorUnidade` e `perdaPercentual` opcionais; devolve também `lotes`, `totalUnidades` e o `detalhe` do custo unitário) (BE-28); `calcularPreco` e `calcularPrecoNoCanal` ([preço por canal](#preço-por-canal), BE-28); `simularCenario` (BE-10, BE-31), `calcularMargemContribuicao`, `calcularPontoEquilibrioProduto` e `somarGastosMensais` ([simulação e ponto de equilíbrio](#simulação-e-ponto-de-equilíbrio), BE-31) e `calcularPrecoVenda` (BE-10); e as da [ficha técnica](#ficha-técnica) (BE-27). O service busca os insumos por `InsumoService.buscarVariosDaEmpresa`, os gastos por `GastoIndiretoService.listarPorEmpresa`, a configuração por `ConfiguracaoCustosService.buscarDaEmpresa` e os canais ativos por `CanalVendaService.listarAtivosDaEmpresa`, uma vez por requisição (também na listagem), sem HTTP.
- **Muda (BE-27):** o lucro é o da receita ou, sem ele, o `lucroPadrao` da empresa. A resposta traz ainda `margemLucro` derivada (`lucro ÷ (1 − lucro)`, o markup equivalente), para o frontend atual; ela é omitida só quando não há preço. **Muda (BE-28):** `precoSugerido` é o preço do Balcão ([preço por canal](#preço-por-canal)), não mais `custo ÷ (1 − lucro)`; a `margemLucro` continua sendo a do lucro configurado (para o formulário reenviá-la sem mudar o lucro), e por isso `custoUnitario × (1 + margemLucro)` só é o `precoSugerido` sem imposto, maquininha nem gastos `PERCENTUAL_VENDA`.
- Validação do corpo (`create-receita.dto.ts`): nome até 80, `rendimento` inteiro > 0, `quantidade` do item ≥ 0.001, `insumo_id` inteiro > 0. **Muda (BE-09):** a lista de insumos não pode ser vazia (400; **muda (BE-39):** a receita precisa de ao menos um insumo ou [receita](#receita-dentro-de-receita)), os insumos precisam ser da empresa (404 `INSUMO_NAO_ENCONTRADO`), e o nome passa a ser aparado e obrigatório (como o do insumo e o do gasto).
- Receita inexistente ou de outra empresa → 404 `RECEITA_NAO_ENCONTRADA` "Receita não encontrada". Listagem por `dataCriacao` decrescente (e `id` no empate); itens na ordem em que foram informados.
- Para outros módulos, `ReceitaService` exporta `buscarDaEmpresa(id, empresaId, tx?)`, que devolve a `Receita` com os itens (404 se não for da empresa), para as produções e as vendas. **Muda (BE-30):** em vez de `custoProducao` e `custoUnitario`, devolve `custo` (o `CustoReceita` de 1 lote, pela fórmula acima, mas com o **custo médio** dos insumos no lugar da reposição: é o que já foi gasto) e `basePreco` (imposto, maquininha, gastos `PERCENTUAL_VENDA` e lucro). Valores sem arredondar (BE-23), não o `ReceitaDto`. Dentro de uma transação, as consultas do custo usam o `tx`.

### Ficha técnica

**Novo (BE-27).** Campos da receita além dos itens e do rendimento, todos opcionais na entrada (`snake_case`, como o resto do corpo) e com padrão, para o formulário atual continuar funcionando:

| Campo (corpo / resposta) | O que é | Padrão | Validação |
| --- | --- | --- | --- |
| `uso_por_lote` / `usoPorLote` | fornadas ou minutos de forno que 1 lote ocupa, conforme a `baseRateio` da empresa | 1 | > 0 |
| `embalagem_por_unidade` / `embalagemPorUnidade` | reais por unidade (caixa, pote ou saquinho do próprio produto) | 0 | ≥ 0 |
| `perda_percentual` / `perdaPercentual` | fração das unidades que não são vendidas (sobra, queima) | 0 | 0 ≤ perda < 1 |
| `lucro_percentual` / `lucroPercentual` | lucro como fração do **preço** | vazio: usa o `lucroPadrao` da empresa | 0 ≤ lucro < 1 |
| `minutos_trabalho_por_lote` / `minutosTrabalhoPorLote` | minutos em que a dona fica ocupada com 1 lote (preparar, mexer, montar, embalar), **sem** o tempo em que a receita fica sozinha no forno ou na geladeira; diferente do `usoPorLote` (forno) (**novo**, BE-45) | 0 | ≥ 0, finito |

- `rendimento` passa a ser **unidades boas** por lote (as vendáveis).
- **Removidos (BE-27):** a coluna `margem_lucro` (markup sobre o custo) e as de custo congelado (`custo_producao`, `custo_unitario`, `preco_sugerido` da receita e `custo_calculado` do item). Sem migração de dados (não há dados reais): a migration `altera_ficha_tecnica_da_receita` apaga as colunas.
- `usoPorLote` entra nos gastos `MENSAL` da receita e da produção; `embalagemPorUnidade` e `perdaPercentual` entram no custo unitário desde a BE-28.
- Perda ou lucro ≥ 1 não deixam preço possível (divisão por zero) → 400 `DADOS_INVALIDOS`, com `details` no campo do corpo (`perda_percentual`, `lucro_percentual`). O DTO confere o tipo e o mínimo; o limite superior, e o `PUT` mesclado com o salvo, são conferidos por `validarFichaTecnica`.
- Na resposta, `lucroPercentual` é omitido quando a receita usa o lucro padrão (como os outros campos sem valor da receita) e sai com 4 casas.
- **Compatibilidade com o frontend atual:** o formulário ainda envia `margem_lucro` (markup). Ela é aceita e convertida em `lucro_percentual = margem ÷ (1 + margem)`, o que dá o mesmo preço sugerido (`custo × (1 + margem) = custo ÷ (1 − lucro)`); se vierem os dois, vale o `lucro_percentual`. `margem_lucro: null` volta ao lucro padrão. O legado continua enquanto o frontend atual o exigir ([api.md](api.md#campos-legados-mantidos)).
- `minutosTrabalhoPorLote` (BE-45) é gravado e devolvido como veio; desde a BE-46 entra no custo ([Seu trabalho no custo](#seu-trabalho-no-custo)). A migration `adiciona_valor_hora_e_minutos_trabalho` deixa as receitas e configurações existentes com 0, sem mudar o custo delas. Negativo → 400 `DADOS_INVALIDOS` com `details` em `minutos_trabalho_por_lote`.
- Funções puras: `FICHA_TECNICA_PADRAO`, `resolverFichaTecnica(informada, salva?)` (omitido ou `null` mantém o salvo, menos `lucroPercentual`, em que `null` volta ao padrão), `validarFichaTecnica`, `lucroDaMargem`, `margemDoLucro` e `lucroPercentualInformado`.

### Edição

Origem: `recipe-service/src/modules/receitas/application/services/receita.service.ts` (`update`).

- Campo omitido mantém o valor salvo (`null` em `nome`, `rendimento`, `unidadeRendimento`, `insumos` e nos campos da ficha técnica também mantém; só `lucro_percentual` e `margem_lucro` tratam `null` como valor).
- Com `insumos`, todos os itens são trocados pelos novos, no mesmo update (atômico).
- **Muda (BE-27):** não há mais recálculo na edição, porque nada de custo é gravado; a resposta traz o custo atual. `lucro_percentual: null` (ou `margem_lucro: null`) volta ao lucro padrão da empresa. A BE-09 fazia `margem_lucro: null` remover a margem e o preço sugerido (lacuna 21).
- **Muda (BE-27):** mudar o custo de um insumo ou um gasto muda na hora o custo das receitas que o usam. Hoje o custo só mudava quando a receita era salva de novo.
- **Muda (BE-09):** excluir receita usada em produção ou venda → 409 `RECEITA_EM_USO` "Receita usada em produções, vendas ou outras receitas não pode ser excluída" (P2003 das FKs `RESTRICT` de `producao` e `item_venda`, traduzido no `ReceitaRepository`). Os itens e o estoque de produto acabado vão junto (`CASCADE`).

### Receita dentro de receita

**Novo (BE-39).** Uma receita pode usar outras receitas além dos insumos. Exemplo: o Brownie Dois Amores leva 1 brownie, 150 g de brigadeiro preto, 150 g de brigadeiro branco e 30 g de leite Ninho. Na interface o nome é "receita dentro de receita" (sem "sub-receita" nem "ficha composta").

- Tabela `item_receita_receita` (`ItemReceitaReceita`): `receita_id` (a que usa, `CASCADE`), `receita_usada_id` (a usada, `RESTRICT`) e `quantidade` (> 0).
- A `quantidade` fica **na unidade do rendimento da receita usada** (`unidadeRendimento`): gramas se o brigadeiro rende 1000 G, unidades se o brownie rende 20 UN. Sem conversão entre G e KG.
- `vendavel` (padrão `true`): `false` marca a receita que só serve para usar dentro de outras. **Muda (BE-40):** a receita com `vendavel: false` continua com custo, mas sem preço: `precoSugerido` (e `margemLucro`) omitidos, `precos: []`, e fica fora do alerta de preço defasado. **Novo (BE-41):** vender a receita com `vendavel: false` → 422 `RECEITA_NAO_VENDIDA_SOZINHA` ([Vendas](#vendas)).
- Corpo: `receitas: [{ receita_id, quantidade }]` (opcional, padrão `[]`) e `vendavel`. `insumos` passa a ser opcional (padrão `[]`): a receita pode ter só receitas, só insumos ou os dois, mas precisa de ao menos um item (400 `DADOS_INVALIDOS`, campo `insumos`). No `PUT`, `receitas` omitido mantém as salvas e enviado substitui todas.
- Resposta: `vendavel`, `receitas: [{ receitaId, nome, quantidade, unidade }]` (na ordem informada; `unidade` é a `unidadeRendimento` da usada) e `usadaEm: [{ receitaId, nome }]` (quem usa esta receita, por id).
- Regras, na ordem em que são conferidas:
  - receita de outra empresa (ou inexistente) na lista: 404 `RECEITA_NAO_ENCONTRADA`;
  - sem nenhum item: 400; a mesma receita repetida na lista: 400 `DADOS_INVALIDOS` (campo `receitas`);
  - a receita usando ela mesma: 422 `RECEITA_USA_ELA_MESMA`;
  - **um nível só**: a receita que já é usada em outra não pode ganhar receitas, e a usada não pode ter receitas dentro: 422 `RECEITA_DENTRO_DE_RECEITA_COM_RECEITA`;
  - mudar a `unidadeRendimento` de uma receita usada em outra: 409 `RECEITA_EM_USO` (as quantidades perderiam o sentido);
  - excluir receita usada em outra: 409 `RECEITA_EM_USO`, com os nomes de quem usa na mensagem ("Receita usada em outras receitas não pode ser excluída: Brownie Dois Amores"). O service confere antes de excluir; a FK `RESTRICT` fica de garantia.
- A produção tira as receitas usadas do estoque pronto delas (BE-41, [Produções](#produções)).
- Funções puras: `validarItensDaReceita` (ao menos um item, repetida, ela mesma, um nível só), `validarExclusaoDaReceita` e `validarMudancaDeUnidade`.

#### Custo com receita dentro de receita

**Novo (BE-40).** O custo de 1 unidade (grama, ml ou unidade do rendimento) da receita usada é só ingredientes, forno, seu trabalho (**muda, BE-46**) e perda:

```text
custoParaUso = (ingredientesLote + gastosMensaisLote + trabalhoLote) ÷ rendimento ÷ (1 − perdaPercentual)
```

- **Muda (BE-46):** o `trabalhoLote` é o da receita usada (os minutos dela × o valor da hora). Na receita que usa, os `minutosTrabalhoPorLote` são só os da montagem: o trabalho do brigadeiro já vem no custo por grama.

- **Sem** embalagem e **sem** gastos `POR_UNIDADE` da receita usada: esses entram uma vez só, no produto final.
- `gastosMensaisLote` é o da receita usada (o `usoPorLote` dela, `somarGastosMensaisLote`).
- Na receita que usa: `ingredientesLote = Σ quantidade × custo do insumo + Σ quantidade × custoParaUso`. O resto da conta (forno, embalagem e perda da própria receita, preço por canal, composição, simulação e ponto de equilíbrio) não muda de fórmula.
- Mesma regra dos insumos (BE-29/BE-30): o **preço** usa o custo de reposição dos insumos da receita usada; produção e venda (`buscarDaEmpresa`), o custo médio.
- O custo é calculado na leitura: mudar o preço de um insumo do brigadeiro muda o custo do Brownie Dois Amores na próxima leitura.
- Resposta: cada item de `receitas[]` ganha `custoUnitario` (`custoParaUso`, 4 casas) e `custoCalculado` (`quantidade × custoUnitario`, 2 casas), como o `custoCalculado` dos insumos.
- Alerta de preço defasado: os `insumoIds` da receita incluem os das receitas usadas (o chocolate do brigadeiro que sobe avisa o Brownie Dois Amores).
- Sem N+1: a leitura (e a listagem) traz as receitas usadas e os itens delas na mesma consulta, e o contexto de custo busca de uma vez os insumos da receita e os das usadas.
- Funções puras: `calcularCustoParaUsoEmReceita` e o campo `receitas` de `calcularCustoReceita` (sem arredondar, BE-23).

Exemplo: o brigadeiro tem R$ 30,00 de ingredientes e R$ 5,00 de forno por lote (R$ 500 de gastos mensais, capacidade de 100 fornadas, 1 fornada), rende 1000 g e não tem perda: `(30 + 5) ÷ 1000 ÷ 1 = R$ 0,035/g`. A embalagem dele não entra. Os 150 g dentro do Brownie Dois Amores somam `150 × 0,035 = R$ 5,25` aos ingredientes do lote do Dois Amores. Se o chocolate do brigadeiro subir R$ 10,00 por lote, o grama vai a R$ 0,045 e os 150 g a R$ 6,75.

Exemplo do trabalho (critério da BE-46): o brigadeiro de 1000 g leva 60 min; com o valor da hora de R$ 18,75, são R$ 18,75 por lote, **R$ 0,01875/g** a mais. Os 150 g dentro do Brownie Dois Amores somam `150 × 0,01875` = **R$ 2,81** ao custo dele; os 10 min de montagem do Dois Amores (R$ 3,125 por lote) somam à parte, no `trabalho` dele.

### Custo para N lotes

Origem: `custo.service.ts` (`calcularPorReceita`, `simularPorReceita`) e `custos/application/dto/receita-custo.dto.ts`.

`GET /receitas/:id/custo` (1 lote) e `POST /receitas/:id/custo/simular` (`quantidadeLotes`, inteiro > 0) calculam com os custos de reposição dos insumos (BE-29) e os gastos atuais da empresa, pela fórmula acima (como toda leitura de receita desde a BE-27). A resposta é `snake_case` (lacuna 15, mantida):

| Campo | Valor |
| --- | --- |
| `quantidade_lotes` | `lotes` |
| `total_unidades` | `rendimento × lotes` |
| `custo_invisivel` | `custoInvisivel` |
| `custo_total_producao` | `custoProducao` |
| `custo_por_unidade` | `custoUnitario` |

- A quantidade do item é multiplicada pelos lotes antes do custo do item, como hoje. Sem o `round2` do item (BE-23), o fermento do Pão Francês custa 0,255 em 1 lote e 0,765 em 3.
- `quantidadeLotes` inteiro > 0 (400 senão). `GET` responde 200 e o `POST` 201. Receita de outra empresa → 404. Não grava nada.
- Service: `ReceitaService.calcularCusto(id, lotes, empresaId)`; resposta montada por `toReceitaCustoDto`.

### Simulação e ponto de equilíbrio

Origem: `recipe-service/src/modules/custos/application/services/simulacao.service.ts` e `simular-cenario.dto.ts`. **Muda (BE-31):** o break-even de lá (`ceil(custo × volume ÷ preço)`) não diz quanto vender para pagar as contas do mês. A simulação passa a receber o preço praticado, o canal e o volume do mês, e devolve o lucro real e o ponto de equilíbrio pela margem de contribuição.

```
canal                 = canalId ?? Balcão da empresa                              // CanalVendaService.buscarParaVenda (ativo ou não)
custo                 = custo da receita na leitura (reposição dos insumos, BE-29)
percentuaisSemLucro   = imposto + taxaDoCanal(canal) + Σ gastos PERCENTUAL_VENDA    // calcularPercentuaisSemLucro (BE-30)
preco                 = novoPreco ?? preço sugerido no canal                       // calcularPrecoNoCanal; sem preço → 400
volume                = volume ?? receita.rendimento                              // unidades no mês
custoUnitario         = novoCusto ?? custo.custoUnitario
custoSemGastosMensais = novoCusto ausente ? custo.custoSemGastosMensais
                                          : max(0, novoCusto − (custo.custoUnitario − custo.custoSemGastosMensais))
gastosMensais         = Σ gastos MENSAL da empresa                                // somarGastosMensais
MCu                   = preco − custoSemGastosMensais − percentuaisSemLucro × preco   // calcularMargemContribuicao
lucroPorUnidade       = preco − custoUnitario − percentuaisSemLucro × preco
lucroReal             = lucroPorUnidade ÷ preco                                   // fração do preço, como o lucro da venda (BE-30)
lucroMes              = lucroPorUnidade × volume
pontoEquilibrio       = MCu ≤ 0 ? { unidades: null, motivo: MARGEM_NEGATIVA }
                                : { unidades: ceil(round6(gastosMensais ÷ MCu)), motivo: null }   // calcularPontoEquilibrioProduto
```

- `custoSemGastosMensais` é o custo variável da unidade: `(ingredientes + trabalho + embalagem + gastosPorUnidade) ÷ (1 − perda)` (o `trabalho` desde a BE-46), o `custoUnitario` sem a parte dos gastos `MENSAL` (`calcularCustoUnitario` devolve os dois). A margem de contribuição é o que cada unidade deixa para pagar os gastos do mês.
- **Ponto de equilíbrio do produto**: unidades por mês para pagar **todos** os gastos mensais "se só vendesse este produto", arredondado para cima (o `round6` tira o ruído do ponto flutuante antes do teto). `MCu ≤ 0` (comparado com `round6`) → `unidades: null` com motivo `MARGEM_NEGATIVA`: nenhuma quantidade paga os gastos. Sem gastos mensais, 0.
- O lucro real está na mesma base do lucro do preço: **pelo preço sugerido do canal, o `lucroReal` é o lucro configurado** (critério da BE-31). Exemplo: o pão francês da BE-28 no Balcão, a R$ 0,6961 (maquininha de 1,36%), tem lucro real de 15%, custo variável de `3,305 ÷ 50 ÷ 0,95` = R$ 0,0696, MCu de `0,6961 × 0,9864 − 0,0696` ≈ R$ 0,617 e ponto de equilíbrio de `2.435 ÷ 0,617` = **3.947 pães por mês**.
- `novoCusto` troca o custo unitário; o custo variável perde a mesma parte dos gastos mensais que a receita tem (nunca fica abaixo de 0).
- Resposta (`toSimulacaoCenarioDto`): custos, preço, MCu e lucro por unidade com 4 casas; `percentuaisSemLucro` e `lucroReal` (frações) com 4; `lucroMes` e `gastosMensais` com 2; `canalId` e `canal` (nome). Os campos antigos continuam pelo schema atual do frontend: `lucroEstimado` = `lucroMes` e `margemProjetada` = `lucroReal` (**mudam**: agora descontam imposto, taxa e gastos percentuais), e `breakEven` = `ceil(round6(custoUnitario × volume ÷ preco))`, **legado**, que sai quando o frontend usar o `pontoEquilibrio` ([api.md](api.md#campos-legados-mantidos)).
- Mensagens (400): "Receita sem preço sugerido definido. Informe novoPreco para simular." (`RECEITA_SEM_PRECO`, quando os percentuais do canal passam de 100% e não há `novoPreco`) e, **muda (BE-10, lacuna 27)**, preço igual a 0 (receita sem custo nenhum) → `PRECO_INVALIDO` "Preço de venda deve ser maior que zero. Informe novoPreco para simular.", em vez de `NaN`. O `RECEITA_SEM_CUSTO` saiu da simulação: desde a BE-27 o custo é sempre calculado.
- `novoCusto` e `novoPreco` > 0, `volume` e `canalId` inteiros > 0, quando informados. Canal de outra empresa → 404 `CANAL_VENDA_NAO_ENCONTRADO`.
- Funções puras em `receitas.calculos.ts`: `simularCenario(entrada, receita)`, `calcularMargemContribuicao`, `calcularPontoEquilibrioProduto` e `somarGastosMensais`, sem arredondar (menos as unidades); não grava nada. Responde 201.

#### Ponto de equilíbrio da empresa

**Novo (BE-31).** `GET /vendas/resumo`, para o painel: o faturamento por mês que paga os gastos mensais, com o mix das vendas **concluídas** dos últimos 30 dias (`dataVenda ≥ agora − 30 dias`).

```
para cada item vendido:
  receita_item = quantidade × precoUnitarioReal
  MC_item      = quantidade × calcularMargemContribuicao(precoUnitarioReal, receita.custo.custoSemGastosMensais, percentuais da venda)
indiceMC        = Σ MC_item ÷ Σ receita_item
pontoEquilibrio = Σ receita = 0 ? { valor: null, motivo: SEM_VENDAS }
                : Σ MC ≤ 0     ? { valor: null, motivo: MARGEM_NEGATIVA }
                : { valor: gastosMensais ÷ indiceMC, motivo: null }                 // calcularPontoEquilibrioEmpresa (vendas.calculos.ts)
```

- O custo variável de cada receita é o **atual**, com o custo médio dos insumos (`ReceitaService.buscarDaEmpresa`, como a venda, BE-30).
- Os percentuais (imposto, taxa do canal e gastos `PERCENTUAL_VENDA`) são os **da venda**, tirados do que ela gravou: `1 − custoUnitario ÷ preco − lucroReal` (`percentuaisSemLucroDaVenda`). Assim a taxa é a do canal da venda mesmo com o canal alterado ou excluído. Venda anterior à BE-30 (sem `lucroReal`) usa os percentuais atuais do Balcão.
- Resposta (`toResumoVendasDto`): `receita`, `margemContribuicao`, `gastosMensais` e `pontoEquilibrio.valor` com 2 casas; `indiceMargemContribuicao` com 4 (`null` sem vendas); `dias`, `dataInicio` e `vendas` (quantas vendas entraram).

### Preço por canal

**Novo (BE-28).** O lucro é sempre medido **sobre o preço**: no preço sugerido, `lucro ÷ preço` é exatamente o lucro configurado.

```
lucro       = receita.lucroPercentual ?? configuracao.lucroPadrao
taxa_canal  = canal.balcao ? configuracao.taxaMaquininha : canal.comissaoPercentual   // taxaDoCanal
percentuais = configuracao.impostoPercentual + taxa_canal + Σ gastos PERCENTUAL_VENDA + lucro
preco       = custoUnitario ÷ (1 − percentuais)
```

- `percentuais ≥ 1` (comparado com `round6`, para o ruído do ponto flutuante não decidir) → sem preço possível: `preco: null`, `motivo: "PERCENTUAIS_ACIMA_DE_100"` e `composicao: null`. A configuração e os canais não barram a soma; o aviso aparece no canal.
- `precos` da receita: um por canal **ativo**, em ordem de criação. `precoSugerido` é sempre o preço do Balcão (taxa da maquininha), mesmo com o canal Balcão desativado, porque é o preço de referência; a simulação o usa como padrão.
- Composição ("para onde vai cada R$ 1"), cada parte com `valor` (reais por unidade) e `fracao` (do preço): `ingredientes`, `gastosMensais`, `trabalho` (**novo**, BE-46), `gastosPorUnidade`, `embalagem` e `perdas` (as partes do custo; `fracao = valor ÷ preço`, 0 com preço 0) e `imposto`, `taxaCanal`, `gastosPercentuais` e `lucro` (`valor = fracao × preço`). As partes somam o preço e as frações somam 1. O frontend agrupa como quiser (ex.: embalagem e perdas juntas).
- Exemplo (critério da BE-28): o pão francês de R$ 0,5822, com imposto 0, maquininha 1,36% e lucro 15%, custa **R$ 0,6961** no Balcão (`0,5822 ÷ 0,8364`); no iFood (15,2%), R$ 0,8341.
- `calcularPercentuaisSemLucro(canal, { impostoPercentual, taxaMaquininha, gastosPercentuais })` (BE-30): imposto + taxa do canal + gastos `PERCENTUAL_VENDA`, os percentuais sem o lucro, que a [venda](#vendas) desconta no lucro real.
- Funções puras: `calcularPreco(custoDetalhado, { imposto, taxaCanal, gastosPercentuais, lucro })`, `calcularPrecoNoCanal(custoDetalhado, canal, { impostoPercentual, taxaMaquininha, gastosPercentuais, lucro })` e `taxaDoCanal` (de `canais`). Sem arredondar (BE-23): o `ReceitaDto` arredonda `preco` e `valor` com 4 casas, e `percentuais` e `fracao` com 4.

### Preço de venda

Origem: `receita.service.ts` (`calcularPrecoVenda`) e `receitas/application/dto/preco-venda.dto.ts`.

```
custo                = receita.custoUnitario      // calculado na leitura (BE-27)
preco_sugerido       = custo × (1 + margem_lucro)
lucro_por_unidade    = preco_sugerido − custo
custo_total_unitario = custo                      // os três com round4 na resposta (BE-23)
```

- `margem_lucro ≥ 0` continua sendo markup sobre o custo nesta rota (contrato do frontend); o preço por canal está em `precos` da receita (BE-28). Não grava nada na receita. Com o custo calculado na leitura, o 400 `RECEITA_SEM_CUSTO` não acontece mais.
- **Muda (BE-10, lacuna 20):** hoje não há arredondamento (`72.11200000000001`). **Muda (BE-23):** o cálculo não arredonda, e a resposta mostra os três campos com 4 casas (`72.112`); a BE-10 aplicava `round2` no meio da conta.
- Função pura `calcularPrecoVenda(custoUnitario, margem)`. Responde 201.

## Estoque de insumos

Origem: `operations-service/src/modules/estoque/` (`estoque.entity.ts`, `prisma-estoque.repository.ts` em `aplicarMovimentacao`, `estoque.service.ts`).

```
entrada: saldo = round6(saldo + quantidade)
saída:   saldo = round6(saldo − quantidade)          // pode ficar negativo
```

- Funções puras em `estoque/domain/estoque.calculos.ts`: `calcularSaldoAposMovimentacao(saldo, tipo, quantidade)` e `calcularQuantidadeBaixa(quantidadePorLote, lotes)`.
- Toda mudança de saldo grava uma movimentação (`tipo`, `origem`, `quantidade`, `referenciaId`) **na mesma transação**. A linha do estoque é travada (`SELECT ... FOR UPDATE`) antes de ler o saldo, para duas movimentações simultâneas não perderem uma atualização.
- Insumo inexistente ou de outra empresa → 404 `INSUMO_NAO_ENCONTRADO` "Insumo não encontrado", conferido pelo `empresa_id` do próprio estoque. Como todo insumo nasce com o registro de estoque (BE-07), não existe mais a resposta com `id: 0` do operations-service para insumo sem registro.
- `GET /estoque/insumos` (BE-11, lacuna 5) devolve um item por insumo da empresa, inclusive os sem movimentação, em ordem de `insumoId`.
- Entrada manual: `quantidade ≥ 0.000001`, origem `COMPRA`, `referenciaId` `null`; a movimentação grava a quantidade como veio (só o saldo leva `round6`). Responde 201. **Muda (BE-11, lacuna 22):** aceita `observacao` (opcional, até 200, aparada; vazia vira `null`). Não mexe no custo do insumo (BE-29).
- Entrada por compra (**novo**, BE-29, `EstoqueService.registrarEntradaPorCompra`, dentro da `tx` da compra): como a manual, com `referenciaId` = id da compra; devolve o saldo anterior, que pondera o custo médio ([Compras de insumo](#compras-de-insumo)). A compra inicial do cadastro também liga a movimentação dela pelo `referenciaId`.
- Baixa por produção (`EstoqueService.baixarPorProducao`, dentro da `tx` da produção): para cada item da receita, `quantidade = round6(item.quantidade × lotes)`, origem `PRODUCAO`, `referenciaId` = id da produção.
- **Saldo negativo é aceito** (lacuna 10, mantida na BE-11 e confirmada como decisão de produto na BE-32): a produção não confere o saldo. **Novo (BE-32):** `Insumo` e `Estoque` trazem `estoqueNegativo` (`estoqueNegativo(saldo)`: `saldo < 0`; 0 não é negativo), para a indicação visual, e o insumo aparece em [`GET /alertas`](#alertas).
- Estoque mínimo começa em 0. **Muda (BE-11, lacuna 14):** `PATCH /estoque/insumos/:id/minimo` define o mínimo (≥ 0), sem movimentação; responde 200.
- Movimentações listadas da mais recente para a mais antiga (o `id` desempata).

## Produções

Origem: `operations-service/src/modules/producoes/application/services/producao.service.ts` (`create`). **Muda (BE-30): sem gasto duplicado.** O custo da produção é o consumo dos insumos ao **custo médio** mais os gastos mensais pelo uso de forno, cada um **uma vez** por lote:

```
gastos            = gasto_indireto_ids omitido → todos os gastos da empresa
                    gasto_indireto_ids = []    → nenhum gasto
totalUnidades     = quantidade × receita.rendimento
custoIngredientes = receita.custo.detalhe.ingredientesLote × quantidade     // Σ item.quantidade × insumo.custoMedio (BE-30)
rateios           = gastos MENSAL
                      .map(g => g.valor × usoPorLote × quantidade ÷ capacidadeMensal)   // calcularGastoNoCusto
custoTrabalho     = receita.custo.detalhe.trabalhoLote × quantidade         // seu trabalho (BE-47), com o valor da hora de agora
custoTotal        = custoIngredientes + Σ rateios + custoTrabalho
custoUnitario     = totalUnidades > 0 ? custoTotal / totalUnidades : 0
```

Exemplo (critério da BE-30): 2 lotes do pão francês (ingredientes de R$ 3,305 por lote, gastos mensais de R$ 2.435, capacidade de 100 fornadas, 1 fornada por lote) custam `6,61 + 2.435 × 2 ÷ 100 = 6,61 + 48,70` = **R$ 55,31**, com os gastos de 2 fornadas uma vez só. Até a BE-29, o custo da receita (que já tinha todos os gastos) era multiplicado pelos lotes e os gastos eram rateados de novo por cima.

- **Novo (BE-47): seu trabalho.** `custoTrabalho = lotes × trabalhoLote` ([Seu trabalho no custo](#seu-trabalho-no-custo)) entra no `custoTotal` como os ingredientes e o forno, e fica gravado na coluna `custo_trabalho`: mudar o valor da hora depois **não** muda produções antigas (como o rateio). Exemplo (critério da BE-47): 2 lotes com R$ 12,50 de trabalho por lote (40 min a R$ 18,75) gravam `custoTrabalho` **25** e somam R$ 25 ao `custoTotal`. O custo é por lote e o `rendimento` já é de unidades boas, então o trabalho das unidades perdidas já está nas boas (`custoUnitario = custoTotal ÷ lotes × rendimento`), sem fórmula de perda na produção. As produções anteriores à BE-47 ficam com `custoTrabalho` `null` (lido como 0; o `custoTotal` delas não tem trabalho). Com `valorHora` 0 (o padrão) ou minutos 0, `custoTrabalho` é 0 e nada muda.
- Não há custo médio do estoque pronto: o saldo de produto acabado só guarda quantidades, e a venda copia o `custoUnitario` da receita (`buscarDaEmpresa`, que já tem o trabalho desde a BE-46), não o da produção. Por isso a margem realizada e o lucro real das vendas não precisaram de fórmula nova na BE-47.
- **Muda (BE-30):** só os gastos `MENSAL` geram rateio. `POR_UNIDADE`, embalagem e perda são custos da unidade **vendida** e ficam no custo da receita e no da venda; `PERCENTUAL_VENDA` é fração do preço, não custo. Por isso o `custoUnitario` da produção é menor que o da receita: ele mede o que o lote custou para sair do forno.
- **Muda (BE-30):** os ingredientes entram ao `custoMedio` dos insumos ([Insumos](#insumos)), não à reposição, que só forma o preço. `RateioProducao` continua: guarda a parte de cada gasto mensal, e o frontend mostra os rateios.
- **Muda (BE-23):** sem o `round2` de hoje; a produção grava os valores exatos e a resposta mostra `custoTotal` e `valorRateado` com 2 casas e `custoUnitario` com 4.
- `quantidade` é o número de **lotes** (inteiro > 0). `usoPorLote` vem da [ficha técnica](#ficha-técnica) e `capacidadeMensal` da [configuração de custos](#configuração-de-custos) (buscada na mesma transação).
- Efeitos, **numa transação só** no monolito (BE-12): grava a produção e os rateios, dá baixa nos insumos (saldo negativo continua permitido, lacuna 10) e dá entrada de `totalUnidades` no estoque de produto acabado da receita. Hoje são chamadas HTTP e eventos sem compensação.
- **Muda (BE-12):** a receita e os gastos precisam ser da empresa do token (lacuna 11); a produção grava `totalUnidades` (lacuna 23) e a descrição do gasto em cada rateio.
- **Muda (BE-12):** id repetido em `gasto_indireto_ids` conta uma vez (`buscarVariosDaEmpresa`); hoje cada repetição soma o rateio de novo.
- Função pura `calcularProducao({ rendimento, ingredientesLote, usoPorLote?, trabalhoLote? }, lotes, gastos, capacidadeMensal)` (devolve também `custoTrabalho`, BE-47) em `producoes/domain/producoes.calculos.ts`, com o `calcularGastoNoCusto` da BE-26. Os rateios saem na ordem dos gastos (com o id omitido, a de `GET /gastos-indiretos`: id decrescente).
- Uma falha em qualquer passo (ex.: insumo sem registro de estoque → 404) desfaz tudo: produção, rateios, baixas e entrada de produto acabado.

### Produção com receita dentro de receita

**Novo (BE-41).** Produzir uma receita que usa outras ([Receita dentro de receita](#receita-dentro-de-receita)) faz o que a cozinha faz: o Brownie Dois Amores tira brownie e brigadeiro do estoque pronto. Na mesma transação da produção:

```
para cada receita usada:
  saida = quantidade por lote × lotes            // na unidade do rendimento da usada; calcularReceitasUsadas
  saldo pronto da usada = round6(saldo − saida)  // pode ficar negativo
```

- Dá baixa nos insumos da própria receita, como antes; os insumos das receitas usadas **não** são baixados de novo (saíram quando elas foram produzidas).
- Grava uma movimentação `SAIDA` / origem `PRODUCAO` por receita usada, com `referenciaId` = id da produção (`EstoqueProdutoAcabadoService.saidaPorProducao`, com a linha travada e o saldo criado zerado se ainda não existir).
- O saldo pronto da receita usada **pode ficar negativo**, a mesma decisão do estoque de insumos (lacuna 10): sem brigadeiro branco pronto, 2 lotes do Brownie Dois Amores (150 g por lote) deixam o saldo dele em −300 g, e `GET /alertas` o lista em `produtosNegativos`. A **venda continua** exigindo saldo: concluir sem saldo → 422 `ESTOQUE_INSUFICIENTE`.
- **Custo:** o `ingredientesLote` ao custo médio (BE-30) já inclui as receitas usadas (BE-40). A produção **não rateia de novo o forno** das receitas usadas: o forno delas foi cobrado quando elas foram produzidas, e só o `usoPorLote` da receita produzida gera rateio.
- O custo das receitas usadas é **calculado na hora** (`custoParaUso`: ingredientes ao custo médio + forno + trabalho, desde a BE-46, + perda), **não copiado** da produção que as gerou. Se o insumo do brigadeiro mudou de custo médio entre a produção dele e a do Brownie Dois Amores, vale o custo médio atual.
- A produção guarda o que saiu em `receita_usada_producao` (`ReceitaUsadaProducao`: `receitaId` sem FK, `nome` e `unidade` copiados na hora, `quantidade` = por lote × lotes) e devolve `receitasUsadas: [{ receitaId, nome, quantidade, unidade }]` (`[]` na receita só com insumos).
- Receita só com insumos: nada muda.

## Estoque de produto acabado

Origem: `operations-service/src/modules/estoque-produto-acabado/` (`estoque-produto-acabado.service.ts` e `prisma-estoque-produto-acabado.repository.ts`).

```
entrada por produção: saldo = round6(saldo + totalUnidades)
saída por venda:      se saldo < quantidade → erro "Estoque insuficiente..."
                      senão saldo = round6(saldo − quantidade)
```

- Um saldo por receita, com movimentações (`ENTRADA` na produção, `SAIDA` na venda e, desde a BE-41, `SAIDA/PRODUCAO` quando a receita é usada dentro de outra que foi produzida; essa saída aceita saldo negativo, a da venda não).
- **Novo (BE-41):** `GET /estoque/produtos` devolve `estoqueNegativo` (saldo < 0) e o `vendavel` da receita. A rota mora no módulo `producoes` (`EstoqueProntoController`), porque o `estoque` não pode depender de `receitas` (ciclo pelo `insumos`).
- **Muda (BE-12):** a falta de saldo responde 422 `ESTOQUE_INSUFICIENTE` (hoje é 400 dentro do consumidor do evento), com a mesma mensagem de hoje: "Estoque insuficiente para a receita {id}: disponível {saldo}, solicitado {quantidade}", que o frontend detecta. Nova rota `GET /estoque/produtos` (lacuna 6).
- `EstoqueProdutoAcabadoService` (módulo `estoque`): `entradaPorProducao(receitaId, totalUnidades, producaoId, empresaId, tx)` cria o saldo zerado na primeira produção e `saidaPorVenda(receitaId, quantidade, vendaId, empresaId, tx)` é a baixa da venda (BE-13). Os dois rodam na transação de quem chama, com a linha travada (`FOR UPDATE`), e gravam a movimentação (`ENTRADA/PRODUCAO` ou `SAIDA/VENDA`, `referenciaId` = id da produção ou da venda, quantidade como veio). Receita sem saldo vale 0 na saída.
- Função pura `calcularSaidaProdutoAcabado(receitaId, disponivel, quantidade)` em `estoque/domain/estoque.calculos.ts`; a entrada usa `calcularSaldoAposMovimentacao`.

## Vendas

Origem: `sales-service/src/modules/vendas/application/services/venda.service.ts` (`create`, `atualizarStatus`) e `create-venda.dto.ts`. **Muda (BE-30): venda por canal com lucro real.**

```
canal               = canal_id ?? Balcão da empresa                             // CanalVendaService.buscarParaVenda
custoUnitario       = receita.custo.custoUnitario                               // fórmula da receita com o custo médio dos insumos (BE-30)
percentuaisSemLucro = impostoPercentual + taxaDoCanal(canal) + Σ gastos PERCENTUAL_VENDA   // calcularPercentuaisSemLucro
lucroReal           = custoUnitario != null ? 1 − percentuaisSemLucro − custoUnitario ÷ preco : null
margemRealizada     = custoUnitario != null ? (preco − custoUnitario) / preco : null       // legada
total               = Σ quantidade × preco
status inicial      = PENDENTE
```

- O lucro real está na **mesma base do lucro do preço** (fração do preço): vendido pelo preço sugerido do canal, ele é o lucro configurado. Exemplo (critério da BE-30): o pão francês de R$ 0,5822 vendido no Balcão pelo preço sugerido (R$ 0,6961, maquininha de 1,36%) tem lucro real de **15%**; no iFood (15,2%) pelo mesmo preço, `1 − 0,152 − 0,8364` = **1,16%**. Com o preço digitado em centavos (R$ 0,70), o Balcão dá 15,47%.
- O custo usa o **custo médio** dos insumos (o que já foi pago), e o preço sugerido usa a reposição: depois de uma alta de preço, vender pelo preço novo mostra o lucro real maior enquanto o estoque antigo dura.
- `canal_id` é opcional (Balcão se omitido); qualquer canal da empresa vale, ativo ou não. Canal de outra empresa → 404 `CANAL_VENDA_NAO_ENCONTRADO`. A venda grava o `canalId` (`SET NULL` se o canal for excluído) e cada item grava o `lucroReal`, sem arredondar; os dois são `null` nas vendas anteriores à BE-30.
- `margemRealizada` continua no contrato (o frontend atual a valida) e sai quando o frontend usar o lucro real ([api.md](api.md#campos-legados-mantidos)).

**Muda (BE-23):** a venda grava os valores exatos (inclusive o `custoUnitario` exato da receita); a resposta mostra `total` com 2 casas e `custoUnitario`, `margemRealizada` e `lucroReal` com 4.

- Item: `receita_id` inteiro > 0, `quantidade` inteiro > 0, `preco_unitario_real` > 0 com até 2 casas.
- **Novo (BE-41):** receita com `vendavel: false` (só usada dentro de outras) → 422 `RECEITA_NAO_VENDIDA_SOZINHA` no registro (`validarReceitaVendavel` em `vendas.calculos.ts`).
- Receita sem `custoUnitario` → `custoUnitario`, `margemRealizada` e `lucroReal` do item ficam `null` (a venda é registrada mesmo assim). Desde a BE-27 o custo é sempre calculado, então isso só acontece com vendas antigas. A margem e o lucro real podem ser negativos (preço abaixo do custo).
- Transições: só `PENDENTE` muda, para `CONCLUIDA` ou `CANCELADA`. Venda `CONCLUIDA` ou `CANCELADA` → 422 `VENDA_FINALIZADA` "Venda já finalizada não pode ser alterada". **Muda (BE-13):** o status passa de 400 para 422, e `PENDENTE` → `PENDENTE` (hoje aceito sem efeito) dá 422 `TRANSICAO_INVALIDA` "Venda pendente só pode ser concluída ou cancelada".
- O registro não confere o estoque (lacuna 24, mantida): a barreira é a conclusão.
- **Muda (BE-13):** concluir dá baixa de cada item no produto acabado **na mesma transação** da mudança de status. Sem saldo → 422 "Estoque insuficiente..." e a venda continua `PENDENTE` (lacuna 9). Hoje a baixa é assíncrona e a venda fica `CONCLUIDA` mesmo sem saldo.
- **Muda (BE-13):** `itens` não pode ser vazio (lacuna 25); a receita precisa ser da empresa (lacuna 26); filtros inválidos dão 400 (lacuna 8).
- A conclusão percorre os itens na ordem em que foram gravados, chamando `EstoqueProdutoAcabadoService.saidaPorVenda` (trava a linha do saldo; `SAIDA/VENDA`, `referenciaId` = id da venda, uma movimentação por item). Vários itens da mesma receita somam: o segundo já vê o saldo descontado do primeiro. A mudança de status usa `UPDATE ... WHERE status = 'PENDENTE'`: duas conclusões simultâneas da mesma venda não dão baixa duas vezes (a segunda recebe `VENDA_FINALIZADA`). Cancelar não mexe no estoque.
- Listagem: filtros `status`, `dataInicio` (`dataVenda ≥`) e `dataFim` (`dataVenda ≤`), da mais recente para a mais antiga (`prisma-venda.repository.ts`, `findAll`); o `id` desempata. **Muda (BE-13, lacuna 7):** as datas precisam ter data, hora e fuso (`Z` ou `±hh:mm`), como a web envia (`toISOString()`); só a data → 400.
- `Venda` é a única entidade de classe do projeto (BE-13, `vendas/domain/venda.entity.ts`): `Venda.nova(empresaId, itens, { canalId, percentuaisSemLucro })` (margem, lucro real, total e status inicial), `calcularMargemRealizada`, `calcularLucroReal` (BE-30), `calcularTotal` e `alterarStatus` (transições) ficam nela.

## Alertas

**Novo (BE-32).** `GET /alertas` junta o que o frontend avisa ao entrar. Só lê; o módulo `alertas` não tem tabela. Funções puras em `alertas/domain/alertas.calculos.ts` (`alertasDeEstoqueNegativo`, `alertasDePrecoDefasado`, desde a BE-41 `alertasDeProdutoNegativo` e desde a BE-47 `valorHoraVazio`), com as regras de `estoque` (`estoqueNegativo`) e de `insumos` (`calcularAumentoReposicao` e `precoDefasado`).

```
estoqueNegativo:  saldo < 0
aumento:          custoReposicao ÷ custoMedio − 1               // null com custoMedio ≤ 0
precoDefasado:    round6(aumento) > 0,10                        // mais de 10%
```

- **Estoque negativo**: insumos da empresa com saldo < 0, por nome, com `id`, `nome`, `saldo` e `unidade`. O estoque negativo continua permitido; o alerta só avisa.
- **Preço defasado**: insumos cuja reposição (`precoMercado ?? ultimoCusto`, [Compras de insumo](#compras-de-insumo)) subiu **mais** de 10% sobre o custo médio, por nome. O estoque foi comprado mais barato do que custa repor: o preço sugerido, que já usa a reposição, subiu, e quem vende pelo preço antigo perde margem. 10% exatos não contam; o aumento é comparado com 6 casas para o erro de ponto flutuante não fazer 10% virar "mais de 10%". Custo médio ≤ 0 não tem base e nunca está defasado. Uma reposição abaixo do médio também não é alerta.
- Cada insumo defasado traz as receitas que o usam (vazia se nenhuma), com o preço no **Balcão** (`ReceitaService.listarPrecosSugeridos`): `precoSugerido`, o novo, com o custo de reposição (o mesmo de `GET /receitas/:id`), e `precoComCustoMedio`, o mesmo preço com o custo médio dos insumos, para a pessoa ver quanto o preço subiu. Os preços só são calculados quando há insumo defasado. **Muda (BE-40):** uma receita também usa os insumos das receitas usadas dentro dela; as receitas com `vendavel: false` não têm preço e ficam de fora.
- **Produtos negativos (novo, BE-41)**: receitas com o estoque pronto < 0, por nome, com `receitaId`, `nome`, `saldo` (6 casas) e `unidade` (a `unidadeRendimento` da receita), para o aviso "registre a produção do Brigadeiro branco". Acontece quando a receita é usada dentro de outra sem a produção dela ter sido registrada. Os nomes só são buscados quando há saldo negativo (ou quando o valor da hora é 0, para o alerta abaixo).
- **Valor da hora vazio (novo, BE-47)**: `valorHoraVazio = valorHora ≤ 0 && alguma receita com minutosTrabalhoPorLote > 0`. A dona informou quanto tempo trabalha no lote, mas não quanto vale a hora dela: até preencher o "valor da sua hora" na configuração de custos, o seu trabalho não entra no custo nem no preço. Com o valor da hora maior que 0, ou sem minutos em nenhuma receita (vendável ou não), é `false`.
- Arredondamento só na resposta: custos com 6 casas, `aumentoPercentual` (fração) e preços com 4.

## Lacunas do backend atual

A lista numerada está em [`lucroai-frontend/docs/api-integration.md#lacunas-do-backend`](https://github.com/victorschmidt21/lucroai-frontend/blob/main/docs/api-integration.md#lacunas-do-backend). Destino de cada uma no monolito:

| # | Lacuna | Destino | Issue | Como / por quê |
| --- | --- | --- | --- | --- |
| 1 | DTOs sem `@ApiProperty` | corrigida | BE-04 | CLI plugin do Swagger documenta os DTOs pelos tipos e pelo JSDoc |
| 2 | sem prefixo `/v1` | mantida | BE-04 | é o contrato do frontend; sem `enableVersioning` |
| 3 | sem `refresh`, `logout` nem `/auth/me` | mantida | BE-06 | o frontend não usa; a sessão vem do payload do JWT de 4 h |
| 4 | sem endpoint de painel | corrigida em parte | BE-31 | `GET /vendas/resumo` traz o ponto de equilíbrio da empresa; o resto do painel o frontend continua calculando no cliente |
| 5 | sem listagem de estoque | corrigida | BE-07, BE-11 | `quantidadeMinima` no `Insumo` e `GET /estoque/insumos` |
| 6 | estoque de produto acabado não exposto | corrigida | BE-12 | `GET /estoque/produtos` |
| 7 | filtro de data das vendas com `YYYY-MM-DD` | corrigida | BE-13 | só aceita data e hora ISO 8601 completas, comparadas como instantes (o formato que a web já envia) |
| 8 | filtros inválidos derrubam o serviço (500) | corrigida | BE-12, BE-13 | query validada por DTO → 400 |
| 9 | venda concluída sem estoque fica `CONCLUIDA` | corrigida | BE-13 | baixa e status na mesma transação |
| 10 | produção aceita saldo negativo de insumo | mantida | BE-11, BE-32 | decisão de produto (2026-11-21): continua permitido, com `estoqueNegativo` nas listas e o aviso em `GET /alertas` |
| 11 | produção não confere a empresa da receita e dos gastos | corrigida | BE-08, BE-12 | `buscarVariosDaEmpresa` e receita da empresa → 404 |
| 12 | nome do insumo sem limite no DTO | corrigida | BE-07 | `@MaxLength(80)` e trim |
| 13 | exclusão de insumo usado em receita | corrigida | BE-05, BE-07 | FK `RESTRICT` → 409 `INSUMO_EM_USO` |
| 14 | sem endpoint de estoque mínimo | corrigida | BE-11 | `PATCH /estoque/insumos/:id/minimo` |
| 15 | `ReceitaCusto` em `snake_case` | mantida | BE-10 | é o contrato do frontend |
| 16 | links HATEOAS incorretos | corrigida | BE-04 | sem envelope: a resposta é o JSON do recurso |
| 17 | seeds com `EMPRESA_ID = 1` fixo | corrigida | BE-14 | um seed só, pelos ids reais |
| 18 | custo invisível soma todos os gastos da empresa | corrigida | BE-09, BE-26, BE-27, BE-30 | continua somando todos os gastos (é a regra do cálculo novo), mas pelo tipo: o gasto mensal é dividido pela capacidade mensal (vezes o uso de forno da receita, BE-27) e não entra mais inteiro em cada lote (BE-26); a duplicidade na produção saiu na BE-30 (a produção soma só os ingredientes e os gastos mensais do forno, uma vez). O seed grava com a mesma regra, então seed e API batem |
| 19 | `GET /estoque/insumos/:id` de insumo inexistente → 404 | mantida | BE-11 | é o comportamento certo (inexistente ou de outra empresa) |
| 20 | preço de venda sem arredondamento | corrigida | BE-10, BE-23 | 4 casas na resposta (`round4`); a BE-10 usava `round2` |
| 21 | `PUT /receitas/:id` não remove a margem | corrigida | BE-09, BE-27 | a BE-09 fazia `margem_lucro: null` limpar margem e preço sugerido; desde a BE-27 a margem não é gravada, e `null` volta ao lucro padrão da empresa |
| 22 | entrada de estoque sem `observacao` | corrigida | BE-05, BE-11 | campo opcional gravado na movimentação |
| 23 | produção sem total de unidades | corrigida | BE-05, BE-12 | `totalUnidades` gravado |
| 24 | `POST /vendas` não confere estoque | mantida | BE-13 | a barreira é a conclusão, como hoje |
| 25 | `POST /vendas` aceita itens vazios | corrigida | BE-13 | `@ArrayNotEmpty()` |
| 26 | `POST /vendas` não confere a empresa da receita | corrigida | BE-13 | receita de outra empresa → 404 |
| 27 | simulação divide por preço 0 | corrigida | BE-10 | 400 `PRECO_INVALIDO` |
