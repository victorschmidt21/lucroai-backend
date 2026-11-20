import type {
  Insumo,
  UnidadeMedida,
} from '../../../../generated/prisma/client.js';

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
  /** @example 1000 */
  quantidadeBaseCusto: number;
  /** Saldo do estoque (pode ser negativo). @example 2000 */
  quantidadeDisponivel: number;
  /** Estoque mínimo (novo, BE-07). @example 0 */
  quantidadeMinima: number;
  /** @example 'G' */
  unidade: UnidadeMedida;
  /** @example 5 */
  valorPago: number;
  /** `valorPago / quantidadeBaseCusto`, sem arredondamento. @example 0.005 */
  custoUnitario: number;
  /** Alias de `custoUnitario`, mantido por compatibilidade. @example 0.005 */
  precoUnitario: number;
  /** @example '2026-11-19T12:00:00.000Z' */
  dataCriacao: Date;
}

/** Sem registro de estoque, saldo e mínimo são 0, como no catalog-service. */
export function toInsumoDto(row: Insumo, saldo?: Saldo): InsumoDto {
  return {
    id: row.id,
    empresaId: row.empresaId,
    nome: row.nome,
    quantidadeBaseCusto: row.quantidadeBaseCusto,
    quantidadeDisponivel: saldo?.quantidadeDisponivel ?? 0,
    quantidadeMinima: saldo?.quantidadeMinima ?? 0,
    unidade: row.unidade,
    valorPago: row.valorPago,
    custoUnitario: row.custoUnitario,
    precoUnitario: row.custoUnitario,
    dataCriacao: row.dataCriacao,
  };
}
