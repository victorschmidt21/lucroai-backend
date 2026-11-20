import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class ListProducoesQueryDto {
  /** Filtra pela receita; inválido → 400. @example 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  receitaId?: number;
}
