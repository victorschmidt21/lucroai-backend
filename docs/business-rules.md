# Regras de negócio

Fórmulas, arredondamentos e regras do LucroAI. Foram conferidos no código dos microsserviços ([`GrupoDoisENG/lucroai-backend`](https://github.com/GrupoDoisENG/lucroai-backend)), e cada seção cita o arquivo de origem. Os caminhos começam em `services/` daquele repositório. Quando o `OVERVIEW.md` de lá diverge do código, vale o código.

**Os números do monolito precisam ser iguais aos dos microsserviços**, exceto onde esta página diz "muda" e cita a issue que corrige uma lacuna. O frontend mostra esses números e repete alguns cálculos nas prévias.

Cada fórmula vira uma função pura em `src/modules/<modulo>/domain/<modulo>.calculos.ts`, com teste unitário (ver [AGENTS.md](../AGENTS.md#testes)).

## Arredondamento

**Muda (BE-23): arredondar só na saída.** Os microsserviços arredondavam no meio da conta (cada item da receita com 2 casas antes da soma: 15 g × R$ 0,017 = R$ 0,255 virava R$ 0,26), e o erro crescia em produtos baratos com muitos itens. No monolito, toda a cadeia de custo e preço (custo do insumo, itens, custo invisível, custo de produção, custo unitário, preço sugerido, simulação, preço de venda, produção, margem e total da venda) é calculada **sem arredondamento intermediário**, e o banco guarda os valores exatos. Só a resposta da API arredonda, nos DTOs de saída (`to<Entidade>Dto`):

| Valor na resposta | Casas | Função | Campos |
| --- | --- | --- | --- |
| Custo por unidade-base do insumo | 6 | `round6` | `custoUnitario` e `precoUnitario` do insumo |
| Custo unitário e preço | 4 | `round4` | `custoUnitario` e `precoSugerido` da receita, `custo_por_unidade`, `custo_total_unitario`, `preco_sugerido`, `lucro_por_unidade`, `custoUnitario` e `precoVenda` da simulação, `custoUnitario` da produção e do item de venda |
| Totais em reais | 2 | `round2` | `custoCalculado` do item, `custoProducao`, `custo_invisivel`, `custo_total_producao`, `lucroEstimado`, `custoTotal` e `valorRateado` da produção, `total` da venda |
| Frações (margens e percentuais) | 4 | `round4` | `margemProjetada` da simulação (eram 2 casas), `margemRealizada` da venda |

Exemplo (critério da BE-23): farinha 1 kg a R$ 3,00/kg, sal 0,02 kg a R$ 2,50/kg e fermento 15 g a R$ 0,017/g dão custo de ingredientes **R$ 3,305** (`custoIngredientes` de `calcularCustoReceita`), não R$ 3,31 da soma de itens arredondados. Com rendimento 50, o custo unitário é R$ 0,0661 (era R$ 0,07).

- Valores digitados (`valorPago`, `valor` do gasto, `margem_lucro`, `preco_unitario_real`, quantidades) voltam como vieram.
- Quantidades de estoque e saldos continuam com `round6` ao gravar (não são custo nem preço).
- O break-even da simulação é `Math.ceil` de `round6(custo × volume / preço)`: o `round6` só tira o ruído do ponto flutuante (`0.1 × 3 / 0.1` dá `3.0000000000000004`, e o teto daria 4).
- Os services exportados para outros módulos devolvem os valores **sem arredondar**, não o DTO de resposta: `InsumoService.buscarVariosDaEmpresa` devolve os insumos e `ReceitaService.buscarDaEmpresa`, a receita com os itens, como estão no banco.
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

```
custoUnitario = quantidadeBaseCusto > 0 ? valorPago / quantidadeBaseCusto : 0
```

- **Sem arredondamento** (`calcularCustoUnitario`, em `insumos/domain/insumos.calculos.ts`). O custo unitário guarda a divisão inteira, que entra no custo da receita. **Muda (BE-23):** a resposta mostra o custo com 6 casas (`round6`), como o Omie; hoje mostra a divisão inteira.
- Recalculado sempre que `valorPago` ou `quantidadeBaseCusto` mudam.
- `precoUnitario` na resposta é um alias de `custoUnitario` (`insumo.dto.ts`), mantido por compatibilidade.
- Validação: `quantidadeBaseCusto ≥ 0.000001`, `valorPago ≥ 0` e `quantidadeDisponivelInicial ≥ 0` (opcional).
- **Muda (BE-07):** nome obrigatório, aparado e com até 80 caracteres (lacuna 12); excluir insumo usado em receita → 409 `INSUMO_EM_USO` (lacuna 13); resposta ganha `quantidadeMinima` (lacuna 5).
- Criar um insumo sempre cria o registro de estoque (saldo = `quantidadeDisponivelInicial ?? 0`, mínimo 0), na mesma transação, por `EstoqueService.criarRegistroInicial` (BE-07). Com quantidade > 0, cria também uma movimentação `ENTRADA/COMPRA` (sem `referenciaId`). Hoje o estoque nasce por evento (`insumo-criado.consumer.ts`), sem movimentação. O saldo inicial é gravado como veio, sem `round6`, como no consumer.
- `quantidadeDisponivel` e `quantidadeMinima` da resposta vêm do estoque (`EstoqueService.saldosPorInsumo`); insumo sem registro de estoque responde 0 nos dois, como o catalog-service.
- Listagem ordenada por nome (e por id no empate), sem paginação. Hoje a ordem é a do banco.
- `PATCH` aceita só `nome`, `quantidadeBaseCusto`, `unidade` e `valorPago`; campo omitido mantém o valor salvo. O saldo muda só pelo estoque.
- Excluir o insumo leva junto o estoque e as movimentações dele (`CASCADE`). Usado em receita → 409 `INSUMO_EM_USO` "Insumo usado em receitas não pode ser excluído" (P2003 da FK `RESTRICT`, traduzido no `InsumoRepository`).
- Para outros módulos, `InsumoService` exporta `buscarVariosDaEmpresa(ids, empresaId)` (BE-09): ignora ids repetidos e responde 404 `INSUMO_NAO_ENCONTRADO` se algum não existir ou for de outra empresa. Devolve os insumos como estão no banco, com o custo sem arredondar (BE-23).

## Configuração de custos

**Novo (BE-24).** Uma por empresa (tabela `configuracao_custos`, `empresa_id` único), com o que o cálculo novo do épico E7 precisa. Não existe nos microsserviços.

| Campo | O que é | Padrão |
| --- | --- | --- |
| `baseRateio` | o que a capacidade conta: `FORNADAS` ou `MINUTOS` de forno | `FORNADAS` |
| `capacidadeMensal` | fornadas (ou minutos de forno) que a empresa faz por mês | 40 |
| `lucroPadrao` | lucro como fração do **preço de venda** | 0,15 |
| `impostoPercentual` | imposto como fração do preço (informal ou MEI: 0; o DAS do MEI entra como gasto mensal) | 0 |
| `taxaMaquininha` | taxa cobrada no balcão, fração do preço | 0 |

- Os padrões servem para quem está começando e ainda não fatura. Ficam em `CONFIGURACAO_CUSTOS_PADRAO` (`configuracao-custos/domain/configuracao-custos.calculos.ts`) e são também os defaults das colunas.
- A configuração nasce no cadastro da empresa (`ConfiguracaoCustosService.criarPadrao(empresaId, tx)`, chamado pelo `auth` na transação do cadastro), no seed (que a volta aos padrões) e, para as empresas que já existiam, na própria migration `criar_configuracao_custos`.
- Validação (`validarConfiguracaoCustos`), feita depois de mesclar o `PUT` com os valores salvos: `capacidadeMensal > 0`; `lucroPadrao`, `impostoPercentual` e `taxaMaquininha` entre 0 e 1, inclusive. Erro → 400 `DADOS_INVALIDOS`, um `details` por campo, no formato do `ValidationPipe`.
- Os valores são gravados e devolvidos como vieram, sem arredondar.
- Sem pró-labore, regime tributário, anexo do Simples nem faturamento: decisão de simplicidade da BE-24. Como os campos entram no custo e no preço é das issues seguintes do E7 (BE-28).

## Canais de venda

**Novo (BE-25).** Canais por onde a empresa vende (tabela `canal_venda`), cada um com a comissão que cobra sobre o preço, para o preço por canal das issues seguintes do E7. Não existe nos microsserviços.

| Canal padrão | `comissaoPercentual` | `ativo` | Por quê |
| --- | --- | --- | --- |
| Balcão | 0 | sim | a taxa da maquininha vem da [configuração de custos](#configuração-de-custos) (`taxaMaquininha`) |
| iFood | 0,152 | não | 12% do plano básico + 3,2% do pagamento online |
| iFood com entrega | 0,262 | não | 23% do plano com entrega + 3,2% |

- A comissão é fração do **preço de venda**, entre 0 e 1, gravada e devolvida sem arredondar.
- Os padrões ficam em `CANAIS_PADRAO` (`canais/domain/canais.calculos.ts`). Nascem no cadastro da empresa (`CanalVendaService.criarPadrao(empresaId, tx)`, chamado pelo `auth` na transação do cadastro), no seed (que os recria) e, para as empresas que já existiam, na migration `criar_canal_venda`. Todos são editáveis.
- O Balcão é marcado pela coluna `balcao` (o nome pode mudar), que a API não deixa alterar e que canal criado pelo `POST` nunca tem. Excluir o Balcão → 422 `CANAL_BALCAO_NAO_EXCLUIVEL` "O canal Balcão não pode ser excluído" (`garantirCanalExcluivel`). Desativá-lo é permitido: a issue só proíbe a exclusão.
- Os outros canais podem ser excluídos (nada os referencia ainda).

## Gastos indiretos e rateio

Origem do cadastro: `catalog-service/src/modules/gastos-indiretos/` (`create-gasto-indireto.dto.ts`). **Muda (BE-26):** o rateio dos microsserviços (`calcularValorRateado` do `producao.service.ts` e do `default-custo-invisivel-result.provider.ts`) foi removido: ele cobrava os gastos do mês inteiros em cada lote de cada receita (o pão francês do seed chegava a R$ 270). Cada gasto passa a ter um **tipo**, que diz como ele entra no custo.

| `tipo` | O que é o `valor` | Exemplos | Parte no custo de `lotes` lotes |
| --- | --- | --- | --- |
| `MENSAL` | valor do mês | aluguel, luz, gás, água, DAS do MEI, internet | `valor × usoPorLote × lotes ÷ capacidadeMensal` |
| `POR_UNIDADE` | reais por unidade vendida que não é da ficha | saco de pão genérico, etiqueta | `valor × totalUnidades` |
| `PERCENTUAL_VENDA` | fração do preço (0 a menos de 1) | comissão de revendedora | 0: não é custo; entra nos percentuais do preço (BE-28) |

- `capacidadeMensal` vem da [configuração de custos](#configuração-de-custos). `usoPorLote` é o uso de forno do lote (fornadas ou minutos), que a ficha técnica ganha na BE-27; até lá, **todo lote ocupa 1**. Com isso, um gasto mensal de R$ 1.800 e a capacidade padrão de 40 fornadas custam R$ 45 por lote, nunca R$ 1.800.
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
  - Um gasto criado como `PROPORCIONAL` volta como `FIXO`: o frontend aceita, e os dois viraram o mesmo tipo. O legado sai quando o frontend passar a usar o `tipo` (BE-33).
- `valor` é gravado como veio, sem `round2`, como no catalog-service.
- Listagem por `id` decrescente (o mais novo primeiro), como hoje. `PUT` com campos opcionais: campo omitido mantém o valor salvo.
- Gasto de outra empresa ou inexistente → 404 `GASTO_INDIRETO_NAO_ENCONTRADO`.
- Excluir um gasto não apaga os rateios das produções antigas: `rateio_producao.gasto_indireto_id` não tem FK e guarda o id, como nos microsserviços, e o rateio guarda a `descricao`. **Muda (BE-12):** a BE-05 previa `SET NULL`, mas o `gastoIndiretoId` nulo quebraria o schema do frontend (`z.number().int()`, que mostra "Gasto #id").
- Para outros módulos, `GastoIndiretoService` exporta `listarPorEmpresa(empresaId, tx?)` e `buscarVariosDaEmpresa(ids, empresaId, tx?)`. Este último ignora ids repetidos, devolve `[]` para lista vazia e responde 404 se algum id não existir ou for de outra empresa (base da correção da lacuna 11, aplicada na produção pela BE-12).

## Receitas: custo

Origem: `recipe-service/src/modules/custos/application/services/custo.service.ts` (`calcularReceita`, `calcularItens`, `calcularCustoTotalProducao`, `calcularCustoPorUnidade`, `calcularPrecoSugerido`) e `default-custo-invisivel-result.provider.ts`.

Para `lotes` lotes (o cadastro e a edição usam `lotes = 1`):

```
quantidadeItem    = item.quantidade × lotes
custoCalculado    = quantidadeItem × insumo.custoUnitario                // por item
custoIngredientes = Σ custoCalculado
totalUnidades     = rendimento × lotes
custoInvisivel    = Σ calcularGastoNoCusto(gasto, { lotes, totalUnidades, capacidadeMensal })  // TODOS os gastos, pelo tipo (BE-26)
custoProducao     = custoIngredientes + custoInvisivel
custoUnitario     = custoProducao / totalUnidades                       // rendimento ≤ 0 → 400
precoSugerido     = custoUnitario × (1 + margem)                        // só se margem != null
```

**Muda (BE-23):** hoje cada linha arredonda com `round2`; o monolito não arredonda no meio e grava os valores exatos. A resposta arredonda (`custoCalculado`, `custoProducao` e `custo_invisivel` com 2 casas; `custoUnitario` e `precoSugerido` com 4), ver [Arredondamento](#arredondamento).

- **Custo invisível (lacuna 18):** soma **todos** os gastos indiretos da empresa. **Muda (BE-26):** cada gasto entra pelo [tipo](#gastos-indiretos-e-rateio): o mensal dividido pela capacidade mensal (1 fornada por lote até a BE-27), o por unidade multiplicado pelas unidades e o percentual de venda fora do custo. Antes, o Aluguel de R$ 1.800 `FIXO` subia R$ 1.800 o custo de cada receita; agora sobe R$ 45 com a capacidade padrão de 40. A fórmula nova de custo e preço por canal é da BE-28.
- O resultado do custo invisível precisa ser finito e ≥ 0, senão 400 (`obterCustoInvisivel`). Com valores ≥ 0 validados no cadastro, isso não acontece, e o monolito não repete a conferência.
- Rendimento ≤ 0 → 400 `RENDIMENTO_INVALIDO` "Rendimento da receita deve ser maior que zero" (`validarRendimento`). O DTO já exige inteiro positivo.
- Funções puras em `receitas/domain/receitas.calculos.ts`: `calcularCustoItem`, `calcularCustoInvisivel(gastos, rendimento, capacidadeMensal, lotes = 1)` (usa `calcularGastoNoCusto` de `gastos-indiretos`), `calcularPrecoSugerido`, `calcularCustoReceita` (`lotes` opcional, 1 por padrão; devolve também `lotes` e `totalUnidades`), `resolverMargem` e `precisaRecalcular` (BE-09); `simularCenario` e `calcularPrecoVenda` (BE-10). O service busca os insumos por `InsumoService.buscarVariosDaEmpresa`, os gastos por `GastoIndiretoService.listarPorEmpresa` e a capacidade mensal por `ConfiguracaoCustosService.buscarDaEmpresa` (BE-26), sem HTTP.
- Margem é **fração** (`0.6` = 60%), `≥ 0`.
- O item guarda `custoCalculado` para 1 lote. A receita guarda `custoProducao`, `custoUnitario`, `margemLucro` e `precoSugerido`; sem valor, esses campos são **omitidos** na resposta.
- Validação do corpo (`create-receita.dto.ts`): nome até 80, `rendimento` inteiro > 0, `quantidade` do item ≥ 0.001, `insumo_id` inteiro > 0. **Muda (BE-09):** a lista de insumos não pode ser vazia (400), os insumos precisam ser da empresa (404 `INSUMO_NAO_ENCONTRADO`), e o nome passa a ser aparado e obrigatório (como o do insumo e o do gasto).
- Receita inexistente ou de outra empresa → 404 `RECEITA_NAO_ENCONTRADA` "Receita não encontrada". Listagem por `dataCriacao` decrescente (e `id` no empate); itens na ordem em que foram informados.
- Para outros módulos, `ReceitaService` exporta `buscarDaEmpresa(id, empresaId, tx?)`, que devolve a `Receita` com os itens (404 se não for da empresa), para as BE-12 e BE-13. São os valores do banco, sem arredondar (BE-23), e não o `ReceitaDto`.

### Edição

Origem: `recipe-service/src/modules/receitas/application/services/receita.service.ts` (`update`).

- Campo omitido mantém o valor salvo (`null` em `nome`, `rendimento`, `unidadeRendimento` ou `insumos` também mantém; só `margem_lucro` trata `null` como valor).
- Com `insumos`, todos os itens são trocados pelos novos, no mesmo update (atômico).
- O custo só é recalculado se vierem `insumos`, `rendimento` ou `margem_lucro` (inclusive `null`). O recálculo usa os custos atuais dos insumos e os gastos atuais da empresa, inclusive para os itens já salvos. Mudar só `nome` ou `unidadeRendimento` mantém os custos salvos.
- **Muda (BE-09, lacuna 21):** `margem_lucro: null` remove a margem **e** o preço sugerido.
- Mudar o custo de um insumo **não** recalcula as receitas que o usam: o custo é recalculado quando a receita é salva de novo (comportamento atual, mantido).
- **Muda (BE-09):** excluir receita usada em produção ou venda → 409 `RECEITA_EM_USO` "Receita usada em produções ou vendas não pode ser excluída" (P2003 das FKs `RESTRICT` de `producao` e `item_venda`, traduzido no `ReceitaRepository`). Os itens e o estoque de produto acabado vão junto (`CASCADE`).

### Custo para N lotes

Origem: `custo.service.ts` (`calcularPorReceita`, `simularPorReceita`) e `custos/application/dto/receita-custo.dto.ts`.

`GET /receitas/:id/custo` (1 lote) e `POST /receitas/:id/custo/simular` (`quantidadeLotes`, inteiro > 0) **recalculam** com os custos atuais dos insumos e os gastos atuais da empresa, pela fórmula acima. Não usam os valores salvos. A resposta é `snake_case` (lacuna 15, mantida):

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

### Simulação de cenário e break-even

Origem: `recipe-service/src/modules/custos/application/services/simulacao.service.ts` e `simular-cenario.dto.ts`.

```
custo        = novoCusto ?? receita.custoUnitario        // salvo; ausente → 400
preco        = novoPreco ?? receita.precoSugerido        // salvo; ausente → 400
volume       = volume ?? receita.rendimento
margemUnit   = preco − custo
lucroEstimado   = margemUnit × volume
margemProjetada = margemUnit / preco                     // fração
breakEven       = Math.ceil(round6((custo × volume) / preco))   // unidades; o round6 só tira o ruído do ponto flutuante
resposta     = { custoUnitario: round4(custo), precoVenda: round4(preco), volume, lucroEstimado: round2(…), margemProjetada: round4(…), breakEven }
```

- Mensagens atuais (400): "Receita sem custo calculado. Informe novoCusto para simular." (`RECEITA_SEM_CUSTO`) e "Receita sem preço sugerido definido. Informe novoPreco para simular." (`RECEITA_SEM_PRECO`).
- `novoCusto` e `novoPreco` > 0 e `volume` inteiro > 0, quando informados.
- **Muda (BE-10, lacuna 27):** preço igual a 0 (só acontece com o `precoSugerido` salvo igual a 0) → 400 `PRECO_INVALIDO` "Preço de venda deve ser maior que zero. Informe novoPreco para simular.", em vez de devolver `NaN`.
- **Muda (BE-23):** custo e preço com 4 casas (eram 2) e `margemProjetada` com 4 casas (eram 2); o arredondamento fica no `toSimulacaoCenarioDto`.
- Função pura `simularCenario(entrada, receita)`, sem arredondar; não grava nada. Responde 201.

### Preço de venda

Origem: `receita.service.ts` (`calcularPrecoVenda`) e `receitas/application/dto/preco-venda.dto.ts`.

```
custo                = receita.custoUnitario      // salvo; ausente → 400 RECEITA_SEM_CUSTO "Receita sem custo calculado"
preco_sugerido       = custo × (1 + margem_lucro)
lucro_por_unidade    = preco_sugerido − custo
custo_total_unitario = custo                      // os três com round4 na resposta (BE-23)
```

- `margem_lucro ≥ 0`. Não grava nada na receita.
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
- Entrada manual: `quantidade ≥ 0.000001`, origem `COMPRA`; a movimentação grava a quantidade como veio (só o saldo leva `round6`). Responde 201. **Muda (BE-11, lacuna 22):** aceita `observacao` (opcional, até 200, aparada; vazia vira `null`).
- Baixa por produção (`EstoqueService.baixarPorProducao`, dentro da `tx` da produção): para cada item da receita, `quantidade = round6(item.quantidade × lotes)`, origem `PRODUCAO`, `referenciaId` = id da produção.
- **Saldo negativo é aceito** (lacuna 10, mantida na BE-11). Bloquear a produção sem saldo é decisão de produto e pede uma issue própria.
- Estoque mínimo começa em 0. **Muda (BE-11, lacuna 14):** `PATCH /estoque/insumos/:id/minimo` define o mínimo (≥ 0), sem movimentação; responde 200.
- Movimentações listadas da mais recente para a mais antiga (o `id` desempata).

## Produções

Origem: `operations-service/src/modules/producoes/application/services/producao.service.ts` (`create`).

```
gastos          = gasto_indireto_ids omitido → todos os gastos da empresa
                  gasto_indireto_ids = []    → nenhum gasto
totalUnidades   = quantidade × receita.rendimento
custoBase       = receita.custoProducao × quantidade        // custo SALVO da receita (0 se ausente), sem arredondar
rateios         = gastos sem PERCENTUAL_VENDA
                    .map(g => calcularGastoNoCusto(g, { lotes: quantidade, totalUnidades, capacidadeMensal }))
custoTotal      = custoBase + Σ rateios
custoUnitario   = totalUnidades > 0 ? custoTotal / totalUnidades : 0
```

**Muda (BE-23):** sem o `round2` de hoje; a produção grava os valores exatos e a resposta mostra `custoTotal` e `valorRateado` com 2 casas e `custoUnitario` com 4.

- `quantidade` é o número de **lotes** (inteiro > 0).
- O `custoProducao` salvo da receita já contém o custo invisível de 1 lote com todos os gastos (lacuna 18). Por isso os gastos rateados na produção entram **de novo** no `custoTotal`. É o comportamento atual e fica mantido até a BE-30, que tira a duplicidade.
- **Muda (BE-26):** cada gasto é rateado pelo tipo, com a `capacidadeMensal` da configuração de custos da empresa (buscada na mesma transação): o mensal não entra mais inteiro. `PERCENTUAL_VENDA` é fração do preço, não custo, e não gera rateio.
- Efeitos, **numa transação só** no monolito (BE-12): grava a produção e os rateios, dá baixa nos insumos (seção anterior) e dá entrada de `totalUnidades` no estoque de produto acabado da receita. Hoje são chamadas HTTP e eventos sem compensação.
- **Muda (BE-12):** a receita e os gastos precisam ser da empresa do token (lacuna 11); a produção grava `totalUnidades` (lacuna 23) e a descrição do gasto em cada rateio.
- **Muda (BE-12):** id repetido em `gasto_indireto_ids` conta uma vez (`buscarVariosDaEmpresa`); hoje cada repetição soma o rateio de novo.
- Função pura `calcularProducao(receita, lotes, gastos, capacidadeMensal)` em `producoes/domain/producoes.calculos.ts`, com o `calcularGastoNoCusto` da BE-26. Os rateios saem na ordem dos gastos (com o id omitido, a de `GET /gastos-indiretos`: id decrescente).
- Uma falha em qualquer passo (ex.: insumo sem registro de estoque → 404) desfaz tudo: produção, rateios, baixas e entrada de produto acabado.

## Estoque de produto acabado

Origem: `operations-service/src/modules/estoque-produto-acabado/` (`estoque-produto-acabado.service.ts` e `prisma-estoque-produto-acabado.repository.ts`).

```
entrada por produção: saldo = round6(saldo + totalUnidades)
saída por venda:      se saldo < quantidade → erro "Estoque insuficiente..."
                      senão saldo = round6(saldo − quantidade)
```

- Um saldo por receita, com movimentações (`ENTRADA` na produção, `SAIDA` na venda).
- **Muda (BE-12):** a falta de saldo responde 422 `ESTOQUE_INSUFICIENTE` (hoje é 400 dentro do consumidor do evento), com a mesma mensagem de hoje: "Estoque insuficiente para a receita {id}: disponível {saldo}, solicitado {quantidade}", que o frontend detecta. Nova rota `GET /estoque/produtos` (lacuna 6).
- `EstoqueProdutoAcabadoService` (módulo `estoque`): `entradaPorProducao(receitaId, totalUnidades, producaoId, empresaId, tx)` cria o saldo zerado na primeira produção e `saidaPorVenda(receitaId, quantidade, vendaId, empresaId, tx)` é a baixa da venda (BE-13). Os dois rodam na transação de quem chama, com a linha travada (`FOR UPDATE`), e gravam a movimentação (`ENTRADA/PRODUCAO` ou `SAIDA/VENDA`, `referenciaId` = id da produção ou da venda, quantidade como veio). Receita sem saldo vale 0 na saída.
- Função pura `calcularSaidaProdutoAcabado(receitaId, disponivel, quantidade)` em `estoque/domain/estoque.calculos.ts`; a entrada usa `calcularSaldoAposMovimentacao`.

## Vendas

Origem: `sales-service/src/modules/vendas/application/services/venda.service.ts` (`create`, `atualizarStatus`) e `create-venda.dto.ts`.

```
custoUnitario    = receita.custoUnitario                        // snapshot do valor SALVO na hora da venda
margemRealizada  = custoUnitario != null ? (preco − custoUnitario) / preco : null
total            = Σ quantidade × preco
status inicial   = PENDENTE
```

**Muda (BE-23):** a venda grava os valores exatos (inclusive o `custoUnitario` exato da receita); a resposta mostra `total` com 2 casas e `custoUnitario` e `margemRealizada` com 4.

- Item: `receita_id` inteiro > 0, `quantidade` inteiro > 0, `preco_unitario_real` > 0 com até 2 casas.
- Receita sem `custoUnitario` salvo → `custoUnitario` e `margemRealizada` do item ficam `null` (a venda é registrada mesmo assim). A margem pode ser negativa (preço abaixo do custo).
- Transições: só `PENDENTE` muda, para `CONCLUIDA` ou `CANCELADA`. Venda `CONCLUIDA` ou `CANCELADA` → 422 `VENDA_FINALIZADA` "Venda já finalizada não pode ser alterada". **Muda (BE-13):** o status passa de 400 para 422, e `PENDENTE` → `PENDENTE` (hoje aceito sem efeito) dá 422 `TRANSICAO_INVALIDA` "Venda pendente só pode ser concluída ou cancelada".
- O registro não confere o estoque (lacuna 24, mantida): a barreira é a conclusão.
- **Muda (BE-13):** concluir dá baixa de cada item no produto acabado **na mesma transação** da mudança de status. Sem saldo → 422 "Estoque insuficiente..." e a venda continua `PENDENTE` (lacuna 9). Hoje a baixa é assíncrona e a venda fica `CONCLUIDA` mesmo sem saldo.
- **Muda (BE-13):** `itens` não pode ser vazio (lacuna 25); a receita precisa ser da empresa (lacuna 26); filtros inválidos dão 400 (lacuna 8).
- A conclusão percorre os itens na ordem em que foram gravados, chamando `EstoqueProdutoAcabadoService.saidaPorVenda` (trava a linha do saldo; `SAIDA/VENDA`, `referenciaId` = id da venda, uma movimentação por item). Vários itens da mesma receita somam: o segundo já vê o saldo descontado do primeiro. A mudança de status usa `UPDATE ... WHERE status = 'PENDENTE'`: duas conclusões simultâneas da mesma venda não dão baixa duas vezes (a segunda recebe `VENDA_FINALIZADA`). Cancelar não mexe no estoque.
- Listagem: filtros `status`, `dataInicio` (`dataVenda ≥`) e `dataFim` (`dataVenda ≤`), da mais recente para a mais antiga (`prisma-venda.repository.ts`, `findAll`); o `id` desempata. **Muda (BE-13, lacuna 7):** as datas precisam ter data, hora e fuso (`Z` ou `±hh:mm`), como a web envia (`toISOString()`); só a data → 400.
- `Venda` é a única entidade de classe do projeto (BE-13, `vendas/domain/venda.entity.ts`): `Venda.nova` (margem, total e status inicial), `calcularMargemRealizada`, `calcularTotal` e `alterarStatus` (transições) ficam nela.

## Lacunas do backend atual

A lista numerada está em [`lucroai-frontend/docs/api-integration.md#lacunas-do-backend`](https://github.com/victorschmidt21/lucroai-frontend/blob/main/docs/api-integration.md#lacunas-do-backend). Destino de cada uma no monolito:

| # | Lacuna | Destino | Issue | Como / por quê |
| --- | --- | --- | --- | --- |
| 1 | DTOs sem `@ApiProperty` | corrigida | BE-04 | CLI plugin do Swagger documenta os DTOs pelos tipos e pelo JSDoc |
| 2 | sem prefixo `/v1` | mantida | BE-04 | é o contrato do frontend; sem `enableVersioning` |
| 3 | sem `refresh`, `logout` nem `/auth/me` | mantida | BE-06 | o frontend não usa; a sessão vem do payload do JWT de 4 h |
| 4 | sem endpoint de painel | mantida | — | o frontend calcula o painel no cliente; criar a rota pede uma issue própria |
| 5 | sem listagem de estoque | corrigida | BE-07, BE-11 | `quantidadeMinima` no `Insumo` e `GET /estoque/insumos` |
| 6 | estoque de produto acabado não exposto | corrigida | BE-12 | `GET /estoque/produtos` |
| 7 | filtro de data das vendas com `YYYY-MM-DD` | corrigida | BE-13 | só aceita data e hora ISO 8601 completas, comparadas como instantes (o formato que a web já envia) |
| 8 | filtros inválidos derrubam o serviço (500) | corrigida | BE-12, BE-13 | query validada por DTO → 400 |
| 9 | venda concluída sem estoque fica `CONCLUIDA` | corrigida | BE-13 | baixa e status na mesma transação |
| 10 | produção aceita saldo negativo de insumo | mantida | BE-11 | decisão de produto; pede uma issue própria |
| 11 | produção não confere a empresa da receita e dos gastos | corrigida | BE-08, BE-12 | `buscarVariosDaEmpresa` e receita da empresa → 404 |
| 12 | nome do insumo sem limite no DTO | corrigida | BE-07 | `@MaxLength(80)` e trim |
| 13 | exclusão de insumo usado em receita | corrigida | BE-05, BE-07 | FK `RESTRICT` → 409 `INSUMO_EM_USO` |
| 14 | sem endpoint de estoque mínimo | corrigida | BE-11 | `PATCH /estoque/insumos/:id/minimo` |
| 15 | `ReceitaCusto` em `snake_case` | mantida | BE-10 | é o contrato do frontend |
| 16 | links HATEOAS incorretos | corrigida | BE-04 | sem envelope: a resposta é o JSON do recurso |
| 17 | seeds com `EMPRESA_ID = 1` fixo | corrigida | BE-14 | um seed só, pelos ids reais |
| 18 | custo invisível soma todos os gastos da empresa | corrigida em parte | BE-09, BE-26 | continua somando todos os gastos (é a regra do cálculo novo), mas pelo tipo: o gasto mensal é dividido pela capacidade mensal e não entra mais inteiro em cada lote (BE-26); a duplicidade na produção sai na BE-30. O seed grava com a mesma regra, então seed e API batem |
| 19 | `GET /estoque/insumos/:id` de insumo inexistente → 404 | mantida | BE-11 | é o comportamento certo (inexistente ou de outra empresa) |
| 20 | preço de venda sem arredondamento | corrigida | BE-10, BE-23 | 4 casas na resposta (`round4`); a BE-10 usava `round2` |
| 21 | `PUT /receitas/:id` não remove a margem | corrigida | BE-09 | `margem_lucro: null` limpa margem e preço sugerido |
| 22 | entrada de estoque sem `observacao` | corrigida | BE-05, BE-11 | campo opcional gravado na movimentação |
| 23 | produção sem total de unidades | corrigida | BE-05, BE-12 | `totalUnidades` gravado |
| 24 | `POST /vendas` não confere estoque | mantida | BE-13 | a barreira é a conclusão, como hoje |
| 25 | `POST /vendas` aceita itens vazios | corrigida | BE-13 | `@ArrayNotEmpty()` |
| 26 | `POST /vendas` não confere a empresa da receita | corrigida | BE-13 | receita de outra empresa → 404 |
| 27 | simulação divide por preço 0 | corrigida | BE-10 | 400 `PRECO_INVALIDO` |
