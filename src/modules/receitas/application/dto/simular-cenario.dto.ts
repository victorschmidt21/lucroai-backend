import { IsInt, IsNumber, IsOptional, IsPositive } from 'class-validator';

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
  /** @example 0.9 */
  custoUnitario: number;
  /** @example 1.5 */
  precoVenda: number;
  /** @example 100 */
  volume: number;
  /** `round2((preço − custo) × volume)`. @example 60 */
  lucroEstimado: number;
  /** Fração com 2 casas, pode ser negativa. @example 0.4 */
  margemProjetada: number;
  /** `ceil(custo × volume / preço)`, em unidades. @example 60 */
  breakEven: number;
}
