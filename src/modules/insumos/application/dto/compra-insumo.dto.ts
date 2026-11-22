import type { CompraInsumo } from '../../../../generated/prisma/client.js';
import { round6 } from '../../../../shared/domain/arredondamento.js';

/** Compra de insumo (novo, BE-29). */
export class CompraInsumoDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  insumoId: number;
  /** Na unidade do insumo. @example 5 */
  quantidade: number;
  /** @example 50 */
  valorTotal: number;
  /** `valorTotal / quantidade`, com 6 casas. @example 10 */
  custoUnitario: number;
  /** `null` sem observação. @example 'Nota 123' */
  observacao: string | null;
  /** @example '2026-11-21T12:00:00.000Z' */
  dataCompra: Date;
}

export function toCompraInsumoDto(row: CompraInsumo): CompraInsumoDto {
  return {
    id: row.id,
    insumoId: row.insumoId,
    quantidade: row.quantidade,
    valorTotal: row.valorTotal,
    custoUnitario: round6(row.custoUnitario),
    observacao: row.observacao,
    dataCompra: row.dataCompra,
  };
}
