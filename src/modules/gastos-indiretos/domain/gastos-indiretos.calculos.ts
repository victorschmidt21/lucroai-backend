import { round2 } from '../../../shared/domain/arredondamento.js';

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
 */
export function calcularValorRateado(
  gasto: GastoParaRateio,
  lotes: number,
  totalUnidades: number,
): number {
  switch (gasto.metodoRateio) {
    case 'FIXO':
      return round2(gasto.valor);
    case 'PROPORCIONAL':
      return round2(gasto.valor * lotes);
    case 'POR_UNIDADE':
      return round2(gasto.valor * totalUnidades);
  }
}
