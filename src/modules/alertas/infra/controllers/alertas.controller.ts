import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/usuario-autenticado.js';
import type { AlertasDto } from '../../application/dto/alertas.dto.js';
import { AlertaService } from '../../application/services/alerta.service.js';

@ApiTags('alertas')
@ApiBearerAuth()
@Controller('alertas')
export class AlertasController {
  constructor(private readonly service: AlertaService) {}

  /** Insumos com estoque negativo e com preço defasado, para avisar ao entrar */
  @Get()
  listar(@CurrentUser() usuario: UsuarioAutenticado): Promise<AlertasDto> {
    return this.service.listar(usuario.empresa.id);
  }
}
