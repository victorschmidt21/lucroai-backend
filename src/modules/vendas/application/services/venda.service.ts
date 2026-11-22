import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { CanalVendaService } from '../../../canais/application/services/canal-venda.service.js';
import { EstoqueProdutoAcabadoService } from '../../../estoque/application/services/estoque-produto-acabado.service.js';
import { GastoIndiretoService } from '../../../gastos-indiretos/application/services/gasto-indireto.service.js';
import {
  type ReceitaComCusto,
  ReceitaService,
} from '../../../receitas/application/services/receita.service.js';
import {
  calcularPercentuaisSemLucro,
  somarGastosMensais,
} from '../../../receitas/domain/receitas.calculos.js';
import { Venda, vendaFinalizada } from '../../domain/venda.entity.js';
import {
  calcularPontoEquilibrioEmpresa,
  DIAS_PONTO_EQUILIBRIO,
  type ItemParaMargem,
  percentuaisSemLucroDaVenda,
} from '../../domain/vendas.calculos.js';
import { VendaRepository } from '../../infra/repositories/venda.repository.js';
import type { CreateVendaDto } from '../dto/create-venda.dto.js';
import type { ListVendasQueryDto } from '../dto/list-vendas-query.dto.js';
import {
  type ResumoVendasDto,
  toResumoVendasDto,
} from '../dto/resumo-vendas.dto.js';
import type { UpdateVendaStatusDto } from '../dto/update-venda-status.dto.js';
import {
  type VendaComItens,
  type VendaDto,
  toVendaDto,
} from '../dto/venda.dto.js';

/** O Balcão, cuja taxa é a da maquininha. */
const BALCAO = { balcao: true, comissaoPercentual: 0 };

@Injectable()
export class VendaService {
  constructor(
    private readonly repository: VendaRepository,
    private readonly receitaService: ReceitaService,
    private readonly canalVendaService: CanalVendaService,
    private readonly estoqueProdutoAcabadoService: EstoqueProdutoAcabadoService,
    private readonly gastoIndiretoService: GastoIndiretoService,
    private readonly transactionManager: TransactionManager,
  ) {}

  /** Mais recentes primeiro (`dataVenda`); datas comparadas como instantes. */
  async list(
    query: ListVendasQueryDto,
    empresaId: number,
  ): Promise<VendaDto[]> {
    const rows = await this.repository.listByEmpresa(empresaId, {
      status: query.status,
      dataInicio: query.dataInicio ? new Date(query.dataInicio) : undefined,
      dataFim: query.dataFim ? new Date(query.dataFim) : undefined,
    });
    return rows.map(toVendaDto);
  }

  /**
   * Resumo do painel (BE-31): ponto de equilíbrio da empresa com o mix das
   * vendas concluídas dos últimos 30 dias. O custo variável de cada receita
   * é o atual (custo médio dos insumos); os percentuais (imposto e taxa do
   * canal) são os gravados na venda, ou os do Balcão nas vendas anteriores à
   * BE-30.
   */
  async resumo(
    empresaId: number,
    agora = new Date(),
  ): Promise<ResumoVendasDto> {
    const dataInicio = new Date(
      agora.getTime() - DIAS_PONTO_EQUILIBRIO * 24 * 60 * 60 * 1000,
    );
    const vendas = await this.repository.listByEmpresa(empresaId, {
      status: 'CONCLUIDA',
      dataInicio,
    });
    const receitas = new Map<number, ReceitaComCusto>();
    const itens: ItemParaMargem[] = [];
    for (const item of vendas.flatMap((venda) => venda.itens)) {
      let receita = receitas.get(item.receitaId);
      if (!receita) {
        receita = await this.receitaService.buscarDaEmpresa(
          item.receitaId,
          empresaId,
        );
        receitas.set(item.receitaId, receita);
      }
      itens.push({
        quantidade: item.quantidade,
        precoUnitarioReal: item.precoUnitarioReal,
        custoSemGastosMensais: receita.custo.detalhe.custoSemGastosMensais,
        percentuaisSemLucro:
          percentuaisSemLucroDaVenda(item) ??
          calcularPercentuaisSemLucro(BALCAO, receita.basePreco),
      });
    }
    const gastos = await this.gastoIndiretoService.listarPorEmpresa(empresaId);
    return toResumoVendasDto(
      calcularPontoEquilibrioEmpresa(somarGastosMensais(gastos), itens),
      { dias: DIAS_PONTO_EQUILIBRIO, dataInicio, vendas: vendas.length },
    );
  }

