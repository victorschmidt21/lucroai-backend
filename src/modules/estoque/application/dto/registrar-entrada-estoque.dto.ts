import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Corpo de `POST /estoque/insumos/:id/entrada`, como o
 * `RegistrarEntradaEstoqueDto` do operations-service, mais a `observacao`
 * (BE-11, lacuna 22).
 */
export class RegistrarEntradaEstoqueDto {
  /** @example 500 */
  @IsNumber()
  @Min(0.000001)
  quantidade: number;

  /** Aparada; vazia é gravada como `null`. @example 'Nota 123' */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(200)
  observacao?: string;
}
