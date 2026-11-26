import { Injectable } from '@nestjs/common';
import { EstoqueProdutoAcabadoService } from '../../../estoque/application/services/estoque-produto-acabado.service.js';
import { InsumoService } from '../../../insumos/application/services/insumo.service.js';
import { precoDefasado } from '../../../insumos/domain/insumos.calculos.js';
import { ReceitaService } from '../../../receitas/application/services/receita.service.js';
import {
  alertasDeEstoqueNegativo,
  alertasDePrecoDefasado,
  alertasDeProdutoNegativo,
} from '../../domain/alertas.calculos.js';
import { type AlertasDto, toAlertasDto } from '../dto/alertas.dto.js';

/**
 * Avisos para mostrar ao entrar (BE-32; produtos negativos desde a BE-41).
 * Só lê; não tem tabela.
 */
@Injectable()
export class AlertaService {
  constructor(
    private readonly insumoService: InsumoService,
    private readonly receitaService: ReceitaService,
    private readonly estoqueProdutoAcabadoService: EstoqueProdutoAcabadoService,
  ) {}

  async listar(empresaId: number): Promise<AlertasDto> {
    const insumos = await this.insumoService.listarComSaldo(empresaId);
    // Só calcula o preço das receitas quando há insumo defasado.
    const receitas = insumos.some(precoDefasado)
      ? await this.receitaService.listarPrecosSugeridos(empresaId)
      : [];
    const estoquesProntos =
      await this.estoqueProdutoAcabadoService.list(empresaId);
    // Só busca os nomes das receitas quando há estoque pronto negativo.
    const resumos = estoquesProntos.some((e) => e.estoqueNegativo)
      ? await this.receitaService.listarResumos(empresaId)
      : [];
    return toAlertasDto(
      alertasDeEstoqueNegativo(insumos),
      alertasDePrecoDefasado(insumos, receitas),
      alertasDeProdutoNegativo(estoquesProntos, resumos),
    );
  }
}
