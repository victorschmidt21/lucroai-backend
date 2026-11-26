import type {
  Producao,
  RateioProducao,
  ReceitaUsadaProducao,
  UnidadeMedida,
} from '../../../../generated/prisma/client.js';
import {
  round2,
  round4,
  round6,
} from '../../../../shared/domain/arredondamento.js';

export class RateioProducaoDto {
  /** Continua o mesmo depois de o gasto ser excluído (sem FK). @example 1 */
  gastoIndiretoId: number;
  /** Novo (BE-12): descrição do gasto na hora da produção. @example 'Aluguel' */
  descricao: string;
  /** Com 2 casas. @example 1800 */
  valorRateado: number;
}

/** Receita usada dentro da produzida que saiu do estoque pronto (BE-41). */
export class ReceitaUsadaProducaoDto {
  /** Continua o mesmo depois de a receita ser excluída (sem FK). @example 2 */
  receitaId: number;
  /** Nome da receita na hora da produção. @example 'Brigadeiro preto' */
  nome: string;
  /** Quantidade por lote × lotes, com 6 casas. @example 300 */
  quantidade: number;
  /** Unidade do rendimento da receita usada. @example 'G' */
  unidade: UnidadeMedida;
}

export class ProducaoDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  receitaId: number;
  /** @example 1 */
  empresaId: number;
  /** Lotes. @example 3 */
  quantidade: number;
  /** Novo (BE-12, lacuna 23): lotes × rendimento. @example 36 */
  totalUnidades: number;
  /** Com 2 casas. @example 13492.14 */
  custoTotal: number | null;
  /** Com 4 casas. @example 374.7817 */
  custoUnitario: number | null;
  /** @example '2026-11-19T12:00:00.000Z' */
  dataProducao: Date;
  rateios: RateioProducaoDto[];
  /**
   * Novo (BE-41): receitas usadas dentro desta que saíram do estoque pronto
   * delas; `[]` na receita só com insumos.
   */
  receitasUsadas: ReceitaUsadaProducaoDto[];
}

export type ProducaoComRateios = Producao & {
  rateios: RateioProducao[];
  receitasUsadas: ReceitaUsadaProducao[];
};

/** O banco guarda os valores sem arredondar; só a resposta arredonda (BE-23). */
export function toProducaoDto(row: ProducaoComRateios): ProducaoDto {
  return {
    id: row.id,
    receitaId: row.receitaId,
    empresaId: row.empresaId,
    quantidade: row.quantidade,
    totalUnidades: row.totalUnidades,
    custoTotal: row.custoTotal == null ? null : round2(row.custoTotal),
    custoUnitario: row.custoUnitario == null ? null : round4(row.custoUnitario),
    dataProducao: row.dataProducao,
    rateios: row.rateios.map((rateio) => ({
      gastoIndiretoId: rateio.gastoIndiretoId,
      descricao: rateio.descricao,
      valorRateado: round2(rateio.valorRateado),
    })),
    receitasUsadas: row.receitasUsadas.map((item) => ({
      receitaId: item.receitaId,
      nome: item.nome,
      quantidade: round6(item.quantidade),
      unidade: item.unidade,
    })),
  };
}
