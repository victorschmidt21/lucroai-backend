import type {
  Producao,
  RateioProducao,
} from '../../../../generated/prisma/client.js';

export class RateioProducaoDto {
  /** Continua o mesmo depois de o gasto ser excluído (sem FK). @example 1 */
  gastoIndiretoId: number;
  /** Novo (BE-12): descrição do gasto na hora da produção. @example 'Aluguel' */
  descricao: string;
  /** @example 1800 */
  valorRateado: number;
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
  /** @example 13492.14 */
  custoTotal: number | null;
  /** @example 374.78 */
  custoUnitario: number | null;
  /** @example '2026-11-19T12:00:00.000Z' */
  dataProducao: Date;
  rateios: RateioProducaoDto[];
}

export type ProducaoComRateios = Producao & { rateios: RateioProducao[] };

export function toProducaoDto(row: ProducaoComRateios): ProducaoDto {
  return {
    id: row.id,
    receitaId: row.receitaId,
    empresaId: row.empresaId,
    quantidade: row.quantidade,
    totalUnidades: row.totalUnidades,
    custoTotal: row.custoTotal,
    custoUnitario: row.custoUnitario,
    dataProducao: row.dataProducao,
    rateios: row.rateios.map((rateio) => ({
      gastoIndiretoId: rateio.gastoIndiretoId,
      descricao: rateio.descricao,
      valorRateado: rateio.valorRateado,
    })),
  };
}
