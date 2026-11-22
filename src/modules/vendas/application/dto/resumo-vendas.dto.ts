import { round2, round4 } from '../../../../shared/domain/arredondamento.js';
import type { MotivoSemPontoEquilibrio } from '../../../receitas/domain/receitas.calculos.js';
import type { PontoEquilibrioEmpresa } from '../../domain/vendas.calculos.js';

/** Ponto de equilíbrio da empresa (BE-31). */
export class PontoEquilibrioEmpresaDto {
  /** Faturamento por mês para pagar os gastos mensais, com 2 casas; `null` com o motivo. @example 2862.5 */
  valor: number | null;
  /** `SEM_VENDAS` sem vendas concluídas na janela; `MARGEM_NEGATIVA` com margem total ≤ 0. @example null */
  motivo: MotivoSemPontoEquilibrio | null;
}

/** Resposta de `GET /vendas/resumo`, para o painel (BE-31). */
export class ResumoVendasDto {
  /** Janela do mix de vendas, em dias. @example 30 */
  dias: number;
  /** Início da janela (`dataVenda ≥ dataInicio`). @example '2026-10-22T12:00:00.000Z' */
  dataInicio: string;
  /** Vendas concluídas na janela. @example 42 */
  vendas: number;
  /** `Σ quantidade × preço` das vendas concluídas, com 2 casas. @example 3500 */
  receita: number;
  /** `Σ quantidade × margem de contribuição`, com 2 casas. @example 2977.5 */
  margemContribuicao: number;
  /** `margemContribuicao ÷ receita`, fração com 4 casas; `null` sem vendas. @example 0.8507 */
  indiceMargemContribuicao: number | null;
  /** Soma dos gastos `MENSAL` da empresa, com 2 casas. @example 2435 */
  gastosMensais: number;
  pontoEquilibrio: PontoEquilibrioEmpresaDto;
}

export function toResumoVendasDto(
  ponto: PontoEquilibrioEmpresa,
  janela: { dias: number; dataInicio: Date; vendas: number },
): ResumoVendasDto {
  return {
    dias: janela.dias,
    dataInicio: janela.dataInicio.toISOString(),
    vendas: janela.vendas,
    receita: round2(ponto.receita),
    margemContribuicao: round2(ponto.margemContribuicao),
    indiceMargemContribuicao:
      ponto.indiceMargemContribuicao === null
        ? null
        : round4(ponto.indiceMargemContribuicao),
    gastosMensais: round2(ponto.gastosMensais),
    pontoEquilibrio: {
      valor: ponto.valor === null ? null : round2(ponto.valor),
      motivo: ponto.motivo,
    },
  };
}
