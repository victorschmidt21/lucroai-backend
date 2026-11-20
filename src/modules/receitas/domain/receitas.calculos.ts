import { round2 } from '../../../shared/domain/arredondamento.js';
import { InvalidInputError } from '../../../shared/domain/errors/domain.error.js';
import {
  calcularValorRateado,
  type GastoParaRateio,
} from '../../gastos-indiretos/domain/gastos-indiretos.calculos.js';

export interface ItemParaCusto {
  insumoId: number;
  quantidade: number;
  /** Custo unitário atual do insumo, sem arredondamento. */
  custoUnitario: number;
}

export interface ItemCalculado {
  insumoId: number;
  quantidade: number;
  custoCalculado: number;
}

export interface CustoReceitaInput {
  itens: ItemParaCusto[];
  rendimento: number;
  margemLucro: number | null;
  /** Todos os gastos indiretos da empresa (lacuna 18). */
  gastos: GastoParaRateio[];
}

export interface CustoReceita {
  itens: ItemCalculado[];
  custoInvisivel: number;
  custoProducao: number;
  custoUnitario: number;
  /** `null` sem margem. */
  precoSugerido: number | null;
}

/** `round2(quantidade × custoUnitario)`. Origem: `calcularItens` do `custo.service.ts`. */
export function calcularCustoItem(
  quantidade: number,
  custoUnitario: number,
): number {
  return round2(quantidade * custoUnitario);
}

/**
 * Soma do rateio de **todos** os gastos da empresa para 1 lote. É o
 * comportamento atual (`default-custo-invisivel-result.provider.ts`, lacuna
 * 18), mantido para não mudar os números que o frontend mostra.
 */
export function calcularCustoInvisivel(
  gastos: GastoParaRateio[],
  rendimento: number,
): number {
  const lotes = 1;
  return round2(
    gastos.reduce(
      (total, gasto) =>
        total + calcularValorRateado(gasto, lotes, rendimento * lotes),
      0,
    ),
  );
}

/** Origem: `calcularPrecoSugerido` do `custo.service.ts`. */
export function calcularPrecoSugerido(
  custoUnitario: number,
  margemLucro: number | null,
): number | null {
  if (margemLucro == null) return null;
  return round2(custoUnitario * (1 + margemLucro));
}

/**
 * Custo de 1 lote da receita. Origem: `calcularReceita` do `custo.service.ts`
 * (recipe-service), com os mesmos arredondamentos.
 */
export function calcularCustoReceita(input: CustoReceitaInput): CustoReceita {
  if (input.rendimento <= 0) {
    throw new InvalidInputError(
      'RENDIMENTO_INVALIDO',
      'Rendimento da receita deve ser maior que zero',
    );
  }
  const itens = input.itens.map((item) => ({
    insumoId: item.insumoId,
    quantidade: item.quantidade,
    custoCalculado: calcularCustoItem(item.quantidade, item.custoUnitario),
  }));
  const custoBase = round2(
    itens.reduce((total, item) => total + item.custoCalculado, 0),
  );
  const custoInvisivel = calcularCustoInvisivel(input.gastos, input.rendimento);
  const custoProducao = round2(custoBase + custoInvisivel);
  const custoUnitario = round2(custoProducao / input.rendimento);
  return {
    itens,
    custoInvisivel,
    custoProducao,
    custoUnitario,
    precoSugerido: calcularPrecoSugerido(custoUnitario, input.margemLucro),
  };
}

/**
 * Margem a gravar na edição: omitida (`undefined`) mantém a salva, `null`
 * remove (lacuna 21) e um número substitui.
 */
export function resolverMargem(
  informada: number | null | undefined,
  salva: number | null,
): number | null {
  return informada === undefined ? salva : informada;
}

/**
 * Na edição, o custo só é recalculado se vierem insumos, rendimento ou
 * margem (inclusive `null`), como no `receita.service.ts` (`update`).
 */
export function precisaRecalcular(alteracao: {
  insumos?: unknown;
  rendimento?: unknown;
  margem_lucro?: unknown;
}): boolean {
  return (
    alteracao.insumos !== undefined ||
    alteracao.rendimento !== undefined ||
    alteracao.margem_lucro !== undefined
  );
}
