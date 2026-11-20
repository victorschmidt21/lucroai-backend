import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/usuario-autenticado.js';
import { CreateVendaDto } from '../../application/dto/create-venda.dto.js';
import { ListVendasQueryDto } from '../../application/dto/list-vendas-query.dto.js';
import { UpdateVendaStatusDto } from '../../application/dto/update-venda-status.dto.js';
import type { VendaDto } from '../../application/dto/venda.dto.js';
import { VendaService } from '../../application/services/venda.service.js';

@ApiTags('vendas')
@ApiBearerAuth()
@Controller('vendas')
export class VendasController {
  constructor(private readonly service: VendaService) {}

  /** Lista as vendas da empresa, a mais recente primeiro */
  @Get()
  list(
    @Query() query: ListVendasQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<VendaDto[]> {
    return this.service.list(query, usuario.empresa.id);
  }

  /** Detalha uma venda */
  @Get(':id')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<VendaDto> {
    return this.service.findById(id, usuario.empresa.id);
  }

  /** Registra uma venda PENDENTE (não confere o estoque) */
  @Post()
  create(
    @Body() dto: CreateVendaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<VendaDto> {
    return this.service.create(dto, usuario.empresa.id);
  }

  /** Conclui (com baixa do produto acabado na mesma transação) ou cancela uma venda PENDENTE */
  @Patch(':id/status')
  atualizarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVendaStatusDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<VendaDto> {
    return this.service.atualizarStatus(id, dto, usuario.empresa.id);
  }
}
