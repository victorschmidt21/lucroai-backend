import { IsNumber, Min } from 'class-validator';

/** Corpo de `PATCH /estoque/insumos/:id/minimo` (novo, BE-11, lacuna 14). */
export class AtualizarMinimoEstoqueDto {
  /** @example 200 */
  @IsNumber()
  @Min(0)
  quantidadeMinima: number;
}
