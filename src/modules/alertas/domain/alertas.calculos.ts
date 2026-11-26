import { estoqueNegativo } from '../../estoque/domain/estoque.calculos.js';
import {
  calcularAumentoReposicao,
  calcularCustoReposicao,
  precoDefasado,
} from '../../insumos/domain/insumos.calculos.js';

/** Insumo com o saldo e os custos salvos, sem arredondar. */
export interface InsumoParaAlerta<U extends string = string> {
  id: number;
  nome: string;
  unidade: U;
  quantidadeDisponivel: number;
  custoMedio: number;
  ultimoCusto: number;
  precoMercado: number | null;
}

/** Receita com o preço sugerido no Balcão, sem arredondar. */
export interface ReceitaParaAlerta {
  id: number;
  nome: string;
  insumoIds: number[];
  /** Com o custo de reposição: o novo preço sugerido. */
  precoSugerido: number | null;
  /** Com o custo médio dos insumos. */
  precoComCustoMedio: number | null;
}

export interface AlertaEstoqueNegativo<U extends string = string> {
  id: number;
  nome: string;
  saldo: number;
  unidade: U;
}

export interface AlertaPrecoDefasado<U extends string = string> {
  id: number;
  nome: string;
  unidade: U;
  custoMedio: number;
  custoReposicao: number;
  /** `custoReposicao ÷ custoMedio − 1`, em fração. */
  aumentoPercentual: number;
  /** Receitas que usam o insumo. */
  receitas: Omit<ReceitaParaAlerta, 'insumoIds'>[];
}

/**
 * Insumos com saldo abaixo de zero (BE-32), na ordem recebida. O estoque
 * negativo é permitido; o alerta só avisa.
 */
export function alertasDeEstoqueNegativo<U extends string>(
  insumos: InsumoParaAlerta<U>[],
): AlertaEstoqueNegativo<U>[] {
  return insumos
    .filter((insumo) => estoqueNegativo(insumo.quantidadeDisponivel))
    .map((insumo) => ({
      id: insumo.id,
      nome: insumo.nome,
      saldo: insumo.quantidadeDisponivel,
      unidade: insumo.unidade,
    }));
}

/**
 * Insumos cuja reposição subiu mais de 10% sobre o custo médio
 * (`precoDefasado`, BE-32), na ordem recebida, cada um com as receitas que o
 * usam e o preço sugerido delas no Balcão (o novo, com a reposição, e o do
 * custo médio). Insumo defasado sem receita também entra, com a lista vazia.
 */
export function alertasDePrecoDefasado<U extends string>(
  insumos: InsumoParaAlerta<U>[],
  receitas: ReceitaParaAlerta[],
): AlertaPrecoDefasado<U>[] {
  return insumos.filter(precoDefasado).map((insumo) => ({
    id: insumo.id,
    nome: insumo.nome,
    unidade: insumo.unidade,
    custoMedio: insumo.custoMedio,
    custoReposicao: calcularCustoReposicao(insumo),
    aumentoPercentual: calcularAumentoReposicao(insumo) ?? 0,
    receitas: receitas
      .filter((receita) => receita.insumoIds.includes(insumo.id))
      .map((receita) => ({
        id: receita.id,
        nome: receita.nome,
        precoSugerido: receita.precoSugerido,
        precoComCustoMedio: receita.precoComCustoMedio,
      })),
  }));
}

/** Saldo do estoque pronto de uma receita (BE-41). */
export interface EstoqueProntoParaAlerta {
  receitaId: number;
  quantidadeDisponivel: number;
}

/** Nome e unidade de uma receita (BE-41). */
export interface ReceitaParaAlertaDeProduto<U extends string = string> {
  id: number;
  nome: string;
  unidadeRendimento: U;
}

export interface AlertaProdutoNegativo<U extends string = string> {
  receitaId: number;
  nome: string;
  saldo: number;
  unidade: U;
}

/**
 * Receitas com o estoque pronto abaixo de zero (BE-41), por nome: a receita
 * usada dentro de outra saiu sem a produção dela ter sido registrada. O saldo
 * negativo é permitido; o alerta só avisa ("registre a produção do Brigadeiro
 * branco"). Saldo de receita que não está na lista fica de fora.
 */
export function alertasDeProdutoNegativo<U extends string>(
  estoques: EstoqueProntoParaAlerta[],
  receitas: ReceitaParaAlertaDeProduto<U>[],
): AlertaProdutoNegativo<U>[] {
  const porId = new Map(receitas.map((receita) => [receita.id, receita]));
  return estoques
    .filter((estoque) => estoqueNegativo(estoque.quantidadeDisponivel))
    .flatMap((estoque) => {
      const receita = porId.get(estoque.receitaId);
      return receita
        ? [
            {
              receitaId: receita.id,
              nome: receita.nome,
              saldo: estoque.quantidadeDisponivel,
              unidade: receita.unidadeRendimento,
            },
          ]
        : [];
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
