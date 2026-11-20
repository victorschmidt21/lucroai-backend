import { PartialType } from '@nestjs/swagger';
import { CreateReceitaDto } from './create-receita.dto.js';

/**
 * Corpo de `PUT /receitas/:id`: campo omitido mantém o valor salvo, e
 * `margem_lucro: null` remove a margem e o preço sugerido (lacuna 21).
 */
export class UpdateReceitaDto extends PartialType(CreateReceitaDto) {}
