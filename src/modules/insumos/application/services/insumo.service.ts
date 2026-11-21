import { Injectable } from '@nestjs/common';
import type { Insumo } from '../../../../generated/prisma/client.js';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { EstoqueService } from '../../../estoque/application/services/estoque.service.js';
import { calcularCustoUnitario } from '../../domain/insumos.calculos.js';
import { InsumoRepository } from '../../infra/repositories/insumo.repository.js';
import type { CreateInsumoDto } from '../dto/create-insumo.dto.js';
import { type InsumoDto, toInsumoDto } from '../dto/insumo.dto.js';
import type { UpdateInsumoDto } from '../dto/update-insumo.dto.js';

@Injectable()
export class InsumoService {
  constructor(
    private readonly repository: InsumoRepository,
    private readonly estoqueService: EstoqueService,
    private readonly transactionManager: TransactionManager,
  ) {}

  /** Ordenados por nome, sem paginação. */
  async list(empresaId: number): Promise<InsumoDto[]> {
    const [rows, saldos] = await Promise.all([
      this.repository.listByEmpresa(empresaId),
      this.estoqueService.saldosPorInsumo(empresaId),
    ]);
    return rows.map((row) => toInsumoDto(row, saldos.get(row.id)));
  }

  async findById(id: number, empresaId: number): Promise<InsumoDto> {
    return this.comSaldo(await this.getOrFail(id, empresaId));
  }

  /** Cria o insumo e o estoque inicial na mesma transação. */
  async create(dto: CreateInsumoDto, empresaId: number): Promise<InsumoDto> {
    return this.transactionManager.run(async (tx) => {
      const row = await this.repository.create(
        empresaId,
        {
          nome: dto.nome,
          quantidadeBaseCusto: dto.quantidadeBaseCusto,
          unidade: dto.unidade,
          valorPago: dto.valorPago,
          custoUnitario: calcularCustoUnitario(
            dto.valorPago,
            dto.quantidadeBaseCusto,
          ),
        },
        tx,
      );
      const saldo = await this.estoqueService.criarRegistroInicial(
        row.id,
        empresaId,
        dto.quantidadeDisponivelInicial ?? 0,
        tx,
      );
      return toInsumoDto(row, saldo);
    });
  }

  /** Campo omitido mantém o valor salvo; o custo unitário é recalculado. */
  async update(
    id: number,
    dto: UpdateInsumoDto,
    empresaId: number,
  ): Promise<InsumoDto> {
    const atual = await this.getOrFail(id, empresaId);
    const valorPago = dto.valorPago ?? atual.valorPago;
    const quantidadeBaseCusto =
      dto.quantidadeBaseCusto ?? atual.quantidadeBaseCusto;
    const row = await this.repository.update(id, {
      nome: dto.nome,
      unidade: dto.unidade,
      valorPago,
      quantidadeBaseCusto,
      custoUnitario: calcularCustoUnitario(valorPago, quantidadeBaseCusto),
    });
    return this.comSaldo(row);
  }

  async delete(id: number, empresaId: number): Promise<void> {
    await this.getOrFail(id, empresaId);
    await this.repository.delete(id);
  }

  /**
   * Para outros módulos (receitas): os insumos dos ids informados, ignorando
   * repetidos. 404 se algum não existir ou for de outra empresa. Devolve o
   * custo unitário salvo **sem arredondar** (não o `InsumoDto`, que tem 6
   * casas), porque ele entra no custo da receita (BE-23).
   */
  async buscarVariosDaEmpresa(
    ids: number[],
    empresaId: number,
  ): Promise<Insumo[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return [];
    const rows = await this.repository.listByIdsAndEmpresa(unicos, empresaId);
    if (rows.length !== unicos.length) {
      throw new NotFoundError('INSUMO_NAO_ENCONTRADO', 'Insumo não encontrado');
    }
    return rows;
  }

  private async comSaldo(row: Insumo): Promise<InsumoDto> {
    const saldos = await this.estoqueService.saldosPorInsumo(row.empresaId, [
      row.id,
    ]);
    return toInsumoDto(row, saldos.get(row.id));
  }

  private async getOrFail(id: number, empresaId: number): Promise<Insumo> {
    const row = await this.repository.findByIdAndEmpresa(id, empresaId);
    if (!row) {
      throw new NotFoundError('INSUMO_NAO_ENCONTRADO', 'Insumo não encontrado');
    }
    return row;
  }
}
