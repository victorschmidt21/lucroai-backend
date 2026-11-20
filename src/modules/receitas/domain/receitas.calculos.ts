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
  /** Lotes produzidos; 1 no cadastro e na edição. */
  lotes?: number;
}

export interface CustoReceita {
  /** Itens com a quantidade e o custo para `lotes` lotes. */
  itens: ItemCalculado[];
  lotes: number;
  /** `rendimento × lotes`. */
  totalUnidades: number;
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
 * Soma do rateio de **todos** os gastos da empresa para `lotes` lotes. É o
 * comportamento atual (`default-custo-invisivel-result.provider.ts`, lacuna
 * 18), mantido para não mudar os números que o frontend mostra.
 */
export function calcularCustoInvisivel(
  gastos: GastoParaRateio[],
  rendimento: number,
  lotes = 1,
): number {
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
 * Custo de `lotes` lotes da receita (1 se omitido). Origem: `calcularReceita`
 * do `custo.service.ts` (recipe-service), com os mesmos arredondamentos: a
 * quantidade do item é multiplicada pelos lotes antes do custo do item.
 */
export function calcularCustoReceita(input: CustoReceitaInput): CustoReceita {
  if (input.rendimento <= 0) {
    throw new InvalidInputError(
      'RENDIMENTO_INVALIDO',
      'Rendimento da receita deve ser maior que zero',
    );
  }
  const lotes = input.lotes ?? 1;
  const itens = input.itens.map((item) => {
    const quantidade = item.quantidade * lotes;
    return {
      insumoId: item.insumoId,
      quantidade,
      custoCalculado: calcularCustoItem(quantidade, item.custoUnitario),
    };
  });
  const custoBase = round2(
    itens.reduce((total, item) => total + item.custoCalculado, 0),
  );
  const totalUnidades = input.rendimento * lotes;
  const custoInvisivel = calcularCustoInvisivel(
    input.gastos,
    input.rendimento,
    lotes,
  );
  const custoProducao = round2(custoBase + custoInvisivel);
  const custoUnitario = round2(custoProducao / totalUnidades);
  return {
    itens,
    lotes,
    totalUnidades,
    custoInvisivel,
    custoProducao,
    custoUnitario,
    precoSugerido: calcularPrecoSugerido(custoUnitario, input.margemLucro),
  };
}

export interface SimulacaoEntrada {
  novoCusto?: number;
  novoPreco?: number;
  volume?: number;
}

/** Valores salvos da receita usados quando a simulação não os informa. */
export interface ReceitaParaSimulacao {
  custoUnitario: number | null;
  precoSugerido: number | null;
  rendimento: number;
}

export interface SimulacaoCenario {
  custoUnitario: number;
  precoVenda: number;
  volume: number;
  lucroEstimado: number;
  /** Fração com 2 casas (pode ser negativa). */
  margemProjetada: number;
  /** Unidades para cobrir o custo do volume. */
  breakEven: number;
}

/**
 * Simulação de cenário. Origem: `simular` do `simulacao.service.ts`
 * (recipe-service), com as mesmas mensagens. Preço 0 → 400 `PRECO_INVALIDO`
 * em vez de `NaN` (lacuna 27).
 */
export function simularCenario(
  entrada: SimulacaoEntrada,
  receita: ReceitaParaSimulacao,
): SimulacaoCenario {
  const custo = entrada.novoCusto ?? receita.custoUnitario;
  if (custo == null) {
    throw new InvalidInputError(
      'RECEITA_SEM_CUSTO',
      'Receita sem custo calculado. Informe novoCusto para simular.',
    );
  }
  const preco = entrada.novoPreco ?? receita.precoSugerido;
  if (preco == null) {
    throw new InvalidInputError(
      'RECEITA_SEM_PRECO',
      'Receita sem preço sugerido definido. Informe novoPreco para simular.',
    );
  }
  if (preco <= 0) {
    throw new InvalidInputError(
      'PRECO_INVALIDO',
      'Preço de venda deve ser maior que zero. Informe novoPreco para simular.',
    );
  }
  const volume = entrada.volume ?? receita.rendimento;
  const margemPorUnidade = preco - custo;
  return {
    custoUnitario: round2(custo),
    precoVenda: round2(preco),
    volume,
    lucroEstimado: round2(margemPorUnidade * volume),
    margemProjetada: round2(margemPorUnidade / preco),
    breakEven: Math.ceil((custo * volume) / preco),
  };
}

export interface PrecoVenda {
  custoUnitario: number;
  precoSugerido: number;
  lucroPorUnidade: number;
}

/**
 * Preço de venda para uma margem, sem gravar. Origem: `calcularPrecoVenda`
 * do `receita.service.ts` (recipe-service), agora com `round2` (lacuna 20).
 */
export function calcularPrecoVenda(
  custoUnitario: number | null,
  margemLucro: number,
): PrecoVenda {
  if (custoUnitario == null) {
    throw new InvalidInputError(
      'RECEITA_SEM_CUSTO',
      'Receita sem custo calculado',
    );
  }
  const precoSugerido = round2(custoUnitario * (1 + margemLucro));
  return {
    custoUnitario,
    precoSugerido,
    lucroPorUnidade: round2(precoSugerido - custoUnitario),
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
