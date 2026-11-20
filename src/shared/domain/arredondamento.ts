/**
 * Arredondamentos do LucroAI. Usam `Number(v.toFixed(n))`, a mesma
 * implementação dos microsserviços, para os valores baterem também nos casos
 * de borda do ponto flutuante (ex.: `round2(1.005)` dá `1`). Não troque por
 * `Math.round(v * 100) / 100`.
 */

/** Dinheiro e margem projetada da simulação. */
export function round2(valor: number): number {
  return Number(valor.toFixed(2));
}

/** Margem realizada da venda. */
export function round4(valor: number): number {
  return Number(valor.toFixed(4));
}

/** Quantidades de estoque e saldos. */
export function round6(valor: number): number {
  return Number(valor.toFixed(6));
}
