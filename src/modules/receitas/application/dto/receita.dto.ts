import type {
  ItemReceita,
  Receita,
  UnidadeMedida,
} from '../../../../generated/prisma/client.js';

export class ItemReceitaDto {
  /** @example 1 */
  insumoId: number;
  /** @example 0.25 */
  quantidade: number;
  /** `round2(quantidade × custoUnitario do insumo)`; omitido sem valor. @example 0.75 */
  custoCalculado?: number;
}

export class ReceitaDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  empresaId: number;
  /** @example 'Bolo de Chocolate' */
  nome: string;
  /** Unidades por lote. @example 12 */
  rendimento: number;
  /** @example 'UN' */
  unidadeRendimento: UnidadeMedida;
  /** Itens + custo invisível de 1 lote; omitido sem valor. @example 9.7 */
  custoProducao?: number;
  /** `custoProducao / rendimento`; omitido sem valor. @example 0.81 */
  custoUnitario?: number;
  /** Fração (0.5 = 50%); omitida sem margem. @example 0.5 */
  margemLucro?: number;
  /** `custoUnitario × (1 + margemLucro)`; omitido sem margem. @example 1.22 */
  precoSugerido?: number;
  /** @example '2026-11-19T12:00:00.000Z' */
  dataCriacao: Date;
  itens: ItemReceitaDto[];
}

export type ReceitaComItens = Receita & { itens: ItemReceita[] };

/** Campos sem valor viram `undefined` e são omitidos do JSON, como hoje. */
export function toReceitaDto(row: ReceitaComItens): ReceitaDto {
  return {
    id: row.id,
    empresaId: row.empresaId,
    nome: row.nome,
    rendimento: row.rendimento,
    unidadeRendimento: row.unidadeRendimento,
    custoProducao: row.custoProducao ?? undefined,
    custoUnitario: row.custoUnitario ?? undefined,
    margemLucro: row.margemLucro ?? undefined,
    precoSugerido: row.precoSugerido ?? undefined,
    dataCriacao: row.dataCriacao,
    itens: row.itens.map((item) => ({
      insumoId: item.insumoId,
      quantidade: item.quantidade,
      custoCalculado: item.custoCalculado ?? undefined,
    })),
  };
}
