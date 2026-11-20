import type { EstoqueProdutoAcabado } from '../../../../generated/prisma/client.js';

/** Saldo de produto acabado de uma receita (novo, BE-12, lacuna 6). */
export class EstoqueProdutoDto {
  /** @example 1 */
  receitaId: number;
  /** Unidades disponíveis. @example 36 */
  quantidadeDisponivel: number;
  /** @example '2026-01-15T12:00:00.000Z' */
  dataAlteracao: Date | null;
}

export function toEstoqueProdutoDto(
  row: EstoqueProdutoAcabado,
): EstoqueProdutoDto {
  return {
    receitaId: row.receitaId,
    quantidadeDisponivel: row.quantidadeDisponivel,
    dataAlteracao: row.dataAlteracao,
  };
}
