export type MetodoRateio = 'FIXO' | 'PROPORCIONAL' | 'POR_UNIDADE';

export interface GastoParaRateio {
  valor: number;
  metodoRateio: MetodoRateio;
}

/**
 * Valor de um gasto rateado para `lotes` lotes que rendem `totalUnidades`.
 * Origem: `calcularValorRateado` do `producao.service.ts` (operations-service)
 * e do `default-custo-invisivel-result.provider.ts` (recipe-service), que têm
 * a mesma fórmula. Usada pelas receitas (BE-09) e pelas produções (BE-12).
 * Sem arredondamento (BE-23): o valor entra no custo da receita e da produção.
 */
export function calcularValorRateado(
  gasto: GastoParaRateio,
  lotes: number,
  totalUnidades: number,
): number {
  switch (gasto.metodoRateio) {
    case 'FIXO':
      return gasto.valor;
    case 'PROPORCIONAL':
      return gasto.valor * lotes;
    case 'POR_UNIDADE':
      return gasto.valor * totalUnidades;
  }
}
