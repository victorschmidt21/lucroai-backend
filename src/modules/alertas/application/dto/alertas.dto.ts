import type { UnidadeMedida } from '../../../../generated/prisma/client.js';
import { round4, round6 } from '../../../../shared/domain/arredondamento.js';
import type {
  AlertaEstoqueNegativo,
  AlertaPrecoDefasado,
} from '../../domain/alertas.calculos.js';

/** Insumo com saldo abaixo de zero (BE-32). */
export class AlertaEstoqueNegativoDto {
  /** Id do insumo. @example 1 */
  id: number;
  /** @example 'Farinha de trigo' */
  nome: string;
  /** Saldo do estoque, abaixo de zero. @example -250 */
  saldo: number;
  /** @example 'G' */
  unidade: UnidadeMedida;
}

/** Receita que usa um insumo com preço defasado (BE-32). */
export class ReceitaAfetadaDto {
  /** Id da receita. @example 1 */
  id: number;
  /** @example 'Pão francês' */
  nome: string;
  /**
   * Novo preço sugerido no Balcão, com o custo de reposição (o mesmo
   * `precoSugerido` de `GET /receitas/:id`), com 4 casas; `null` com
   * percentuais ≥ 100%. @example 0.7512
   */
  precoSugerido: number | null;
  /** Preço no Balcão com o custo médio dos insumos, com 4 casas; `null` com percentuais ≥ 100%. @example 0.6824 */
  precoComCustoMedio: number | null;
}

/** Insumo cuja reposição subiu mais de 10% sobre o custo médio (BE-32). */
export class AlertaPrecoDefasadoDto {
  /** Id do insumo. @example 1 */
  id: number;
  /** @example 'Farinha de trigo' */
  nome: string;
  /** @example 'G' */
  unidade: UnidadeMedida;
  /** Custo médio por unidade, com 6 casas. @example 0.004 */
  custoMedio: number;
  /** Custo de reposição por unidade, com 6 casas. @example 0.005 */
  custoReposicao: number;
  /** `custoReposicao ÷ custoMedio − 1`, fração com 4 casas (0,25 = 25%). @example 0.25 */
  aumentoPercentual: number;
  /** Receitas que usam o insumo (vazia se nenhuma usa). */
  receitas: ReceitaAfetadaDto[];
}

/** Resposta de `GET /alertas` (BE-32). */
export class AlertasDto {
  /** Insumos com saldo < 0, por nome. */
  estoqueNegativo: AlertaEstoqueNegativoDto[];
  /** Insumos com a reposição mais de 10% acima do custo médio, por nome. */
  precoDefasado: AlertaPrecoDefasadoDto[];
}

export function toAlertasDto(
  estoqueNegativo: AlertaEstoqueNegativo<UnidadeMedida>[],
  precoDefasado: AlertaPrecoDefasado<UnidadeMedida>[],
): AlertasDto {
  return {
    estoqueNegativo,
    precoDefasado: precoDefasado.map((alerta) => ({
      id: alerta.id,
      nome: alerta.nome,
      unidade: alerta.unidade,
      custoMedio: round6(alerta.custoMedio),
      custoReposicao: round6(alerta.custoReposicao),
      aumentoPercentual: round4(alerta.aumentoPercentual),
      receitas: alerta.receitas.map((receita) => ({
        id: receita.id,
        nome: receita.nome,
        precoSugerido: arredondar(receita.precoSugerido),
        precoComCustoMedio: arredondar(receita.precoComCustoMedio),
      })),
    })),
  };
}

function arredondar(preco: number | null): number | null {
  return preco === null ? null : round4(preco);
}
