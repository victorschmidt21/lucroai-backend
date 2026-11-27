import type {
  BaseRateio,
  ConfiguracaoCustos,
} from '../../../../generated/prisma/client.js';

export class ConfiguracaoCustosDto {
  /** @example 1 */
  empresaId: number;
  /** @example 'FORNADAS' */
  baseRateio: BaseRateio;
  /** @example 40 */
  capacidadeMensal: number;
  /** @example 0.15 */
  lucroPadrao: number;
  /** @example 0 */
  impostoPercentual: number;
  /** @example 0 */
  taxaMaquininha: number;
  /** Reais por hora de trabalho da dona (BE-45). @example 0 */
  valorHora: number;
}

// Sem arredondamento: são os valores que a pessoa digitou, e as frações
// precisam de mais casas que as do dinheiro.
export function toConfiguracaoCustosDto(
  row: ConfiguracaoCustos,
): ConfiguracaoCustosDto {
  return {
    empresaId: row.empresaId,
    baseRateio: row.baseRateio,
    capacidadeMensal: row.capacidadeMensal,
    lucroPadrao: row.lucroPadrao,
    impostoPercentual: row.impostoPercentual,
    taxaMaquininha: row.taxaMaquininha,
    valorHora: row.valorHora,
  };
}
