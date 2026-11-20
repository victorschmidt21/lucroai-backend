import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { EstoqueProdutoAcabadoService } from '../../../estoque/application/services/estoque-produto-acabado.service.js';
import { EstoqueService } from '../../../estoque/application/services/estoque.service.js';
import { GastoIndiretoService } from '../../../gastos-indiretos/application/services/gasto-indireto.service.js';
import { ReceitaService } from '../../../receitas/application/services/receita.service.js';
import { calcularProducao } from '../../domain/producoes.calculos.js';
import { ProducaoRepository } from '../../infra/repositories/producao.repository.js';
import type { CreateProducaoDto } from '../dto/create-producao.dto.js';
import type { ListProducoesQueryDto } from '../dto/list-producoes-query.dto.js';
import { type ProducaoDto, toProducaoDto } from '../dto/producao.dto.js';

@Injectable()
export class ProducaoService {
  constructor(
    private readonly repository: ProducaoRepository,
    private readonly receitaService: ReceitaService,
    private readonly gastoIndiretoService: GastoIndiretoService,
    private readonly estoqueService: EstoqueService,
    private readonly estoqueProdutoAcabadoService: EstoqueProdutoAcabadoService,
    private readonly transactionManager: TransactionManager,
  ) {}

  /** Mais recentes primeiro (`dataProducao`). */
  async list(
    query: ListProducoesQueryDto,
    empresaId: number,
  ): Promise<ProducaoDto[]> {
    const rows = await this.repository.listByEmpresa(
      empresaId,
      query.receitaId,
    );
    return rows.map(toProducaoDto);
  }

  async findById(id: number, empresaId: number): Promise<ProducaoDto> {
    const row = await this.repository.findByIdAndEmpresa(id, empresaId);
    if (!row) {
      throw new NotFoundError(
        'PRODUCAO_NAO_ENCONTRADA',
        'Produção não encontrada',
      );
    }
    return toProducaoDto(row);
  }

  /**
   * Numa transação só (BE-12): grava a produção e os rateios, dá baixa nos
   * insumos (saldo negativo aceito, lacuna 10) e dá entrada no produto
   * acabado. Receita e gastos de outra empresa → 404 (lacuna 11).
   */
  create(dto: CreateProducaoDto, empresaId: number): Promise<ProducaoDto> {
    return this.transactionManager.run(async (tx) => {
      const receita = await this.receitaService.buscarDaEmpresa(
        dto.receita_id,
        empresaId,
        tx,
      );
      // Omitido → todos os gastos da empresa; `[]` → nenhum.
      const gastos = dto.gasto_indireto_ids
        ? await this.gastoIndiretoService.buscarVariosDaEmpresa(
            dto.gasto_indireto_ids,
            empresaId,
            tx,
          )
        : await this.gastoIndiretoService.listarPorEmpresa(empresaId, tx);
      const calculo = calcularProducao(receita, dto.quantidade, gastos);

      const producao = await this.repository.create(
        {
          empresaId,
          receitaId: receita.id,
          quantidade: dto.quantidade,
          ...calculo,
        },
        tx,
      );
      await this.estoqueService.baixarPorProducao(
        receita.itens,
        dto.quantidade,
        producao.id,
        empresaId,
        tx,
      );
      await this.estoqueProdutoAcabadoService.entradaPorProducao(
        receita.id,
        calculo.totalUnidades,
        producao.id,
        empresaId,
        tx,
      );
      return toProducaoDto(producao);
    });
  }
}
