/**
 * Arredondamentos do LucroAI (BE-23). Só se arredonda na **saída** (DTOs de
 * resposta): as funções de `domain/` calculam a cadeia de custo e preço sem
 * arredondar no meio da conta.
 *
 * Meio para cima, longe do zero (`round2(1.005)` dá `1.01` e
 * `round2(-1.005)` dá `-1.01`). O valor escalado passa por `toPrecision(15)`
 * antes do `Math.round` para descartar o ruído do ponto flutuante: sem isso,
 * `1.005 × 100` dá `100.49999999999999` e `3 + 0.05 + 0.255` dá
 * `3.3049999999999997`, e o centavo cairia para baixo. Por isso não use
 * `Number(v.toFixed(n))` (o dos microsserviços) nem `Math.round(v * 100) / 100`.
 */
function arredondar(valor: number, casas: number): number {
  if (!Number.isFinite(valor)) return valor;
  const fator = 10 ** casas;
  const escalado = Number((Math.abs(valor) * fator).toPrecision(15));
  const resultado = (Math.sign(valor) * Math.round(escalado)) / fator;
  // Evita `-0` (ex.: `round2(-0.001)`).
  return resultado === 0 ? 0 : resultado;
}

/** Totais em reais. */
export function round2(valor: number): number {
  return arredondar(valor, 2);
}

/** Custo unitário, preço e frações (margens e percentuais). */
export function round4(valor: number): number {
  return arredondar(valor, 4);
}

/** Custo por unidade-base do insumo, quantidades de estoque e saldos. */
export function round6(valor: number): number {
  return arredondar(valor, 6);
}
