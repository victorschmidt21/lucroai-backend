import { IsEnum } from 'class-validator';
import { StatusVenda } from '../../../../generated/prisma/client.js';

/** Corpo de `PATCH /vendas/:id/status`. */
export class UpdateVendaStatusDto {
  /** `CONCLUIDA` ou `CANCELADA` (só uma venda `PENDENTE` muda). @example 'CONCLUIDA' */
  @IsEnum(StatusVenda)
  status: StatusVenda;
}
