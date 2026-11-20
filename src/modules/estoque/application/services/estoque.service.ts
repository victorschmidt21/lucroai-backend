import { Injectable } from '@nestjs/common';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { EstoqueRepository } from '../../infra/repositories/estoque.repository.js';
import type { SaldoInsumo } from '../dto/saldo-insumo.dto.js';

@Injectable()
export class EstoqueService {
  constructor(private readonly repository: EstoqueRepository) {}

  /**
   * Para o módulo insumos, na transação que cria o insumo: cria o saldo e,
   * com quantidade maior que 0, uma movimentação ENTRADA/COMPRA. Substitui o
   * evento `insumo-criado` dos microsserviços.
   */
  async criarRegistroInicial(
    insumoId: number,
    empresaId: number,
    quantidade: number,
    tx: PrismaTransaction,
  ): Promise<SaldoInsumo> {
    const estoque = await this.repository.create(
      { empresaId, insumoId, quantidadeDisponivel: quantidade },
      tx,
    );
    if (quantidade > 0) {
      await this.repository.createMovimentacao(
        {
          empresaId,
          insumoId,
          tipo: 'ENTRADA',
          origem: 'COMPRA',
          quantidade,
        },
        tx,
      );
    }
    return {
      quantidadeDisponivel: estoque.quantidadeDisponivel,
      quantidadeMinima: estoque.quantidadeMinima,
    };
  }

  /**
   * Para o módulo insumos: saldo e mínimo por id de insumo, só da empresa.
   * Com `insumoIds`, busca só esses insumos.
   */
  async saldosPorInsumo(
    empresaId: number,
    insumoIds?: number[],
    tx?: PrismaTransaction,
  ): Promise<Map<number, SaldoInsumo>> {
    const rows = await this.repository.listByEmpresa(empresaId, insumoIds, tx);
    return new Map(
      rows.map((row) => [
        row.insumoId,
        {
          quantidadeDisponivel: row.quantidadeDisponivel,
          quantidadeMinima: row.quantidadeMinima,
        },
      ]),
    );
  }
}
