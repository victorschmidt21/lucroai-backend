import { IsInt, IsPositive } from 'class-validator';

/** Corpo de `POST /receitas/:id/custo/simular` (`simular-receita-custo.dto.ts`). */
export class SimularCustoDto {
  /** Lotes a produzir. @example 3 */
  @IsInt()
  @IsPositive()
  quantidadeLotes: number;
}
