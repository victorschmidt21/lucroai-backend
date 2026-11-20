import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateInsumoDto } from './create-insumo.dto.js';

/** Corpo de `PATCH /insumos/:id`: o saldo só muda pelo estoque. */
export class UpdateInsumoDto extends PartialType(
  OmitType(CreateInsumoDto, ['quantidadeDisponivelInicial'] as const),
) {}
