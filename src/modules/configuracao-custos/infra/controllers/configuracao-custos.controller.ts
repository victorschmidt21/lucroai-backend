import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/usuario-autenticado.js';
import type { ConfiguracaoCustosDto } from '../../application/dto/configuracao-custos.dto.js';
import { UpdateConfiguracaoCustosDto } from '../../application/dto/update-configuracao-custos.dto.js';
import { ConfiguracaoCustosService } from '../../application/services/configuracao-custos.service.js';

@ApiTags('configuracao-custos')
@ApiBearerAuth()
@Controller('configuracao-custos')
export class ConfiguracaoCustosController {
  constructor(private readonly service: ConfiguracaoCustosService) {}

  /** Configuração de custos da empresa: base de rateio, capacidade e percentuais */
  @Get()
  find(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ConfiguracaoCustosDto> {
    return this.service.find(usuario.empresa.id);
  }

  /** Atualiza a configuração de custos (campos opcionais) */
  @Put()
  update(
    @Body() dto: UpdateConfiguracaoCustosDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ConfiguracaoCustosDto> {
    return this.service.update(dto, usuario.empresa.id);
  }
}
