import { Injectable } from '@nestjs/common';
import type { Insumo } from '../../../../generated/prisma/client.js';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { EstoqueService } from '../../../estoque/application/services/estoque.service.js';
import {
  calcularCustoUnitario,
  resolverPrecoMercado,
} from '../../domain/insumos.calculos.js';
import { CompraInsumoRepository } from '../../infra/repositories/compra-insumo.repository.js';
import { InsumoRepository } from '../../infra/repositories/insumo.repository.js';
import type { CreateInsumoDto } from '../dto/create-insumo.dto.js';
import { type InsumoDto, toInsumoDto } from '../dto/insumo.dto.js';
import type { UpdateInsumoDto } from '../dto/update-insumo.dto.js';

@Injectable()
export class InsumoService {
  constructor(
    private readonly repository: InsumoRepository,
    private readonly compraRepository: CompraInsumoRepository,
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

  /**
   * Cria o insumo, a compra inicial e o estoque inicial na mesma transação
   * (BE-29). O custo informado (`valorPago / quantidadeBaseCusto`) vira o
   * médio, o último e a reposição; a compra inicial tem o saldo inicial como
   * quantidade (0 quando omitido) e guarda esse custo.
   */
  async create(dto: CreateInsumoDto, empresaId: number): Promise<InsumoDto> {
    const custo = calcularCustoUnitario(dto.valorPago, dto.quantidadeBaseCusto);
    const quantidade = dto.quantidadeDisponivelInicial ?? 0;
    return this.transactionManager.run(async (tx) => {
      const row = await this.repository.create(
        empresaId,
        {
          nome: dto.nome,
          quantidadeBaseCusto: dto.quantidadeBaseCusto,
          unidade: dto.unidade,
          valorPago: dto.valorPago,
          custoMedio: custo,
          ultimoCusto: custo,
          precoMercado: null,
          precoMercadoData: null,
        },
        tx,
      );
      const compra = await this.compraRepository.create(
        {
          empresaId,
          insumoId: row.id,
          quantidade,
          valorTotal: quantidade * custo,
          custoUnitario: custo,
          observacao: 'Cadastro do insumo',
        },
        tx,
      );
      const saldo = await this.estoqueService.criarRegistroInicial(
        row.id,
        empresaId,
        quantidade,
        tx,
        compra.id,
      );
      return toInsumoDto(row, saldo);
    });
  }

  /**
   * Campo omitido mantém o valor salvo. O custo médio e o último custo só
   * mudam por compra; mudar o preço aqui muda o preço de mercado
   * (`resolverPrecoMercado`, BE-29), e com ele a reposição.
   */
  async update(
    id: number,
    dto: UpdateInsumoDto,
    empresaId: number,
  ): Promise<InsumoDto> {
    const atual = await this.getOrFail(id, empresaId);
    const precoMercado = resolverPrecoMercado(atual, dto);
    const row = await this.repository.update(id, {
      nome: dto.nome,
      unidade: dto.unidade,
      valorPago: dto.valorPago,
      quantidadeBaseCusto: dto.quantidadeBaseCusto,
      ...(precoMercado !== undefined && {
        precoMercado,
        precoMercadoData: precoMercado === null ? null : new Date(),
      }),
    });
    return this.comSaldo(row);
  }

  async delete(id: number, empresaId: number): Promise<void> {
    await this.getOrFail(id, empresaId);
    await this.repository.delete(id);
  }

  /**
   * Para outros módulos (receitas): os insumos dos ids informados, ignorando
   * repetidos. 404 se algum não existir ou for de outra empresa. Devolve os
   * custos salvos **sem arredondar** (não o `InsumoDto`, que tem 6 casas),
   * porque eles entram no custo da receita (BE-23): o preço usa a reposição
   * (`calcularCustoReposicao`, BE-29).
   */
  async buscarVariosDaEmpresa(
    ids: number[],
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<Insumo[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return [];
    const rows = await this.repository.listByIdsAndEmpresa(
      unicos,
      empresaId,
      tx,
    );
    if (rows.length !== unicos.length) {
      throw new NotFoundError('INSUMO_NAO_ENCONTRADO', 'Insumo não encontrado');
    }
    return rows;
  }

  /**
   * Para o módulo alertas (BE-32): os insumos da empresa, por nome, com o
   * saldo do estoque (0 sem registro) e os custos salvos **sem arredondar**.
   */
  async listarComSaldo(
    empresaId: number,
  ): Promise<(Insumo & { quantidadeDisponivel: number })[]> {
    const [rows, saldos] = await Promise.all([
      this.repository.listByEmpresa(empresaId),
      this.estoqueService.saldosPorInsumo(empresaId),
    ]);
    return rows.map((row) => ({
      ...row,
      quantidadeDisponivel: saldos.get(row.id)?.quantidadeDisponivel ?? 0,
    }));
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
