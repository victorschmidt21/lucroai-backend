import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/usuario-autenticado.js';
import { CreateInsumoDto } from '../../application/dto/create-insumo.dto.js';
import type { InsumoDto } from '../../application/dto/insumo.dto.js';
import { UpdateInsumoDto } from '../../application/dto/update-insumo.dto.js';
import { InsumoService } from '../../application/services/insumo.service.js';

@ApiTags('insumos')
@ApiBearerAuth()
@Controller('insumos')
export class InsumosController {
  constructor(private readonly service: InsumoService) {}

  /** Lista os insumos da empresa, ordenados por nome */
  @Get()
  list(@CurrentUser() usuario: UsuarioAutenticado): Promise<InsumoDto[]> {
    return this.service.list(usuario.empresa.id);
  }

  /** Detalha um insumo */
  @Get(':id')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<InsumoDto> {
    return this.service.findById(id, usuario.empresa.id);
  }

  /** Cria um insumo e o estoque inicial */
  @Post()
  create(
    @Body() dto: CreateInsumoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<InsumoDto> {
    return this.service.create(dto, usuario.empresa.id);
  }

  /** Atualiza um insumo (campos opcionais); mudar o preço informa o preço de mercado */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInsumoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<InsumoDto> {
    return this.service.update(id, dto, usuario.empresa.id);
  }

  /** Exclui um insumo (409 se usado em receita) */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.service.delete(id, usuario.empresa.id);
  }
}
