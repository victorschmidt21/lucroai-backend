import { round6 } from '../../../shared/domain/arredondamento.js';

export type TipoMovimentacao = 'ENTRADA' | 'SAIDA';

/**
 * Saldo depois de uma movimentação, com `round6`. A saída pode deixar o saldo
 * negativo (lacuna 10, mantida na BE-11).
 * Origem: estoque.entity.ts (registrarEntrada/registrarSaida) e
 * prisma-estoque.repository.ts (aplicarMovimentacao) do operations-service.
 */
export function calcularSaldoAposMovimentacao(
  saldoAtual: number,
  tipo: TipoMovimentacao,
  quantidade: number,
): number {
  return tipo === 'ENTRADA'
    ? round6(saldoAtual + quantidade)
    : round6(saldoAtual - quantidade);
}

/**
 * Quantidade baixada de um insumo numa produção de `lotes` lotes.
 * Origem: estoque.service.ts (registrarBaixaPorProducao) do operations-service.
 */
export function calcularQuantidadeBaixa(
  quantidadePorLote: number,
  lotes: number,
): number {
  return round6(quantidadePorLote * lotes);
}
