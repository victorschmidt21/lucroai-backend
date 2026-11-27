import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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

export class CreateItemReceitaReceitaDto {
  /** Receita da empresa, só com ingredientes (um nível só). @example 2 */
  @IsInt()
  @IsPositive()
  receita_id: number;

  /**
   * Quantidade por lote, na unidade do rendimento da receita usada
   * (`unidadeRendimento`): gramas se ela rende em G, unidades se em UN.
   * @example 150
   */
  @IsNumber()
  @IsPositive()
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
   * Minutos em que você fica ocupada com 1 lote (preparar, mexer, montar,
   * embalar), sem o tempo sozinha no forno ou na geladeira; ≥ 0. Padrão 0
   * (BE-45). @example 40
   */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  minutos_trabalho_por_lote?: number | null;

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

  /**
   * `false`: a receita só serve para usar dentro de outras (BE-39).
   * Padrão `true`. @example true
   */
  @IsOptional()
  @IsBoolean()
  vendavel?: boolean;

  /**
   * Insumos da receita. Omitido → `[]` (BE-39); a receita precisa de ao
   * menos um insumo ou receita.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemReceitaDto)
  insumos?: CreateItemReceitaDto[];

  /**
   * Receitas usadas dentro desta (BE-39), sem repetir, cada uma só com
   * ingredientes. Omitido → `[]`.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemReceitaReceitaDto)
  receitas?: CreateItemReceitaReceitaDto[];
}
