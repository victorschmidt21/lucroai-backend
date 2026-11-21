import {
  calcularValorRateado,
  type GastoParaRateio,
} from '../../gastos-indiretos/domain/gastos-indiretos.calculos.js';

export interface ReceitaParaProducao {
  rendimento: number;
  /** Custo SALVO de 1 lote (já inclui o custo invisível, lacuna 18). */
  custoProducao?: number | null;
}

export interface GastoParaProducao extends GastoParaRateio {
  id: number;
  descricao: string;
}

export interface RateioCalculado {
  gastoIndiretoId: number;
  descricao: string;
  valorRateado: number;
}

export interface CalculoProducao {
  totalUnidades: number;
  custoTotal: number;
  custoUnitario: number;
  rateios: RateioCalculado[];
}

/**
 * Custo de uma produção de `lotes` lotes, com o rateio dos `gastos`.
 * O custo salvo da receita já tem o custo invisível com todos os gastos, e o
 * rateio soma os gastos de novo: é o comportamento atual, mantido junto com a
 * lacuna 18 (docs/business-rules.md#produções).
 * Origem: producao.service.ts (create) do operations-service. Sem
 * arredondamento (BE-23): o `ProducaoDto` arredonda a resposta.
 */
export function calcularProducao(
  receita: ReceitaParaProducao,
  lotes: number,
  gastos: GastoParaProducao[],
): CalculoProducao {
  const totalUnidades = lotes * receita.rendimento;
  const custoBase = (receita.custoProducao ?? 0) * lotes;
  const rateios = gastos.map((gasto) => ({
    gastoIndiretoId: gasto.id,
    descricao: gasto.descricao,
    valorRateado: calcularValorRateado(gasto, lotes, totalUnidades),
  }));
  const totalRateio = rateios.reduce((acc, r) => acc + r.valorRateado, 0);
  const custoTotal = custoBase + totalRateio;
  const custoUnitario = totalUnidades > 0 ? custoTotal / totalUnidades : 0;
  return { totalUnidades, custoTotal, custoUnitario, rateios };
}
