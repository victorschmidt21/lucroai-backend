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
import { CreateReceitaDto } from '../../application/dto/create-receita.dto.js';
import {
  PrecoVendaBodyDto,
  type PrecoVendaDto,
} from '../../application/dto/preco-venda.dto.js';
import type { ReceitaCustoDto } from '../../application/dto/receita-custo.dto.js';
import type { ReceitaDto } from '../../application/dto/receita.dto.js';
import {
  type SimulacaoCenarioDto,
  SimularCenarioDto,
} from '../../application/dto/simular-cenario.dto.js';
import { SimularCustoDto } from '../../application/dto/simular-custo.dto.js';
import { UpdateReceitaDto } from '../../application/dto/update-receita.dto.js';
import { ReceitaService } from '../../application/services/receita.service.js';

@ApiTags('receitas')
@ApiBearerAuth()
@Controller('receitas')
export class ReceitasController {
  constructor(private readonly service: ReceitaService) {}

  /** Lista as receitas da empresa, a mais nova primeiro */
  @Get()
  list(@CurrentUser() usuario: UsuarioAutenticado): Promise<ReceitaDto[]> {
    return this.service.list(usuario.empresa.id);
  }

  /** Custo de 1 lote, recalculado com os custos e gastos atuais */
  @Get(':id/custo')
  calcularCusto(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ReceitaCustoDto> {
    return this.service.calcularCusto(id, 1, usuario.empresa.id);
  }

  /** Custo de N lotes, recalculado com os custos e gastos atuais */
  @Post(':id/custo/simular')
  simularCusto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SimularCustoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ReceitaCustoDto> {
    return this.service.calcularCusto(
      id,
      dto.quantidadeLotes,
      usuario.empresa.id,
    );
  }

  /** Simula lucro, margem e break-even (400 sem custo, sem preço ou com preço 0) */
  @Post(':id/simular')
  simular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SimularCenarioDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<SimulacaoCenarioDto> {
    return this.service.simular(id, dto, usuario.empresa.id);
  }

  /** Calcula o preço de venda para uma margem, sem gravar */
  @Post(':id/preco-venda')
  calcularPrecoVenda(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PrecoVendaBodyDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PrecoVendaDto> {
    return this.service.calcularPrecoVenda(id, dto, usuario.empresa.id);
  }

  /** Detalha uma receita com os itens */
  @Get(':id')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ReceitaDto> {
    return this.service.findById(id, usuario.empresa.id);
  }

  /** Cria uma receita e calcula o custo de 1 lote */
  @Post()
  create(
    @Body() dto: CreateReceitaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ReceitaDto> {
    return this.service.create(dto, usuario.empresa.id);
  }

  /** Atualiza uma receita (campos opcionais; `margem_lucro: null` remove a margem) */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReceitaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ReceitaDto> {
    return this.service.update(id, dto, usuario.empresa.id);
  }

  /** Exclui uma receita (409 se usada em produção ou venda) */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.service.delete(id, usuario.empresa.id);
  }
}
