import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { ConfiguracaoCustosService } from '../../../configuracao-custos/application/services/configuracao-custos.service.js';
import { EstoqueProdutoAcabadoService } from '../../../estoque/application/services/estoque-produto-acabado.service.js';
import { EstoqueService } from '../../../estoque/application/services/estoque.service.js';
import { GastoIndiretoService } from '../../../gastos-indiretos/application/services/gasto-indireto.service.js';
import { ReceitaService } from '../../../receitas/application/services/receita.service.js';
import {
  calcularProducao,
  calcularReceitasUsadas,
} from '../../domain/producoes.calculos.js';
import { ProducaoRepository } from '../../infra/repositories/producao.repository.js';
import type { EstoqueProntoDto } from '../dto/estoque-pronto.dto.js';
import type { CreateProducaoDto } from '../dto/create-producao.dto.js';
import type { ListProducoesQueryDto } from '../dto/list-producoes-query.dto.js';
import { type ProducaoDto, toProducaoDto } from '../dto/producao.dto.js';

@Injectable()
export class ProducaoService {
  constructor(
    private readonly repository: ProducaoRepository,
    private readonly receitaService: ReceitaService,
    private readonly gastoIndiretoService: GastoIndiretoService,
    private readonly configuracaoCustosService: ConfiguracaoCustosService,
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

  /**
   * Estoque pronto da empresa (BE-12) com o `vendavel` da receita (BE-41).
   * Só as receitas que já tiveram movimentação.
   */
  async listarEstoquePronto(empresaId: number): Promise<EstoqueProntoDto[]> {
    const saldos = await this.estoqueProdutoAcabadoService.list(empresaId);
    const receitas = await this.receitaService.listarResumos(empresaId);
    const vendavel = new Map(receitas.map((r) => [r.id, r.vendavel]));
    return saldos.map((saldo) => ({
      receitaId: saldo.receitaId,
      quantidadeDisponivel: saldo.quantidadeDisponivel,
      estoqueNegativo: saldo.estoqueNegativo,
      vendavel: vendavel.get(saldo.receitaId) ?? true,
      dataAlteracao: saldo.dataAlteracao,
    }));
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
   * Numa transação só (BE-12): grava a produção e os rateios dos gastos
   * mensais (BE-30: ingredientes ao custo médio + forno, uma vez só), dá baixa
   * nos insumos (saldo negativo aceito, lacuna 10) e dá entrada no produto
   * acabado. Receita e gastos de outra empresa → 404 (lacuna 11).
   *
   * BE-41: cada receita usada dentro desta sai do estoque pronto dela
   * (`quantidade × lotes`, saldo negativo aceito). O custo dela já está no
   * `ingredientesLote` (ingredientes ao custo médio + forno + perda, BE-40),
   * calculado na hora; a produção não rateia de novo o forno dela.
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
      const configuracao = await this.configuracaoCustosService.buscarDaEmpresa(
        empresaId,
        tx,
      );
      const calculo = calcularProducao(
        {
          rendimento: receita.rendimento,
          // Ao custo médio dos insumos (BE-30), sem os gastos da receita.
          ingredientesLote: receita.custo.detalhe.ingredientesLote,
          usoPorLote: receita.usoPorLote,
        },
        dto.quantidade,
        gastos,
        configuracao.capacidadeMensal,
      );
      const receitasUsadas = calcularReceitasUsadas(
        receita.receitasUsadas.map((item) => ({
          receitaId: item.receitaUsadaId,
          nome: item.receitaUsada.nome,
          quantidade: item.quantidade,
          unidade: item.receitaUsada.unidadeRendimento,
        })),
        dto.quantidade,
      );

      const producao = await this.repository.create(
        {
          empresaId,
          receitaId: receita.id,
          quantidade: dto.quantidade,
          ...calculo,
          receitasUsadas,
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
      for (const usada of receitasUsadas) {
        await this.estoqueProdutoAcabadoService.saidaPorProducao(
          usada.receitaId,
          usada.quantidade,
          producao.id,
          empresaId,
          tx,
        );
      }
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