  async findById(id: number, empresaId: number): Promise<VendaDto> {
    return toVendaDto(await this.getOrFail(id, empresaId));
  }

  /**
   * Registra a venda `PENDENTE` no canal informado (Balcão se omitido, BE-30),
   * com o custo unitário de cada receita ao custo médio dos insumos copiado na
   * hora e o lucro real de cada item. Receita ou canal de outra empresa → 404
   * (lacuna 26). Não confere o estoque (lacuna 24): a barreira é a conclusão.
   */
  async create(dto: CreateVendaDto, empresaId: number): Promise<VendaDto> {
    const canal = await this.canalVendaService.buscarParaVenda(
      dto.canal_id,
      empresaId,
    );
    const receitas = new Map<number, ReceitaComCusto>();
    for (const item of dto.itens) {
      if (receitas.has(item.receita_id)) continue;
      receitas.set(
        item.receita_id,
        await this.receitaService.buscarDaEmpresa(item.receita_id, empresaId),
      );
    }
    // Imposto, maquininha e gastos percentuais são da empresa, iguais em
    // todas as receitas; o lucro da receita não entra.
    const [primeira] = receitas.values();
    const nova = Venda.nova(
      empresaId,
      dto.itens.map((item) => ({
        receitaId: item.receita_id,
        quantidade: item.quantidade,
        precoUnitarioReal: item.preco_unitario_real,
        custoUnitario:
          receitas.get(item.receita_id)?.custo.custoUnitario ?? null,
      })),
      {
        canalId: canal.id,
        // Sem itens não há receita; `Venda.nova` responde 400.
        percentuaisSemLucro: primeira
          ? calcularPercentuaisSemLucro(canal, primeira.basePreco)
          : 0,
      },
    );
    return toVendaDto(await this.repository.create(nova));
  }

  /**
   * Só `PENDENTE` muda (regra na entidade). Concluir dá baixa de cada item no
   * produto acabado na mesma transação (BE-13, lacuna 9): sem saldo → 422
   * `ESTOQUE_INSUFICIENTE`, o rollback desfaz tudo e a venda continua
   * `PENDENTE`.
   */
  atualizarStatus(
    id: number,
    dto: UpdateVendaStatusDto,
    empresaId: number,
  ): Promise<VendaDto> {
    return this.transactionManager.run(async (tx) => {
      const row = await this.getOrFail(id, empresaId, tx);
      const venda = Venda.restaurar(row);
      venda.alterarStatus(dto.status);

      const mudou = await this.repository.updateStatusSePendente(
        id,
        empresaId,
        venda.status,
        tx,
      );
      // Outra requisição finalizou a venda entre a leitura e a escrita.
      if (!mudou) throw vendaFinalizada();

      if (venda.status === 'CONCLUIDA') {
        for (const item of row.itens) {
          await this.estoqueProdutoAcabadoService.saidaPorVenda(
            item.receitaId,
            item.quantidade,
            id,
            empresaId,
            tx,
          );
        }
      }
      return toVendaDto({ ...row, status: venda.status });
    });
  }

  private async getOrFail(
    id: number,
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<VendaComItens> {
    const row = await this.repository.findByIdAndEmpresa(id, empresaId, tx);
    if (!row) {
      throw new NotFoundError('VENDA_NAO_ENCONTRADA', 'Venda não encontrada');
    }
    return row;
  }
}
