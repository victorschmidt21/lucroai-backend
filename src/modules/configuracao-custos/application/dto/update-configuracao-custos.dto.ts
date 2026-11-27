import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { BaseRateio } from '../../../../generated/prisma/client.js';

/**
 * Corpo de `PUT /configuracao-custos`: campo omitido mantém o valor salvo.
 * Os limites (capacidade > 0, frações entre 0 e 1 e valor da hora ≥ 0) ficam em
 * `validarConfiguracaoCustos`, conferidos depois de mesclar com o salvo.
 */
export class UpdateConfiguracaoCustosDto {
  /** O que a capacidade mensal conta: fornadas ou minutos de forno. @example 'FORNADAS' */
  @IsOptional()
  @IsEnum(BaseRateio)
  baseRateio?: BaseRateio;

  /** Fornadas (ou minutos de forno) por mês, maior que zero. @example 40 */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  capacidadeMensal?: number;

  /** Lucro como fração do preço de venda, de 0 a 1. @example 0.15 */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  lucroPadrao?: number;

  /** Imposto como fração do preço, de 0 a 1 (informal ou MEI: 0). @example 0 */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  impostoPercentual?: number;

  /** Taxa da maquininha como fração do preço no balcão, de 0 a 1. @example 0 */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  taxaMaquininha?: number;

  /** Reais por hora de trabalho da dona (BE-45), ≥ 0. @example 18.75 */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  valorHora?: number;
}
