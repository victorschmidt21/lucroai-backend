import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';

export class ItemVendaInputDto {
  /** Receita da empresa; de outra empresa → 404. @example 1 */
  @IsInt()
  @IsPositive()
  receita_id: number;

  /** Unidades vendidas. @example 2 */
  @IsInt()
  @IsPositive()
  quantidade: number;

  /** Preço cobrado por unidade, até 2 casas. @example 12.5 */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  preco_unitario_real: number;
}

/** Corpo de `POST /vendas`, como o `CreateVendaDto` do sales-service. */
export class CreateVendaDto {
  /**
   * Novo (BE-30), opcional: canal onde a venda aconteceu, ativo ou não;
   * omitido → Balcão. De outra empresa → 404. @example 1
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  canal_id?: number;

  /** Não pode ser vazio (BE-13, lacuna 25). */
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ItemVendaInputDto)
  itens: ItemVendaInputDto[];
}
