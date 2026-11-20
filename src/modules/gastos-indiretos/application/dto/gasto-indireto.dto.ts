import type {
  GastoIndireto,
  MetodoRateio,
} from '../../../../generated/prisma/client.js';

export class GastoIndiretoDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  empresaId: number;
  /** @example 'Aluguel' */
  descricao: string;
  /** @example 1800 */
  valor: number;
  /** @example 'FIXO' */
  metodoRateio: MetodoRateio;
}

export function toGastoIndiretoDto(row: GastoIndireto): GastoIndiretoDto {
  return {
    id: row.id,
    empresaId: row.empresaId,
    descricao: row.descricao,
    valor: row.valor,
    metodoRateio: row.metodoRateio,
  };
}
