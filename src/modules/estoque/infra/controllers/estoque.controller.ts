import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/usuario-autenticado.js';
import { AtualizarMinimoEstoqueDto } from '../../application/dto/atualizar-minimo-estoque.dto.js';
import type { EstoqueDto } from '../../application/dto/estoque.dto.js';
import type { MovimentacaoEstoqueDto } from '../../application/dto/movimentacao-estoque.dto.js';
import { RegistrarEntradaEstoqueDto } from '../../application/dto/registrar-entrada-estoque.dto.js';
import { EstoqueService } from '../../application/services/estoque.service.js';

@ApiTags('estoque')
@ApiBearerAuth()
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly service: EstoqueService) {}

  /** Lista o estoque de todos os insumos da empresa (novo, BE-11) */
  @Get('insumos')
  list(@CurrentUser() usuario: UsuarioAutenticado): Promise<EstoqueDto[]> {
    return this.service.list(usuario.empresa.id);
  }

  /** Estoque de um insumo */
  @Get('insumos/:id')
  findByInsumo(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<EstoqueDto> {
    return this.service.findByInsumo(id, usuario.empresa.id);
  }

  /** Registra uma entrada (compra) no estoque do insumo */
  @Post('insumos/:id/entrada')
  registrarEntrada(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarEntradaEstoqueDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<EstoqueDto> {
    return this.service.registrarEntrada(id, dto, usuario.empresa.id);
  }

  /** Define o estoque mínimo do insumo (novo, BE-11) */
  @Patch('insumos/:id/minimo')
  atualizarMinimo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarMinimoEstoqueDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<EstoqueDto> {
    return this.service.atualizarMinimo(id, dto, usuario.empresa.id);
  }

  /** Movimentações do insumo, a mais recente primeiro */
  @Get('insumos/:id/movimentacoes')
  listMovimentacoes(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<MovimentacaoEstoqueDto[]> {
    return this.service.listMovimentacoes(id, usuario.empresa.id);
  }
}
