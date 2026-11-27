import {
  type DetalheErro,
  InvalidInputError,
} from '../../../shared/domain/errors/domain.error.js';

export type BaseRateio = 'FORNADAS' | 'MINUTOS';

export interface ConfiguracaoCustosValores {
  baseRateio: BaseRateio;
  capacidadeMensal: number;
  lucroPadrao: number;
  impostoPercentual: number;
  taxaMaquininha: number;
  /** Reais por hora de trabalho da dona (BE-45), ≥ 0. */
  valorHora: number;
}

/**
 * Padrões de uma empresa nova (BE-24), pensados para quem está começando e
 * ainda não fatura: 40 fornadas por mês, lucro de 15% do preço, sem imposto
 * (informal ou MEI, cujo DAS entra como gasto mensal) e sem maquininha.
 * O valor da hora começa em 0 (BE-45): o trabalho só entra no custo quando
 * ela preencher. Os mesmos valores são os defaults da tabela
 * `configuracao_custos`.
 */
export const CONFIGURACAO_CUSTOS_PADRAO: Readonly<ConfiguracaoCustosValores> =
  Object.freeze({
    baseRateio: 'FORNADAS',
    capacidadeMensal: 40,
    lucroPadrao: 0.15,
    impostoPercentual: 0,
    taxaMaquininha: 0,
    valorHora: 0,
  });

const FRACOES = ['lucroPadrao', 'impostoPercentual', 'taxaMaquininha'] as const;

/**
 * Confere a configuração já mesclada com os valores salvos: capacidade maior
 * que zero, frações do preço entre 0 e 1 e valor da hora ≥ 0. Lança 400 `DADOS_INVALIDOS`, no
 * mesmo formato do ValidationPipe, com um detalhe por campo inválido.
 */
export function validarConfiguracaoCustos(
  config: ConfiguracaoCustosValores,
): void {
  const details: DetalheErro[] = [];
  if (
    !Number.isFinite(config.capacidadeMensal) ||
    config.capacidadeMensal <= 0
  ) {
    details.push({
      field: 'capacidadeMensal',
      messages: ['capacidadeMensal deve ser maior que zero'],
    });
  }
  for (const campo of FRACOES) {
    const valor = config[campo];
    if (!Number.isFinite(valor) || valor < 0 || valor > 1) {
      details.push({
        field: campo,
        messages: [`${campo} deve ser uma fração entre 0 e 1`],
      });
    }
  }
  if (!Number.isFinite(config.valorHora) || config.valorHora < 0) {
    details.push({
      field: 'valorHora',
      messages: ['valorHora não pode ser negativo'],
    });
  }
  if (details.length > 0) {
    throw new InvalidInputError(
      'DADOS_INVALIDOS',
      'Os dados enviados são inválidos',
      details,
    );
  }
}
