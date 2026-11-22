import type { CanalVenda } from '../../../../generated/prisma/client.js';

export class CanalVendaDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  empresaId: number;
  /** @example 'iFood' */
  nome: string;
  /** Fração do preço de venda. @example 0.152 */
  comissaoPercentual: number;
  /** @example false */
  ativo: boolean;
  /** Canal padrão da empresa, que não pode ser excluído. @example false */
  balcao: boolean;
}

// Sem arredondamento: a comissão é a fração que a pessoa digitou.
export function toCanalVendaDto(row: CanalVenda): CanalVendaDto {
  return {
    id: row.id,
    empresaId: row.empresaId,
    nome: row.nome,
    comissaoPercentual: row.comissaoPercentual,
    ativo: row.ativo,
    balcao: row.balcao,
  };
}
