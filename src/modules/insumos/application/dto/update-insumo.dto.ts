import { OmitType, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { CreateInsumoDto } from './create-insumo.dto.js';

/**
 * Corpo de `PATCH /insumos/:id`: o saldo só muda pelo estoque e pelas
 * compras. Mudar `valorPago` ou `quantidadeBaseCusto` informa um preço de
 * mercado novo (BE-29), sem mexer no custo médio.
 */
export class UpdateInsumoDto extends PartialType(
  OmitType(CreateInsumoDto, ['quantidadeDisponivelInicial'] as const),
) {
  /**
   * Novo (BE-29): preço de mercado por unidade do insumo (≥ 0), quando o
   * preço mudou sem compra. Vira o custo de reposição, que forma o preço das
   * receitas; `null` volta ao último custo de compra. @example 0.006
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  precoMercado?: number | null;
}
