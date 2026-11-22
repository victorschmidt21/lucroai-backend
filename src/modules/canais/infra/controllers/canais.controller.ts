import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/usuario-autenticado.js';
import type { CanalVendaDto } from '../../application/dto/canal-venda.dto.js';
import { CreateCanalVendaDto } from '../../application/dto/create-canal-venda.dto.js';
import { UpdateCanalVendaDto } from '../../application/dto/update-canal-venda.dto.js';
import { CanalVendaService } from '../../application/services/canal-venda.service.js';

@ApiTags('canais')
@ApiBearerAuth()
@Controller('canais')
export class CanaisController {
  constructor(private readonly service: CanalVendaService) {}

  /** Lista os canais de venda da empresa, o Balcão primeiro */
  @Get()
  list(@CurrentUser() usuario: UsuarioAutenticado): Promise<CanalVendaDto[]> {
    return this.service.list(usuario.empresa.id);
  }

  /** Cria um canal de venda */
  @Post()
  create(
    @Body() dto: CreateCanalVendaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<CanalVendaDto> {
    return this.service.create(dto, usuario.empresa.id);
  }

  /** Edita, ativa ou desativa um canal de venda (campos opcionais) */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCanalVendaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<CanalVendaDto> {
    return this.service.update(id, dto, usuario.empresa.id);
  }

  /** Exclui um canal de venda (o Balcão não pode ser excluído) */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.service.delete(id, usuario.empresa.id);
  }
}
