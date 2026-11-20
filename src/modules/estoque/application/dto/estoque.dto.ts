import type { Estoque } from '../../../../generated/prisma/client.js';

/** Saldo de estoque de um insumo, como o `EstoqueDto` do operations-service. */
export class EstoqueDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  insumoId: number;
  /** Pode ficar negativo: a produção não confere o saldo (lacuna 10). @example 1500 */
  quantidadeDisponivel: number;
  /** @example 200 */
  quantidadeMinima: number;
  /** `null` enquanto o saldo não foi alterado. @example '2026-01-15T12:00:00.000Z' */
  dataAlteracao: Date | null;
}

export function toEstoqueDto(row: Estoque): EstoqueDto {
  return {
    id: row.id,
    insumoId: row.insumoId,
    quantidadeDisponivel: row.quantidadeDisponivel,
    quantidadeMinima: row.quantidadeMinima,
    dataAlteracao: row.dataAlteracao,
  };
}
