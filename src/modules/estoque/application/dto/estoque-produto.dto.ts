import type { EstoqueProdutoAcabado } from '../../../../generated/prisma/client.js';
import { estoqueNegativo } from '../../domain/estoque.calculos.js';

/** Saldo de produto acabado de uma receita (novo, BE-12, lacuna 6). */
export class EstoqueProdutoDto {
  /** @example 1 */
  receitaId: number;
  /**
   * Unidades disponíveis. Pode ficar negativo quando a receita é usada dentro
   * de outra sem a produção dela ter sido registrada (BE-41). @example 36
   */
  quantidadeDisponivel: number;
  /** Novo (BE-41): saldo abaixo de zero, para a indicação visual. @example false */
  estoqueNegativo: boolean;
  /** @example '2026-01-15T12:00:00.000Z' */
  dataAlteracao: Date | null;
}

export function toEstoqueProdutoDto(
  row: EstoqueProdutoAcabado,
): EstoqueProdutoDto {
  return {
    receitaId: row.receitaId,
    quantidadeDisponivel: row.quantidadeDisponivel,
    estoqueNegativo: estoqueNegativo(row.quantidadeDisponivel),
    dataAlteracao: row.dataAlteracao,
  };
}
