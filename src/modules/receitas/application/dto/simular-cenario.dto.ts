import { IsInt, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { round2, round4 } from '../../../../shared/domain/arredondamento.js';
import type { SimulacaoCenario } from '../../domain/receitas.calculos.js';

/** Corpo de `POST /receitas/:id/simular`; campo omitido usa o valor salvo. */
export class SimularCenarioDto {
  /** Custo unitário; omitido usa o `custoUnitario` salvo. @example 0.9 */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  novoCusto?: number;

  /** Preço de venda; omitido usa o `precoSugerido` salvo. @example 1.5 */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  novoPreco?: number;

  /** Unidades vendidas; omitido usa o rendimento. @example 100 */
  @IsOptional()
  @IsInt()
  @IsPositive()
  volume?: number;
}

/** Resposta de `POST /receitas/:id/simular` (`simulacao-cenario-resultado.dto.ts`). */
export class SimulacaoCenarioDto {
  /** Com 4 casas. @example 0.9 */
  custoUnitario: number;
  /** Com 4 casas. @example 1.5 */
  precoVenda: number;
  /** @example 100 */
  volume: number;
  /** `(preço − custo) × volume`, com 2 casas. @example 60 */
  lucroEstimado: number;
  /** Fração com 4 casas (BE-23), pode ser negativa. @example 0.4 */
  margemProjetada: number;
  /** `ceil(custo × volume / preço)`, em unidades. @example 60 */
  breakEven: number;
}

export function toSimulacaoCenarioDto(
  cenario: SimulacaoCenario,
): SimulacaoCenarioDto {
  return {
    custoUnitario: round4(cenario.custoUnitario),
    precoVenda: round4(cenario.precoVenda),
    volume: cenario.volume,
    lucroEstimado: round2(cenario.lucroEstimado),
    margemProjetada: round4(cenario.margemProjetada),
    breakEven: cenario.breakEven,
  };
}
