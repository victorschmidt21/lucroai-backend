import { PartialType } from '@nestjs/swagger';
import { CreateReceitaDto } from './create-receita.dto.js';

/**
 * Corpo de `PUT /receitas/:id`: campo omitido mantém o valor salvo, e
 * `lucro_percentual: null` (ou `margem_lucro: null`) volta a usar o lucro
 * padrão da empresa.
 */
export class UpdateReceitaDto extends PartialType(CreateReceitaDto) {}
