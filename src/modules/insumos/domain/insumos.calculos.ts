import { round6 } from '../../../shared/domain/arredondamento.js';

/**
 * Custo de uma unidade da base de custo: `valorPago / quantidadeBaseCusto`.
 * **Sem arredondamento**, como `insumo.entity.ts` do catalog-service
 * (`calcularCustoUnitario`): o custo entra no custo da receita, e só o
 * `InsumoDto` o arredonda, com 6 casas (BE-23). Base ≤ 0 dá 0; o DTO de
 * entrada já exige base > 0.
 */
export function calcularCustoUnitario(
  valorPago: number,
  quantidadeBaseCusto: number,
): number {
  return quantidadeBaseCusto > 0 ? valorPago / quantidadeBaseCusto : 0;
}

/**
 * Custo médio móvel depois de uma compra (BE-29), **sem arredondamento**:
 * `(saldo × médioAtual + quantidade × custoCompra) ÷ (saldo + quantidade)`.
 * Com saldo ≤ 0 (o estoque negativo é permitido), o médio passa a ser o custo
 * da compra: não há estoque com custo para ponderar, e um saldo negativo
 * daria peso negativo ao médio antigo.
 * O `custoCompra` é o custo por unidade da compra (`calcularCustoUnitario`
 * de `valorTotal` e `quantidade`).
 */
export function calcularCustoMedio(
  saldoAnterior: number,
  custoMedioAtual: number,
  quantidade: number,
  custoCompra: number,
): number {
  if (saldoAnterior <= 0) return custoCompra;
  return (
    (saldoAnterior * custoMedioAtual + quantidade * custoCompra) /
    (saldoAnterior + quantidade)
  );
}

/**
 * Custo de reposição (BE-29): o que custaria comprar o insumo hoje, usado no
 * preço das receitas. `precoMercado ?? ultimoCusto`: o preço informado sem
 * compra vale mais que o da última compra, até a próxima compra o limpar.
 */
export function calcularCustoReposicao(insumo: {
  precoMercado: number | null;
  ultimoCusto: number;
}): number {
  return insumo.precoMercado ?? insumo.ultimoCusto;
}

/**
 * Preço de mercado depois de um `PATCH /insumos/:id` (BE-29); `undefined`
 * mantém o salvo.
 * - `precoMercado` no corpo vale como veio (`null` limpa e volta ao último
 *   custo);
 * - sem ele, mudar `valorPago` ou `quantidadeBaseCusto` informa o preço novo
 *   (`valorPago / quantidadeBaseCusto`): é assim que o formulário atual do
 *   frontend muda o preço de um insumo, e sem isso a edição não teria efeito
 *   no custo. Reenviar os valores salvos (só trocar o nome) não muda nada.
 */
export function resolverPrecoMercado(
  atual: { valorPago: number; quantidadeBaseCusto: number },
  patch: {
    valorPago?: number;
    quantidadeBaseCusto?: number;
    precoMercado?: number | null;
  },
): number | null | undefined {
  if (patch.precoMercado !== undefined) return patch.precoMercado;
  const valorPago = patch.valorPago ?? atual.valorPago;
  const quantidadeBaseCusto =
    patch.quantidadeBaseCusto ?? atual.quantidadeBaseCusto;
  if (
    valorPago === atual.valorPago &&
    quantidadeBaseCusto === atual.quantidadeBaseCusto
  ) {
    return undefined;
  }
  return calcularCustoUnitario(valorPago, quantidadeBaseCusto);
}

/** Aumento da reposição sobre o médio acima do qual o preço está defasado (BE-32). */
export const LIMITE_PRECO_DEFASADO = 0.1;

/**
 * Quanto a reposição subiu sobre o custo médio (BE-32), em fração:
 * `custoReposicao ÷ custoMedio − 1` (0,25 = 25%; negativo quando caiu).
 * `null` com custo médio ≤ 0, que não tem base para comparar.
 */
export function calcularAumentoReposicao(insumo: {
  custoMedio: number;
  precoMercado: number | null;
  ultimoCusto: number;
}): number | null {
  if (insumo.custoMedio <= 0) return null;
  return calcularCustoReposicao(insumo) / insumo.custoMedio - 1;
}

/**
 * Preço defasado (BE-32): a reposição subiu **mais** de 10% sobre o custo
 * médio, então o estoque foi comprado mais barato do que custa repor e o
 * preço formado com o médio ficou para trás. O aumento é comparado com 6
 * casas, para 10% exatos (ex.: 0,0055 ÷ 0,005 − 1 = 0,10000000000000009)
 * não contarem como acima do limite.
 */
export function precoDefasado(insumo: {
  custoMedio: number;
  precoMercado: number | null;
  ultimoCusto: number;
}): boolean {
  const aumento = calcularAumentoReposicao(insumo);
  return aumento !== null && round6(aumento) > LIMITE_PRECO_DEFASADO;
}
