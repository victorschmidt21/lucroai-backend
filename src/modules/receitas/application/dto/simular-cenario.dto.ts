import { IsInt, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { round2, round4 } from '../../../../shared/domain/arredondamento.js';
import type {
  MotivoSemPontoEquilibrio,
  SimulacaoCenario,
} from '../../domain/receitas.calculos.js';

/** Corpo de `POST /receitas/:id/simular`; campo omitido usa o valor calculado. */
export class SimularCenarioDto {
  /** Custo unitário; omitido usa o custo calculado na leitura. @example 0.9 */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  novoCusto?: number;

  /** Preço praticado; omitido usa o preço sugerido no canal. @example 1.5 */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  novoPreco?: number;

  /** Unidades vendidas no mês; omitido usa o rendimento. @example 100 */
  @IsOptional()
  @IsInt()
  @IsPositive()
  volume?: number;

  /** Canal da venda (BE-31); omitido usa o Balcão. @example 2 */
  @IsOptional()
  @IsInt()
  @IsPositive()
  canalId?: number;
}

/** Ponto de equilíbrio do produto (BE-31). */
export class PontoEquilibrioProdutoDto {
  /** Unidades por mês para pagar os gastos mensais; `null` com o motivo. @example 3947 */
  unidades: number | null;
  /** `MARGEM_NEGATIVA` quando a margem de contribuição é ≤ 0. @example null */
  motivo: MotivoSemPontoEquilibrio | null;
}

/** Resposta de `POST /receitas/:id/simular` (`simulacao-cenario-resultado.dto.ts`). */
export class SimulacaoCenarioDto {
  /** Com 4 casas. @example 0.5822 */
  custoUnitario: number;
  /** Com 4 casas. @example 0.6961 */
  precoVenda: number;
  /** @example 100 */
  volume: number;
  /** Lucro no mês (`lucroMes`), com 2 casas. Muda (BE-31): desconta imposto e taxas. @example 10.44 */
  lucroEstimado: number;
  /** Lucro real (`lucroReal`), fração com 4 casas. Muda (BE-31). @example 0.15 */
  margemProjetada: number;
  /**
   * `ceil(custo × volume / preço)`, em unidades.
   * @deprecated Use `pontoEquilibrio` (BE-31); sai quando o frontend usá-lo.
   * @example 84
   */
  breakEven: number;
  /** Canal simulado (BE-31). @example 1 */
  canalId: number;
  /** @example 'Balcão' */
  canal: string;
  /** Custo sem os gastos mensais, com 4 casas (BE-31). @example 0.0696 */
  custoSemGastosMensais: number;
  /** Imposto, taxa do canal e gastos `PERCENTUAL_VENDA`, fração com 4 casas (BE-31). @example 0.0136 */
  percentuaisSemLucro: number;
  /** Margem de contribuição por unidade, com 4 casas (BE-31). @example 0.617 */
  margemContribuicao: number;
  /** Com 4 casas (BE-31). @example 0.1044 */
  lucroPorUnidade: number;
  /** `lucroPorUnidade ÷ preço`, fração com 4 casas (BE-31). @example 0.15 */
  lucroReal: number;
  /** `lucroPorUnidade × volume`, com 2 casas (BE-31). @example 10.44 */
  lucroMes: number;
  /** Soma dos gastos `MENSAL` da empresa, com 2 casas (BE-31). @example 2435 */
  gastosMensais: number;
  pontoEquilibrio: PontoEquilibrioProdutoDto;
}

export function toSimulacaoCenarioDto(
  cenario: SimulacaoCenario,
  canal: { id: number; nome: string },
): SimulacaoCenarioDto {
  const lucroMes = round2(cenario.lucroMes);
  const lucroReal = round4(cenario.lucroReal);
  return {
    custoUnitario: round4(cenario.custoUnitario),
    precoVenda: round4(cenario.precoVenda),
    volume: cenario.volume,
    lucroEstimado: lucroMes,
    margemProjetada: lucroReal,
    breakEven: cenario.breakEven,
    canalId: canal.id,
    canal: canal.nome,
    custoSemGastosMensais: round4(cenario.custoSemGastosMensais),
    percentuaisSemLucro: round4(cenario.percentuaisSemLucro),
    margemContribuicao: round4(cenario.margemContribuicao),
    lucroPorUnidade: round4(cenario.lucroPorUnidade),
    lucroReal,
    lucroMes,
    gastosMensais: round2(cenario.gastosMensais),
    pontoEquilibrio: { ...cenario.pontoEquilibrio },
  };
}
