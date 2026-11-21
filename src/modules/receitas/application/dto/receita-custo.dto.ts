import { round2, round4 } from '../../../../shared/domain/arredondamento.js';
import type { CustoReceita } from '../../domain/receitas.calculos.js';

/** Custo de N lotes, em `snake_case` como hoje (lacuna 15). */
export class ReceitaCustoDto {
  /** @example 3 */
  quantidade_lotes: number;
  /** `rendimento × lotes`. @example 36 */
  total_unidades: number;
  /** Rateio de todos os gastos da empresa para os lotes, com 2 casas. @example 2100 */
  custo_invisivel: number;
  /** Itens + custo invisível, com 2 casas. @example 2129.1 */
  custo_total_producao: number;
  /** `custo_total_producao / total_unidades`, com 4 casas. @example 59.1417 */
  custo_por_unidade: number;
}

export function toReceitaCustoDto(custo: CustoReceita): ReceitaCustoDto {
  return {
    quantidade_lotes: custo.lotes,
    total_unidades: custo.totalUnidades,
    custo_invisivel: round2(custo.custoInvisivel),
    custo_total_producao: round2(custo.custoProducao),
    custo_por_unidade: round4(custo.custoUnitario),
  };
}
