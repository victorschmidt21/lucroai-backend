import { IsArray, IsInt, IsOptional, IsPositive } from 'class-validator';

export class CreateProducaoDto {
  /** @example 1 */
  @IsInt()
  @IsPositive()
  receita_id: number;

  /** Número de lotes. @example 3 */
  @IsInt()
  @IsPositive()
  quantidade: number;

  /**
   * Gastos rateados. Omitido rateia todos os gastos da empresa; `[]` não
   * rateia nenhum. Só os `MENSAL` entram na produção (BE-30). @example [1, 2]
   */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  gasto_indireto_ids?: number[];
}
