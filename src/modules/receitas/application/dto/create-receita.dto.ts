import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { UnidadeMedida } from '../../../../generated/prisma/client.js';

export class CreateItemReceitaDto {
  /** Insumo da empresa. @example 1 */
  @IsInt()
  @IsPositive()
  insumo_id: number;

  /** Quantidade por lote, na unidade do insumo. @example 0.25 */
  @IsNumber()
  @Min(0.001)
  quantidade: number;
}

/**
 * Corpo de `POST /receitas`, como o `create-receita.dto.ts` do recipe-service
 * (snake_case, menos `unidadeRendimento`).
 */
export class CreateReceitaDto {
  /** @example 'Bolo de Chocolate' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome: string;

  /** Unidades produzidas por lote. @example 12 */
  @IsInt()
  @IsPositive()
  rendimento: number;

  /** @example 'UN' */
  @IsEnum(UnidadeMedida)
  unidadeRendimento: UnidadeMedida;

  /** Fração (0.5 = 50%), ≥ 0; sem margem não há preço sugerido. @example 0.5 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  margem_lucro?: number | null;

  /** Itens da receita (pelo menos um). */
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateItemReceitaDto)
  insumos: CreateItemReceitaDto[];
}
