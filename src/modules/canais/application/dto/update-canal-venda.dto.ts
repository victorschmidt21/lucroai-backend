import { PartialType } from '@nestjs/swagger';
import { CreateCanalVendaDto } from './create-canal-venda.dto.js';

/**
 * Corpo de `PUT /canais/:id`: todos os campos opcionais, omitido mantém o
 * valor salvo. Ativar e desativar é `{ "ativo": true | false }`.
 */
export class UpdateCanalVendaDto extends PartialType(CreateCanalVendaDto) {}
