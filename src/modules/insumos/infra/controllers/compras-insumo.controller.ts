import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/usuario-autenticado.js';
import type { CompraInsumoDto } from '../../application/dto/compra-insumo.dto.js';
import { CreateCompraInsumoDto } from '../../application/dto/create-compra-insumo.dto.js';
import { CompraInsumoService } from '../../application/services/compra-insumo.service.js';

@ApiTags('insumos')
@ApiBearerAuth()
@Controller('insumos/:id/compras')
export class ComprasInsumoController {
  constructor(private readonly service: CompraInsumoService) {}

  /** Compras do insumo, a mais recente primeiro (novo, BE-29) */
  @Get()
  list(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<CompraInsumoDto[]> {
    return this.service.list(id, usuario.empresa.id);
  }

  /** Registra uma compra: entrada no estoque e novo custo médio (novo, BE-29) */
  @Post()
  registrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCompraInsumoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<CompraInsumoDto> {
    return this.service.registrar(id, dto, usuario.empresa.id);
  }
}
