/** Saldo de estoque de um insumo, devolvido aos outros módulos pelo `EstoqueService`. */
export interface SaldoInsumo {
  quantidadeDisponivel: number;
  quantidadeMinima: number;
}
