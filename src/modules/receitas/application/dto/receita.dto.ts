import type {
  ItemReceita,
  Receita,
  UnidadeMedida,
} from '../../../../generated/prisma/client.js';
import { round2, round4 } from '../../../../shared/domain/arredondamento.js';

export class ItemReceitaDto {
  /** @example 1 */
  insumoId: number;
  /** @example 0.25 */
  quantidade: number;
  /** `quantidade × custoUnitario do insumo`, com 2 casas; omitido sem valor. @example 0.75 */
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
  /** Itens + custo invisível de 1 lote, com 2 casas; omitido sem valor. @example 9.7 */
  custoProducao?: number;
  /** `custoProducao / rendimento`, com 4 casas; omitido sem valor. @example 0.8083 */
  custoUnitario?: number;
  /** Fração (0.5 = 50%); omitida sem margem. @example 0.5 */
  margemLucro?: number;
  /** `custoUnitario × (1 + margemLucro)`, com 4 casas; omitido sem margem. @example 1.2125 */
  precoSugerido?: number;
  /** @example '2026-11-19T12:00:00.000Z' */
  dataCriacao: Date;
  itens: ItemReceitaDto[];
}

export type ReceitaComItens = Receita & { itens: ItemReceita[] };

/**
 * Campos sem valor viram `undefined` e são omitidos do JSON, como hoje. O
 * banco guarda os valores sem arredondar; só a resposta arredonda (BE-23).
 */
export function toReceitaDto(row: ReceitaComItens): ReceitaDto {
  return {
    id: row.id,
    empresaId: row.empresaId,
    nome: row.nome,
    rendimento: row.rendimento,
    unidadeRendimento: row.unidadeRendimento,
    custoProducao: arredondarOpcional(row.custoProducao, round2),
    custoUnitario: arredondarOpcional(row.custoUnitario, round4),
    margemLucro: row.margemLucro ?? undefined,
    precoSugerido: arredondarOpcional(row.precoSugerido, round4),
    dataCriacao: row.dataCriacao,
    itens: row.itens.map((item) => ({
      insumoId: item.insumoId,
      quantidade: item.quantidade,
      custoCalculado: arredondarOpcional(item.custoCalculado, round2),
    })),
  };
}

function arredondarOpcional(
  valor: number | null,
  arredondar: (v: number) => number,
): number | undefined {
  return valor == null ? undefined : arredondar(valor);
}
