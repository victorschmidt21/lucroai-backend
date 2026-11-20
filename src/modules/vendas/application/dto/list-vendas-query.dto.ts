import { IsEnum, IsISO8601, IsOptional, Matches } from 'class-validator';
import { StatusVenda } from '../../../../generated/prisma/client.js';

/**
 * Data e hora com fuso (`Z` ou `±hh:mm`), para comparar como instante
 * (BE-13, lacuna 7). Só a data (`2026-11-19`) não é aceita.
 */
const DATA_HORA_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const MENSAGEM_DATA =
  'deve ser uma data e hora ISO 8601 com fuso (ex.: 2026-11-19T03:00:00.000Z)';

/** Query de `GET /vendas`; filtro inválido → 400 (BE-13, lacuna 8). */
export class ListVendasQueryDto {
  /** @example 'PENDENTE' */
  @IsOptional()
  @IsEnum(StatusVenda)
  status?: StatusVenda;

  /** `dataVenda ≥ dataInicio`. @example '2026-11-01T03:00:00.000Z' */
  @IsOptional()
  @Matches(DATA_HORA_ISO, { message: `dataInicio ${MENSAGEM_DATA}` })
  @IsISO8601({ strict: true })
  dataInicio?: string;

  /** `dataVenda ≤ dataFim`. @example '2026-11-20T02:59:59.999Z' */
  @IsOptional()
  @Matches(DATA_HORA_ISO, { message: `dataFim ${MENSAGEM_DATA}` })
  @IsISO8601({ strict: true })
  dataFim?: string;
}
