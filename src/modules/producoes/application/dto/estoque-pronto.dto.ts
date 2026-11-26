/**
 * Saldo de produto acabado de uma receita (`GET /estoque/produtos`, BE-12),
 * com o `vendavel` da receita (BE-41). A rota fica aqui porque o `estoque` não
 * pode depender de `receitas` (ciclo pelo `insumos`).
 */
export class EstoqueProntoDto {
  /** @example 1 */
  receitaId: number;
  /**
   * Unidades disponíveis. Pode ficar negativo quando a receita é usada dentro
   * de outra sem a produção dela ter sido registrada (BE-41). @example 36
   */
  quantidadeDisponivel: number;
  /** Novo (BE-41): saldo abaixo de zero, para a indicação visual. @example false */
  estoqueNegativo: boolean;
  /**
   * Novo (BE-41): `false` na receita que só serve para usar dentro de outras;
   * ela não pode ser vendida. @example true
   */
  vendavel: boolean;
  /** @example '2026-01-15T12:00:00.000Z' */
  dataAlteracao: Date | null;
}
