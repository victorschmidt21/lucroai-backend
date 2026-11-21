import { IsNumber, Min } from 'class-validator';
import { round4 } from '../../../../shared/domain/arredondamento.js';
import type { PrecoVenda } from '../../domain/receitas.calculos.js';

/** Corpo de `POST /receitas/:id/preco-venda`. */
export class PrecoVendaBodyDto {
  /** Fração (0.6 = 60%), ≥ 0. @example 0.6 */
  @IsNumber()
  @Min(0)
  margem_lucro: number;
}

/** Resposta em `snake_case`, como hoje; valores com 4 casas (lacuna 20, BE-23). */
export class PrecoVendaDto {
  /** `custoUnitario` salvo da receita. @example 0.8083 */
  custo_total_unitario: number;
  /** `custo × (1 + margem_lucro)`. @example 1.2933 */
  preco_sugerido: number;
  /** `preco_sugerido − custo`. @example 0.485 */
  lucro_por_unidade: number;
}

export function toPrecoVendaDto(preco: PrecoVenda): PrecoVendaDto {
  return {
    custo_total_unitario: round4(preco.custoUnitario),
    preco_sugerido: round4(preco.precoSugerido),
    lucro_por_unidade: round4(preco.lucroPorUnidade),
  };
}
