import {
  calcularGastoNoCusto,
  type GastoParaCusto,
} from '../../gastos-indiretos/domain/gastos-indiretos.calculos.js';

export interface ReceitaParaProducao {
  rendimento: number;
  /**
   * Custo dos ingredientes de 1 lote ao **custo médio** dos insumos (BE-30),
   * sem os gastos.
   */
  ingredientesLote: number;
  /** Fornadas ou minutos de forno de 1 lote (BE-27); 1 se omitido. */
  usoPorLote?: number;
}

export interface GastoParaProducao extends GastoParaCusto {
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
 * Custo de uma produção de `lotes` lotes. **Muda (BE-30):** é o consumo dos
 * insumos ao custo médio mais os gastos `MENSAL` pelo uso de forno
 * (`valor × usoPorLote × lotes ÷ capacidadeMensal`), cada um **uma vez**.
 * Antes, o custo da receita (que já tinha todos os gastos) era multiplicado
 * pelos lotes e os gastos eram rateados de novo por cima.
 * `POR_UNIDADE`, embalagem e perda são custos da unidade vendida e ficam no
 * custo da receita e da venda; `PERCENTUAL_VENDA` é fração do preço. Nenhum
 * deles gera rateio na produção.
 * Sem arredondamento (BE-23): o `ProducaoDto` arredonda a resposta.
 */
export function calcularProducao(
  receita: ReceitaParaProducao,
  lotes: number,
  gastos: GastoParaProducao[],
  capacidadeMensal: number,
): CalculoProducao {
  const totalUnidades = lotes * receita.rendimento;
  const custoIngredientes = receita.ingredientesLote * lotes;
  const uso = {
    lotes,
    totalUnidades,
    capacidadeMensal,
    usoPorLote: receita.usoPorLote,
  };
  const rateios = gastos
    .filter((gasto) => gasto.tipo === 'MENSAL')
    .map((gasto) => ({
      gastoIndiretoId: gasto.id,
      descricao: gasto.descricao,
      valorRateado: calcularGastoNoCusto(gasto, uso),
    }));
  const totalRateio = rateios.reduce((acc, r) => acc + r.valorRateado, 0);
  const custoTotal = custoIngredientes + totalRateio;
  const custoUnitario = totalUnidades > 0 ? custoTotal / totalUnidades : 0;
  return { totalUnidades, custoTotal, custoUnitario, rateios };
}
