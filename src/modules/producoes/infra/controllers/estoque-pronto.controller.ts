import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/usuario-autenticado.js';
import type { EstoqueProntoDto } from '../../application/dto/estoque-pronto.dto.js';
import { ProducaoService } from '../../application/services/producao.service.js';

/**
 * `GET /estoque/produtos` (BE-12). Mora no `producoes` desde a BE-41, que
 * acrescentou o `vendavel` da receita: o `estoque` não pode depender de
 * `receitas`.
 */
@ApiTags('estoque')
@ApiBearerAuth()
@Controller('estoque')
export class EstoqueProntoController {
  constructor(private readonly service: ProducaoService) {}

  /** Saldo de produto acabado por receita da empresa (novo, BE-12) */
  @Get('produtos')
  listProdutos(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<EstoqueProntoDto[]> {
    return this.service.listarEstoquePronto(usuario.empresa.id);
  }
}
