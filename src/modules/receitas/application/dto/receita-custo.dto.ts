import type { CustoReceita } from '../../domain/receitas.calculos.js';

/** Custo de N lotes, em `snake_case` como hoje (lacuna 15). */
export class ReceitaCustoDto {
  /** @example 3 */
  quantidade_lotes: number;
  /** `rendimento × lotes`. @example 36 */
  total_unidades: number;
  /** Rateio de todos os gastos da empresa para os lotes. @example 2100 */
  custo_invisivel: number;
  /** Itens + custo invisível. @example 2129.1 */
  custo_total_producao: number;
  /** `custo_total_producao / total_unidades`. @example 59.14 */
  custo_por_unidade: number;
}

export function toReceitaCustoDto(custo: CustoReceita): ReceitaCustoDto {
  return {
    quantidade_lotes: custo.lotes,
    total_unidades: custo.totalUnidades,
    custo_invisivel: custo.custoInvisivel,
    custo_total_producao: custo.custoProducao,
    custo_por_unidade: custo.custoUnitario,
  };
}
