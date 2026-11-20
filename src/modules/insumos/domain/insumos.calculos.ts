/**
 * Custo de uma unidade da base de custo: `valorPago / quantidadeBaseCusto`.
 * **Sem arredondamento**, como `insumo.entity.ts` do catalog-service
 * (`calcularCustoUnitario`): quem usa o custo arredonda depois (o item da
 * receita, por exemplo). Base ≤ 0 dá 0; o DTO já exige base > 0.
 */
export function calcularCustoUnitario(
  valorPago: number,
  quantidadeBaseCusto: number,
): number {
  return quantidadeBaseCusto > 0 ? valorPago / quantidadeBaseCusto : 0;
}
