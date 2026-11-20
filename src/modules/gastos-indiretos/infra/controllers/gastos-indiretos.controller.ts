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
import { CreateGastoIndiretoDto } from '../../application/dto/create-gasto-indireto.dto.js';
import type { GastoIndiretoDto } from '../../application/dto/gasto-indireto.dto.js';
import { UpdateGastoIndiretoDto } from '../../application/dto/update-gasto-indireto.dto.js';
import { GastoIndiretoService } from '../../application/services/gasto-indireto.service.js';

@ApiTags('gastos-indiretos')
@ApiBearerAuth()
@Controller('gastos-indiretos')
export class GastosIndiretosController {
  constructor(private readonly service: GastoIndiretoService) {}

  /** Lista os gastos indiretos da empresa, o mais novo primeiro */
  @Get()
  list(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<GastoIndiretoDto[]> {
    return this.service.list(usuario.empresa.id);
  }

  /** Detalha um gasto indireto */
  @Get(':id')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<GastoIndiretoDto> {
    return this.service.findById(id, usuario.empresa.id);
  }

  /** Cria um gasto indireto */
  @Post()
  create(
    @Body() dto: CreateGastoIndiretoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<GastoIndiretoDto> {
    return this.service.create(dto, usuario.empresa.id);
  }

  /** Atualiza um gasto indireto (campos opcionais) */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGastoIndiretoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<GastoIndiretoDto> {
    return this.service.update(id, dto, usuario.empresa.id);
  }

  /** Exclui um gasto indireto (os rateios das produções antigas ficam) */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.service.delete(id, usuario.empresa.id);
  }
}
