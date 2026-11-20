import type {
  MovimentacaoEstoque,
  OrigemMovimentacaoEstoque,
  TipoMovimentacaoEstoque,
} from '../../../../generated/prisma/client.js';

/** Movimentação de estoque de insumo, como o `MovimentacaoEstoqueDto` do operations-service. */
export class MovimentacaoEstoqueDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  insumoId: number;
  /** @example 'ENTRADA' */
  tipo: TipoMovimentacaoEstoque;
  /** @example 'COMPRA' */
  origem: OrigemMovimentacaoEstoque;
  /** @example 500 */
  quantidade: number;
  /** Id da produção nas saídas por produção; `null` na compra. @example null */
  referenciaId: number | null;
  /** Novo (BE-11, lacuna 22); `null` sem observação. @example 'Nota 123' */
  observacao: string | null;
  /** @example '2026-01-15T12:00:00.000Z' */
  dataMovimentacao: Date;
}

export function toMovimentacaoEstoqueDto(
  row: MovimentacaoEstoque,
): MovimentacaoEstoqueDto {
  return {
    id: row.id,
    insumoId: row.insumoId,
    tipo: row.tipo,
    origem: row.origem,
    quantidade: row.quantidade,
    referenciaId: row.referenciaId,
    observacao: row.observacao,
    dataMovimentacao: row.dataMovimentacao,
  };
}
