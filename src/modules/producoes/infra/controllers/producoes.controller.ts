import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/usuario-autenticado.js';
import { CreateProducaoDto } from '../../application/dto/create-producao.dto.js';
import { ListProducoesQueryDto } from '../../application/dto/list-producoes-query.dto.js';
import type { ProducaoDto } from '../../application/dto/producao.dto.js';
import { ProducaoService } from '../../application/services/producao.service.js';

@ApiTags('producoes')
@ApiBearerAuth()
@Controller('producoes')
export class ProducoesController {
  constructor(private readonly service: ProducaoService) {}

  /** Lista as produções da empresa, a mais recente primeiro */
  @Get()
  list(
    @Query() query: ListProducoesQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProducaoDto[]> {
    return this.service.list(query, usuario.empresa.id);
  }

  /** Detalha uma produção */
  @Get(':id')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProducaoDto> {
    return this.service.findById(id, usuario.empresa.id);
  }

  /** Registra uma produção: rateio, baixa dos insumos e entrada do produto acabado numa transação só */
  @Post()
  create(
    @Body() dto: CreateProducaoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProducaoDto> {
    return this.service.create(dto, usuario.empresa.id);
  }
}
