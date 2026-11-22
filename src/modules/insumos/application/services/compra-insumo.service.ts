import { Injectable } from '@nestjs/common';
import type { Insumo } from '../../../../generated/prisma/client.js';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { EstoqueService } from '../../../estoque/application/services/estoque.service.js';
import {
  calcularCustoMedio,
  calcularCustoUnitario,
} from '../../domain/insumos.calculos.js';
import { CompraInsumoRepository } from '../../infra/repositories/compra-insumo.repository.js';
import { InsumoRepository } from '../../infra/repositories/insumo.repository.js';
import {
  type CompraInsumoDto,
  toCompraInsumoDto,
} from '../dto/compra-insumo.dto.js';
import type { CreateCompraInsumoDto } from '../dto/create-compra-insumo.dto.js';

/** Compras de insumo (BE-29): entrada no estoque e custo médio móvel. */
@Injectable()
export class CompraInsumoService {
  constructor(
    private readonly repository: CompraInsumoRepository,
    private readonly insumoRepository: InsumoRepository,
    private readonly estoqueService: EstoqueService,
    private readonly transactionManager: TransactionManager,
  ) {}

  /** Mais recentes primeiro. */
  async list(insumoId: number, empresaId: number): Promise<CompraInsumoDto[]> {
    await this.getInsumoOrFail(insumoId, empresaId);
    const rows = await this.repository.listByInsumoAndEmpresa(
      insumoId,
      empresaId,
    );
    return rows.map(toCompraInsumoDto);
  }

  /**
   * Numa transação só: grava a compra, dá entrada no estoque (que trava o
   * saldo) e atualiza o insumo. O insumo é lido de novo **depois** da trava,
   * para uma compra simultânea não ponderar um médio velho. A compra vira o
   * último custo e o preço de referência (`valorPago` por
   * `quantidadeBaseCusto`), e limpa o preço de mercado: ela é a informação
   * de preço mais nova.
   */
  async registrar(
    insumoId: number,
    dto: CreateCompraInsumoDto,
    empresaId: number,
  ): Promise<CompraInsumoDto> {
    await this.getInsumoOrFail(insumoId, empresaId);
    const custoCompra = calcularCustoUnitario(dto.valorTotal, dto.quantidade);
    return this.transactionManager.run(async (tx) => {
      const compra = await this.repository.create(
        {
          empresaId,
          insumoId,
          quantidade: dto.quantidade,
          valorTotal: dto.valorTotal,
          custoUnitario: custoCompra,
          observacao: dto.observacao ?? null,
        },
        tx,
      );
      const { saldoAnterior } =
        await this.estoqueService.registrarEntradaPorCompra(
          insumoId,
          dto.quantidade,
          compra.id,
          compra.observacao,
          empresaId,
          tx,
        );
      const insumo = await this.getInsumoOrFail(insumoId, empresaId, tx);
      await this.insumoRepository.update(
        insumoId,
        {
          custoMedio: calcularCustoMedio(
            saldoAnterior,
            insumo.custoMedio,
            dto.quantidade,
            custoCompra,
          ),
          ultimoCusto: custoCompra,
          valorPago: dto.valorTotal,
          quantidadeBaseCusto: dto.quantidade,
          precoMercado: null,
          precoMercadoData: null,
        },
        tx,
      );
      return toCompraInsumoDto(compra);
    });
  }

  private async getInsumoOrFail(
    insumoId: number,
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<Insumo> {
    const row = await this.insumoRepository.findByIdAndEmpresa(
      insumoId,
      empresaId,
      tx,
    );
    if (!row) {
      throw new NotFoundError('INSUMO_NAO_ENCONTRADO', 'Insumo não encontrado');
    }
    return row;
  }
}
