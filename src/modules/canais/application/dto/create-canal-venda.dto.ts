import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Corpo de `POST /canais` (BE-25), em camelCase como as rotas novas do E7. */
export class CreateCanalVendaDto {
  /** @example 'Rappi' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  /** Comissão como fração do preço de venda, de 0 a 1. @example 0.2 */
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  comissaoPercentual: number;

  /** Omitido: o canal nasce ativo. @example true */
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
