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
