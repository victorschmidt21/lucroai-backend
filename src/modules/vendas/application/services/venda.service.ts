import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { EstoqueProdutoAcabadoService } from '../../../estoque/application/services/estoque-produto-acabado.service.js';
import { ReceitaService } from '../../../receitas/application/services/receita.service.js';
import { Venda, vendaFinalizada } from '../../domain/venda.entity.js';
import { VendaRepository } from '../../infra/repositories/venda.repository.js';
import type { CreateVendaDto } from '../dto/create-venda.dto.js';
import type { ListVendasQueryDto } from '../dto/list-vendas-query.dto.js';
import type { UpdateVendaStatusDto } from '../dto/update-venda-status.dto.js';
import {
  type VendaComItens,
  type VendaDto,
  toVendaDto,
} from '../dto/venda.dto.js';

@Injectable()
export class VendaService {
  constructor(
    private readonly repository: VendaRepository,
    private readonly receitaService: ReceitaService,
    private readonly estoqueProdutoAcabadoService: EstoqueProdutoAcabadoService,
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

  async findById(id: number, empresaId: number): Promise<VendaDto> {
    return toVendaDto(await this.getOrFail(id, empresaId));
  }

  /**
   * Registra a venda `PENDENTE` com o custo unitário salvo de cada receita
   * copiado na hora. Receita de outra empresa → 404 (lacuna 26). Não confere
   * o estoque (lacuna 24): a barreira é a conclusão.
   */
  async create(dto: CreateVendaDto, empresaId: number): Promise<VendaDto> {
    const custos = new Map<number, number | null>();
    for (const item of dto.itens) {
      if (custos.has(item.receita_id)) continue;
      const receita = await this.receitaService.buscarDaEmpresa(
        item.receita_id,
        empresaId,
      );
      custos.set(item.receita_id, receita.custoUnitario ?? null);
    }
    const nova = Venda.nova(
      empresaId,
      dto.itens.map((item) => ({
        receitaId: item.receita_id,
        quantidade: item.quantidade,
        precoUnitarioReal: item.preco_unitario_real,
        custoUnitario: custos.get(item.receita_id) ?? null,
      })),
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
