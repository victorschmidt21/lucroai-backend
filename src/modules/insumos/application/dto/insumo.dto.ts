import type {
  Insumo,
  UnidadeMedida,
} from '../../../../generated/prisma/client.js';
import { round6 } from '../../../../shared/domain/arredondamento.js';
import { estoqueNegativo } from '../../../estoque/domain/estoque.calculos.js';
import { calcularCustoReposicao } from '../../domain/insumos.calculos.js';

interface Saldo {
  quantidadeDisponivel: number;
  quantidadeMinima: number;
}

export class InsumoDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  empresaId: number;
  /** @example 'Farinha de trigo' */
  nome: string;
  /** Quantidade do último preço de referência (cadastro, compra ou PATCH). @example 1000 */
  quantidadeBaseCusto: number;
  /** Saldo do estoque (pode ser negativo). @example 2000 */
  quantidadeDisponivel: number;
  /** Estoque mínimo (novo, BE-07). @example 0 */
  quantidadeMinima: number;
  /** Novo (BE-32): `quantidadeDisponivel < 0`, para a indicação visual. @example false */
  estoqueNegativo: boolean;
  /** @example 'G' */
  unidade: UnidadeMedida;
  /** Valor do último preço de referência. @example 5 */
  valorPago: number;
  /**
   * Muda (BE-29): o custo de reposição (`precoMercado ?? ultimoCusto`), que
   * forma o preço das receitas, com 6 casas. @example 0.005
   */
  custoUnitario: number;
  /** Alias de `custoUnitario`, mantido por compatibilidade. @example 0.005 */
  precoUnitario: number;
  /** Novo (BE-29): custo médio móvel por unidade, com 6 casas. @example 0.0045 */
  custoMedio: number;
  /** Novo (BE-29): custo por unidade da última compra, com 6 casas. @example 0.005 */
  ultimoCusto: number;
  /** Novo (BE-29): `precoMercado ?? ultimoCusto`, com 6 casas. @example 0.005 */
  custoReposicao: number;
  /** Novo (BE-29): preço de mercado informado; `null` sem preço. @example null */
  precoMercado: number | null;
  /** Novo (BE-29): quando o preço de mercado foi informado; `null` sem preço. @example null */
  precoMercadoData: Date | null;
  /** @example '2026-11-19T12:00:00.000Z' */
  dataCriacao: Date;
}

/** Sem registro de estoque, saldo e mínimo são 0, como no catalog-service. */
export function toInsumoDto(row: Insumo, saldo?: Saldo): InsumoDto {
  const custoReposicao = round6(calcularCustoReposicao(row));
  const quantidadeDisponivel = saldo?.quantidadeDisponivel ?? 0;
  return {
    id: row.id,
    empresaId: row.empresaId,
    nome: row.nome,
    quantidadeBaseCusto: row.quantidadeBaseCusto,
    quantidadeDisponivel,
    quantidadeMinima: saldo?.quantidadeMinima ?? 0,
    estoqueNegativo: estoqueNegativo(quantidadeDisponivel),
    unidade: row.unidade,
    valorPago: row.valorPago,
    custoUnitario: custoReposicao,
    precoUnitario: custoReposicao,
    custoMedio: round6(row.custoMedio),
    ultimoCusto: round6(row.ultimoCusto),
    custoReposicao,
    precoMercado: row.precoMercado == null ? null : round6(row.precoMercado),
    precoMercadoData: row.precoMercadoData,
    dataCriacao: row.dataCriacao,
  };
}
