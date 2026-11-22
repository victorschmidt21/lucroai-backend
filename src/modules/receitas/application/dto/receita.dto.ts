import type {
  ItemReceita,
  Receita,
  UnidadeMedida,
} from '../../../../generated/prisma/client.js';
import { round2, round4 } from '../../../../shared/domain/arredondamento.js';
import {
  type ComposicaoPreco,
  type CustoReceita,
  type CustoUnitarioDetalhado,
  margemDoLucro,
  type MotivoSemPreco,
  type ParteDoPreco,
  type PrecoCalculado,
} from '../../domain/receitas.calculos.js';

export class ItemReceitaDto {
  /** @example 1 */
  insumoId: number;
  /** @example 0.25 */
  quantidade: number;
  /** `quantidade × custo de reposição do insumo` (BE-29), com 2 casas. @example 0.75 */
  custoCalculado?: number;
}

/** De onde vem o custo de 1 unidade (BE-28). */
export class CustoReceitaDetalheDto {
  /** Ingredientes de 1 lote, com 2 casas. @example 3.31 */
  ingredientesLote: number;
  /** Gastos `MENSAL` de 1 lote (`Σ valor × usoPorLote ÷ capacidadeMensal`), com 2 casas. @example 24.35 */
  gastosMensaisLote: number;
  /** `ingredientesLote ÷ rendimento`, com 4 casas. @example 0.0661 */
  ingredientes: number;
  /** `gastosMensaisLote ÷ rendimento`, com 4 casas. @example 0.487 */
  gastosMensais: number;
  /** Soma dos gastos `POR_UNIDADE`, com 4 casas. @example 0 */
  gastosPorUnidade: number;
  /** `embalagemPorUnidade`, com 4 casas. @example 0 */
  embalagem: number;
  /** O que a perda acrescenta ao custo, com 4 casas. @example 0.0291 */
  perdas: number;
  /** Soma das partes acima, com 4 casas. @example 0.5822 */
  unitario: number;
}

/** Uma parte do preço. */
export class ParteDoPrecoDto {
  /** Reais por unidade, com 4 casas. @example 0.1044 */
  valor: number;
  /** Fração do preço, com 4 casas. @example 0.15 */
  fracao: number;
}

/** "Para onde vai cada R$ 1" do preço: as partes somam o preço (e 1). */
export class ComposicaoPrecoDto {
  ingredientes: ParteDoPrecoDto;
  gastosMensais: ParteDoPrecoDto;
  gastosPorUnidade: ParteDoPrecoDto;
  embalagem: ParteDoPrecoDto;
  perdas: ParteDoPrecoDto;
  imposto: ParteDoPrecoDto;
  taxaCanal: ParteDoPrecoDto;
  gastosPercentuais: ParteDoPrecoDto;
  lucro: ParteDoPrecoDto;
}

/** Preço sugerido da receita num canal ativo (BE-28). */
export class PrecoCanalDto {
  /** @example 1 */
  canalId: number;
  /** @example 'Balcão' */
  canal: string;
  /** @example true */
  balcao: boolean;
  /** `imposto + taxa do canal + gastos PERCENTUAL_VENDA + lucro`, com 4 casas. @example 0.1636 */
  percentuais: number;
  /** `custo.unitario ÷ (1 − percentuais)`, com 4 casas; `null` com percentuais ≥ 100%. @example 0.6961 */
  preco: number | null;
  /** Por que não há preço; `null` quando há. @example null */
  motivo: MotivoSemPreco | null;
  /** `null` sem preço. */
  composicao: ComposicaoPrecoDto | null;
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
  /** `custoUnitario × rendimento` (1 lote), calculado na leitura, com 2 casas. @example 29.11 */
  custoProducao?: number;
  /** Custo de 1 unidade (BE-28: com embalagem e perda), com 4 casas. @example 0.5822 */
  custoUnitario?: number;
  /**
   * Markup equivalente ao lucro (`lucro ÷ (1 − lucro)`), mantido por
   * compatibilidade; omitido sem preço. @example 0.1765
   */
  margemLucro?: number;
  /** Preço do Balcão (BE-28), com 4 casas; omitido com percentuais ≥ 100%. @example 0.6961 */
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
  /** Detalhamento do custo de 1 unidade (BE-28). */
  custo: CustoReceitaDetalheDto;
  /** Preço sugerido por canal ativo, em ordem de criação do canal (BE-28). */
  precos: PrecoCanalDto[];
}

/** Preço de um canal já calculado, com o canal. */
export type PrecoDoCanal = PrecoCalculado & {
  canalId: number;
  canal: string;
  balcao: boolean;
};

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
  precoSugerido: number | null,
  precos: PrecoDoCanal[],
): ReceitaDto {
  return {
    id: row.id,
    empresaId: row.empresaId,
    nome: row.nome,
    rendimento: row.rendimento,
    unidadeRendimento: row.unidadeRendimento,
    custoProducao: round2(custo.custoProducao),
    custoUnitario: round4(custo.custoUnitario),
    margemLucro:
      precoSugerido === null
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
    custo: toCustoReceitaDetalheDto(custo.detalhe),
    precos: precos.map(toPrecoCanalDto),
  };
}

function toCustoReceitaDetalheDto(
  d: CustoUnitarioDetalhado,
): CustoReceitaDetalheDto {
  return {
    ingredientesLote: round2(d.ingredientesLote),
    gastosMensaisLote: round2(d.gastosMensaisLote),
    ingredientes: round4(d.ingredientes),
    gastosMensais: round4(d.gastosMensais),
    gastosPorUnidade: round4(d.gastosPorUnidade),
    embalagem: round4(d.embalagem),
    perdas: round4(d.perdas),
    unitario: round4(d.custoUnitario),
  };
}

function toPrecoCanalDto(p: PrecoDoCanal): PrecoCanalDto {
  return {
    canalId: p.canalId,
    canal: p.canal,
    balcao: p.balcao,
    percentuais: round4(p.percentuais),
    preco: p.preco === null ? null : round4(p.preco),
    motivo: p.motivo,
    composicao:
      p.composicao === null ? null : toComposicaoPrecoDto(p.composicao),
  };
}

function toComposicaoPrecoDto(c: ComposicaoPreco): ComposicaoPrecoDto {
  const parte = (x: ParteDoPreco): ParteDoPrecoDto => ({
    valor: round4(x.valor),
    fracao: round4(x.fracao),
  });
  return {
    ingredientes: parte(c.ingredientes),
    gastosMensais: parte(c.gastosMensais),
    gastosPorUnidade: parte(c.gastosPorUnidade),
    embalagem: parte(c.embalagem),
    perdas: parte(c.perdas),
    imposto: parte(c.imposto),
    taxaCanal: parte(c.taxaCanal),
    gastosPercentuais: parte(c.gastosPercentuais),
    lucro: parte(c.lucro),
  };
}

function arredondarOpcional(
  valor: number | null | undefined,
  arredondar: (v: number) => number,
): number | undefined {
  return valor == null ? undefined : arredondar(valor);
}
