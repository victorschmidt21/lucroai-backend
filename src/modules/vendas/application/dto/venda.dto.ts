import type {
  ItemVenda,
  StatusVenda,
  Venda,
} from '../../../../generated/prisma/client.js';
import { round2, round4 } from '../../../../shared/domain/arredondamento.js';

export class ItemVendaDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  vendaId: number;
  /** @example 1 */
  receitaId: number;
  /** @example 2 */
  quantidade: number;
  /** @example 12.5 */
  precoUnitarioReal: number;
  /**
   * Custo unitário da receita na hora da venda, com o custo médio dos
   * insumos (BE-30), com 4 casas. @example 7.3456
   */
  custoUnitario: number | null;
  /** `(preço − custo) ÷ preço`, fração com 4 casas; pode ser negativa. @example 0.4124 */
  margemRealizada: number | null;
  /**
   * Novo (BE-30): `1 − percentuais do canal sem o lucro − custo ÷ preço`,
   * fração do preço com 4 casas; pode ser negativo. `null` nas vendas antigas
   * e sem custo. @example 0.15
   */
  lucroReal: number | null;
}

export class VendaDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  empresaId: number;
  /** Com 2 casas. @example 25 */
  total: number | null;
  /** @example 'PENDENTE' */
  status: StatusVenda;
  /** @example '2026-11-19T12:00:00.000Z' */
  dataVenda: Date;
  /**
   * Novo (BE-30): canal da venda; `null` nas vendas antigas e depois de o
   * canal ser excluído. @example 1
   */
  canalId: number | null;
  itens: ItemVendaDto[];
}

export type VendaComItens = Venda & { itens: ItemVenda[] };

/** O banco guarda os valores sem arredondar; só a resposta arredonda (BE-23). */
export function toVendaDto(row: VendaComItens): VendaDto {
  return {
    id: row.id,
    empresaId: row.empresaId,
    total: row.total == null ? null : round2(row.total),
    status: row.status,
    dataVenda: row.dataVenda,
    canalId: row.canalId,
    itens: row.itens.map((item) => ({
      id: item.id,
      vendaId: item.vendaId,
      receitaId: item.receitaId,
      quantidade: item.quantidade,
      precoUnitarioReal: item.precoUnitarioReal,
      custoUnitario:
        item.custoUnitario == null ? null : round4(item.custoUnitario),
      margemRealizada:
        item.margemRealizada == null ? null : round4(item.margemRealizada),
      lucroReal: item.lucroReal == null ? null : round4(item.lucroReal),
    })),
  };
}
