import { IsNumber, Min } from 'class-validator';
import type { PrecoVenda } from '../../domain/receitas.calculos.js';

/** Corpo de `POST /receitas/:id/preco-venda`. */
export class PrecoVendaBodyDto {
  /** Fração (0.6 = 60%), ≥ 0. @example 0.6 */
  @IsNumber()
  @Min(0)
  margem_lucro: number;
}

/** Resposta em `snake_case`, como hoje; valores com `round2` (lacuna 20). */
export class PrecoVendaDto {
  /** `custoUnitario` salvo da receita. @example 0.81 */
  custo_total_unitario: number;
  /** `round2(custo × (1 + margem_lucro))`. @example 1.3 */
  preco_sugerido: number;
  /** `round2(preco_sugerido − custo)`. @example 0.49 */
  lucro_por_unidade: number;
}

export function toPrecoVendaDto(preco: PrecoVenda): PrecoVendaDto {
  return {
    custo_total_unitario: preco.custoUnitario,
    preco_sugerido: preco.precoSugerido,
    lucro_por_unidade: preco.lucroPorUnidade,
  };
}
