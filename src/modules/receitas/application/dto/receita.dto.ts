import type {
  ItemReceita,
  Receita,
  UnidadeMedida,
} from '../../../../generated/prisma/client.js';
import { round2, round4 } from '../../../../shared/domain/arredondamento.js';
import {
  type CustoReceita,
  margemDoLucro,
} from '../../domain/receitas.calculos.js';

export class ItemReceitaDto {
  /** @example 1 */
  insumoId: number;
  /** @example 0.25 */
  quantidade: number;
  /** `quantidade × custoUnitario atual do insumo`, com 2 casas. @example 0.75 */
  custoCalculado?: number;
}

export class ReceitaDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  empresaId: number;
  /** @example 'Bolo de Chocolate' */
  nome: string;
  /** Unidades **boas** (vendáveis) por lote. @example 12 */
  rendimento: number;
  /** @example 'UN' */
  unidadeRendimento: UnidadeMedida;
  /** Itens + custo invisível de 1 lote, calculado na leitura, com 2 casas. @example 9.7 */
  custoProducao?: number;
  /** `custoProducao / rendimento`, com 4 casas. @example 0.8083 */
  custoUnitario?: number;
  /**
   * Markup equivalente ao lucro (`lucro ÷ (1 − lucro)`), mantido por
   * compatibilidade; omitido sem preço. @example 0.1765
   */
  margemLucro?: number;
  /** `custoUnitario ÷ (1 − lucro)`, com 4 casas; omitido sem preço. @example 0.9509 */
  precoSugerido?: number;
  /** Fornadas ou minutos de forno de 1 lote. @example 1 */
  usoPorLote: number;
  /** Reais por unidade. @example 0 */
  embalagemPorUnidade: number;
  /** Fração das unidades que não são vendidas. @example 0 */
  perdaPercentual: number;
  /** Fração do preço, com 4 casas; omitido quando a receita usa o lucro padrão da empresa. @example 0.15 */
  lucroPercentual?: number;
  /** @example '2026-11-19T12:00:00.000Z' */
  dataCriacao: Date;
  itens: ItemReceitaDto[];
}

export type ReceitaComItens = Receita & { itens: ItemReceita[] };

/**
 * Desde a BE-27 o custo não é gravado: `custo` é o de 1 lote calculado na
 * leitura com os custos atuais (os itens na mesma ordem dos da receita), e
 * `lucro` é o efetivo (o da receita ou o padrão da empresa). Campos sem valor
 * viram `undefined` e são omitidos do JSON. Só a resposta arredonda (BE-23).
 */
export function toReceitaDto(
  row: ReceitaComItens,
  custo: CustoReceita,
  lucro: number,
): ReceitaDto {
  const precoSugerido = custo.precoSugerido ?? undefined;
  return {
    id: row.id,
    empresaId: row.empresaId,
    nome: row.nome,
    rendimento: row.rendimento,
    unidadeRendimento: row.unidadeRendimento,
    custoProducao: round2(custo.custoProducao),
    custoUnitario: round4(custo.custoUnitario),
    margemLucro:
      precoSugerido === undefined
        ? undefined
        : arredondarOpcional(margemDoLucro(lucro), round4),
    precoSugerido: arredondarOpcional(precoSugerido, round4),
    usoPorLote: row.usoPorLote,
    embalagemPorUnidade: row.embalagemPorUnidade,
    perdaPercentual: row.perdaPercentual,
    lucroPercentual: arredondarOpcional(row.lucroPercentual, round4),
    dataCriacao: row.dataCriacao,
    itens: row.itens.map((item, i) => ({
      insumoId: item.insumoId,
      quantidade: item.quantidade,
      custoCalculado: arredondarOpcional(
        custo.itens[i]?.custoCalculado,
        round2,
      ),
    })),
  };
}

function arredondarOpcional(
  valor: number | null | undefined,
  arredondar: (v: number) => number,
): number | undefined {
  return valor == null ? undefined : arredondar(valor);
}
