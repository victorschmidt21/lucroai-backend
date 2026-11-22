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

  /** Unidades **boas** (vendáveis) por lote. @example 12 */
  @IsInt()
  @IsPositive()
  rendimento: number;

  /** @example 'UN' */
  @IsEnum(UnidadeMedida)
  unidadeRendimento: UnidadeMedida;

  /**
   * Markup sobre o custo (0.5 = 50%), ≥ 0, mantido por compatibilidade:
   * vira `lucro_percentual = margem ÷ (1 + margem)`, que dá o mesmo preço.
   * Ignorado se `lucro_percentual` vier. @example 0.5
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  margem_lucro?: number | null;

  /**
   * Fornadas ou minutos de forno de 1 lote, conforme a `baseRateio` da
   * empresa, > 0. Padrão 1. @example 1
   */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  uso_por_lote?: number | null;

  /** Reais por unidade (caixa, pote ou saquinho), ≥ 0. Padrão 0. @example 0.15 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  embalagem_por_unidade?: number | null;

  /**
   * Fração das unidades que não são vendidas (sobra, queima), de 0 até
   * menos de 1. Padrão 0. @example 0.05
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  perda_percentual?: number | null;

  /**
   * Lucro como fração do **preço**, de 0 até menos de 1; omitido ou `null`
   * usa o `lucroPadrao` da empresa. @example 0.15
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  lucro_percentual?: number | null;

  /** Itens da receita (pelo menos um). */
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateItemReceitaDto)
  insumos: CreateItemReceitaDto[];
}
