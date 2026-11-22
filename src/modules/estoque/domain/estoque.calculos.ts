import { round6 } from '../../../shared/domain/arredondamento.js';
import { BusinessRuleError } from '../../../shared/domain/errors/domain.error.js';

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

/**
 * Saldo de produto acabado depois de uma saída por venda. Ao contrário do
 * insumo, não aceita saldo negativo: sem saldo suficiente → 422
 * `ESTOQUE_INSUFICIENTE`, com a mensagem do operations-service (o frontend
 * detecta o texto "Estoque insuficiente").
 * Origem: estoque-produto-acabado.service.ts (registrarSaidaPorVenda) do
 * operations-service.
 */
export function calcularSaidaProdutoAcabado(
  receitaId: number,
  disponivel: number,
  quantidade: number,
): number {
  if (disponivel < quantidade) {
    throw new BusinessRuleError(
      'ESTOQUE_INSUFICIENTE',
      `Estoque insuficiente para a receita ${receitaId}: disponível ${disponivel}, solicitado ${quantidade}`,
    );
  }
  return calcularSaldoAposMovimentacao(disponivel, 'SAIDA', quantidade);
}

/**
 * Saldo de insumo abaixo de zero (BE-32). O estoque negativo continua
 * permitido (a produção não confere o saldo); a indicação só avisa a pessoa
 * nas listas e em `GET /alertas`. Saldo 0 não é negativo.
 */
export function estoqueNegativo(saldo: number): boolean {
  return saldo < 0;
}
