import { Injectable } from '@nestjs/common';
import { InsumoService } from '../../../insumos/application/services/insumo.service.js';
import { precoDefasado } from '../../../insumos/domain/insumos.calculos.js';
import { ReceitaService } from '../../../receitas/application/services/receita.service.js';
import {
  alertasDeEstoqueNegativo,
  alertasDePrecoDefasado,
} from '../../domain/alertas.calculos.js';
import { type AlertasDto, toAlertasDto } from '../dto/alertas.dto.js';

/** Avisos para mostrar ao entrar (BE-32). Só lê; não tem tabela. */
@Injectable()
export class AlertaService {
  constructor(
    private readonly insumoService: InsumoService,
    private readonly receitaService: ReceitaService,
  ) {}

  async listar(empresaId: number): Promise<AlertasDto> {
    const insumos = await this.insumoService.listarComSaldo(empresaId);
    // Só calcula o preço das receitas quando há insumo defasado.
    const receitas = insumos.some(precoDefasado)
      ? await this.receitaService.listarPrecosSugeridos(empresaId)
      : [];
    return toAlertasDto(
      alertasDeEstoqueNegativo(insumos),
      alertasDePrecoDefasado(insumos, receitas),
    );
  }
}
