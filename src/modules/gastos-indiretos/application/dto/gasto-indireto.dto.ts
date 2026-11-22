import type {
  GastoIndireto,
  TipoGasto,
} from '../../../../generated/prisma/client.js';
import {
  metodoRateioDoTipo,
  type MetodoRateio,
} from '../../domain/gastos-indiretos.calculos.js';

export class GastoIndiretoDto {
  /** @example 1 */
  id: number;
  /** @example 1 */
  empresaId: number;
  /** @example 'Aluguel' */
  descricao: string;
  /** @example 1800 */
  valor: number;
  /** Como o gasto entra no custo (BE-26). @example 'MENSAL' */
  tipo: TipoGasto;
  /**
   * Legado, derivado do `tipo` para o schema do frontend atual: `FIXO` para
   * `MENSAL` e `PERCENTUAL_VENDA`, `POR_UNIDADE` para `POR_UNIDADE`.
   * @deprecated Use `tipo`.
   * @example 'FIXO'
   */
  metodoRateio: MetodoRateio;
}

export function toGastoIndiretoDto(row: GastoIndireto): GastoIndiretoDto {
  return {
    id: row.id,
    empresaId: row.empresaId,
    descricao: row.descricao,
    valor: row.valor,
    tipo: row.tipo,
    metodoRateio: metodoRateioDoTipo(row.tipo),
  };
}
