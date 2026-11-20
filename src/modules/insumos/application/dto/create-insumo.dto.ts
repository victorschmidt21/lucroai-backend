import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { UnidadeMedida } from '../../../../generated/prisma/client.js';

/**
 * Corpo de `POST /insumos`, como o `CreateInsumoDto` do catalog-service
 * (camelCase). O nome passa a ser obrigatório, aparado e com até 80
 * caracteres (BE-07, lacuna 12).
 */
export class CreateInsumoDto {
  /** @example 'Farinha de trigo' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome: string;

  /** Quantidade que o valor pago compra (> 0). @example 1000 */
  @IsNumber()
  @Min(0.000001)
  quantidadeBaseCusto: number;

  /** @example 'G' */
  @IsEnum(UnidadeMedida)
  unidade: UnidadeMedida;

  /** @example 5 */
  @IsNumber()
  @Min(0)
  valorPago: number;

  /** Saldo inicial do estoque (≥ 0); omitido = 0. @example 2000 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantidadeDisponivelInicial?: number;
}
