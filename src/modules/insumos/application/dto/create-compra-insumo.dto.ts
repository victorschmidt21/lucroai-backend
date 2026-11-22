import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Corpo de `POST /insumos/:id/compras` (novo, BE-29). */
export class CreateCompraInsumoDto {
  /** Quantidade comprada, na unidade do insumo (> 0). @example 5 */
  @IsNumber()
  @Min(0.000001)
  quantidade: number;

  /** Valor total pago pela compra (≥ 0). @example 50 */
  @IsNumber()
  @Min(0)
  valorTotal: number;

  /** Aparada; vazia é gravada como `null`. @example 'Nota 123' */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(200)
  observacao?: string;
}
