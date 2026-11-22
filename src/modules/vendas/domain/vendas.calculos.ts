import { round6 } from '../../../shared/domain/arredondamento.js';
import {
  calcularMargemContribuicao,
  MOTIVO_MARGEM_NEGATIVA,
  MOTIVO_SEM_VENDAS,
  type MotivoSemPontoEquilibrio,
} from '../../receitas/domain/receitas.calculos.js';

/** Janela do mix de vendas do ponto de equilíbrio da empresa (BE-31). */
export const DIAS_PONTO_EQUILIBRIO = 30;

/** Um item de venda concluída, com o custo variável atual da receita. */
export interface ItemParaMargem {
  quantidade: number;
  precoUnitarioReal: number;
  /** `custoSemGastosMensais` da receita, ao custo médio dos insumos. */
  custoSemGastosMensais: number;
  /** Imposto, taxa do canal e gastos `PERCENTUAL_VENDA` da venda. */
  percentuaisSemLucro: number;
}

/**
 * Percentuais sem o lucro com que a venda foi registrada (BE-30), tirados do
 * que ela gravou: `lucroReal = 1 − custoUnitario ÷ preço − percentuais`.
 * Assim a taxa do canal é a da venda, mesmo com o canal alterado ou excluído.
 * Venda anterior à BE-30 (sem `lucroReal`) → `null`: quem chama usa os do
 * Balcão.
 */
export function percentuaisSemLucroDaVenda(item: {
  precoUnitarioReal: number;
  custoUnitario: number | null;
  lucroReal: number | null;
}): number | null {
  if (item.lucroReal == null || item.custoUnitario == null) return null;
  return 1 - item.custoUnitario / item.precoUnitarioReal - item.lucroReal;
}

export interface PontoEquilibrioEmpresa {
  /** `Σ quantidade × preço` das vendas. */
  receita: number;
  /** `Σ quantidade × MCu`. */
  margemContribuicao: number;
  /** `margemContribuicao ÷ receita`; `null` sem vendas. */
  indiceMargemContribuicao: number | null;
  gastosMensais: number;
  /** Em reais por mês; `null` com o `motivo`. */
  valor: number | null;
  motivo: MotivoSemPontoEquilibrio | null;
}

/**
 * Ponto de equilíbrio da empresa (BE-31), em reais por mês:
 * `gastosMensais ÷ (Σ MC ÷ Σ receita)`, com o mix das vendas informadas.
 * Sem vendas (receita 0) → `null` com `SEM_VENDAS`; margem total ≤ 0 →
 * `null` com `MARGEM_NEGATIVA`. Sem arredondar (o DTO arredonda).
 */
export function calcularPontoEquilibrioEmpresa(
  gastosMensais: number,
  itens: ItemParaMargem[],
): PontoEquilibrioEmpresa {
  const receita = itens.reduce(
    (total, item) => total + item.quantidade * item.precoUnitarioReal,
    0,
  );
  const margemContribuicao = itens.reduce(
    (total, item) =>
      total +
      item.quantidade *
        calcularMargemContribuicao(
          item.precoUnitarioReal,
          item.custoSemGastosMensais,
          item.percentuaisSemLucro,
        ),
    0,
  );
  if (round6(receita) <= 0) {
    return {
      receita,
      margemContribuicao,
      indiceMargemContribuicao: null,
      gastosMensais,
      valor: null,
      motivo: MOTIVO_SEM_VENDAS,
    };
  }
  const indice = margemContribuicao / receita;
  if (round6(margemContribuicao) <= 0) {
    return {
      receita,
      margemContribuicao,
      indiceMargemContribuicao: indice,
      gastosMensais,
      valor: null,
      motivo: MOTIVO_MARGEM_NEGATIVA,
    };
  }
  return {
    receita,
    margemContribuicao,
    indiceMargemContribuicao: indice,
    gastosMensais,
    valor: gastosMensais / indice,
    motivo: null,
  };
}
