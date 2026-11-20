import { PartialType } from '@nestjs/swagger';
import { CreateGastoIndiretoDto } from './create-gasto-indireto.dto.js';

/** Corpo de `PUT /gastos-indiretos/:id`: todos os campos opcionais. */
export class UpdateGastoIndiretoDto extends PartialType(
  CreateGastoIndiretoDto,
) {}
