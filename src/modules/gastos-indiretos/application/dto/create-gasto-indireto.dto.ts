import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MetodoRateio } from '../../../../generated/prisma/client.js';

/**
 * Corpo de `POST /gastos-indiretos`, como o `CreateGastoIndiretoDto` do
 * catalog-service (`metodo_rateio` em snake_case). A descrição passa a ser
 * obrigatória e aparada (BE-08).
 */
export class CreateGastoIndiretoDto {
  /** @example 'Aluguel' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  descricao: string;

  /** @example 1800 */
  @IsNumber()
  @Min(0)
  valor: number;

  /** Nome em snake_case, como no contrato do frontend. @example 'FIXO' */
  @IsEnum(MetodoRateio)
  metodo_rateio: MetodoRateio;
}
