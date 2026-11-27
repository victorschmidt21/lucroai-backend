import { Injectable } from '@nestjs/common';
import { ConfiguracaoCustosService } from '../../../configuracao-custos/application/services/configuracao-custos.service.js';
import { EstoqueProdutoAcabadoService } from '../../../estoque/application/services/estoque-produto-acabado.service.js';
import { InsumoService } from '../../../insumos/application/services/insumo.service.js';
import { precoDefasado } from '../../../insumos/domain/insumos.calculos.js';
import { ReceitaService } from '../../../receitas/application/services/receita.service.js';
import {
  alertasDeEstoqueNegativo,
  alertasDePrecoDefasado,
  alertasDeProdutoNegativo,
  valorHoraVazio,
} from '../../domain/alertas.calculos.js';
import { type AlertasDto, toAlertasDto } from '../dto/alertas.dto.js';

/**
 * Avisos para mostrar ao entrar (BE-32; produtos negativos desde a BE-41;
 * valor da hora vazio desde a BE-47).
 * Só lê; não tem tabela.
 */
@Injectable()
export class AlertaService {
  constructor(
    private readonly insumoService: InsumoService,
    private readonly receitaService: ReceitaService,
    private readonly estoqueProdutoAcabadoService: EstoqueProdutoAcabadoService,
    private readonly configuracaoCustosService: ConfiguracaoCustosService,
  ) {}

  async listar(empresaId: number): Promise<AlertasDto> {
    const insumos = await this.insumoService.listarComSaldo(empresaId);
    // Só calcula o preço das receitas quando há insumo defasado.
    const receitas = insumos.some(precoDefasado)
      ? await this.receitaService.listarPrecosSugeridos(empresaId)
      : [];
    const estoquesProntos =
      await this.estoqueProdutoAcabadoService.list(empresaId);
    const { valorHora } =
      await this.configuracaoCustosService.buscarDaEmpresa(empresaId);
    // Os resumos (sem custo) servem aos produtos negativos e ao valor da hora.
    const resumos =
      valorHora <= 0 || estoquesProntos.some((e) => e.estoqueNegativo)
        ? await this.receitaService.listarResumos(empresaId)
        : [];
    return toAlertasDto(
      alertasDeEstoqueNegativo(insumos),
      alertasDePrecoDefasado(insumos, receitas),
      alertasDeProdutoNegativo(estoquesProntos, resumos),
      valorHoraVazio(valorHora, resumos),
    );
  }
}
