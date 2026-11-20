import { Injectable } from '@nestjs/common';
import type {
  Estoque,
  MovimentacaoEstoque,
  OrigemMovimentacaoEstoque,
  TipoMovimentacaoEstoque,
} from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';

interface EstoqueData {
  empresaId: number;
  insumoId: number;
  quantidadeDisponivel: number;
}

interface MovimentacaoData {
  empresaId: number;
  insumoId: number;
  tipo: TipoMovimentacaoEstoque;
  origem: OrigemMovimentacaoEstoque;
  quantidade: number;
  referenciaId?: number | null;
}

@Injectable()
export class EstoqueRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: EstoqueData, tx?: PrismaTransaction): Promise<Estoque> {
    const db = tx ?? this.prisma;
    return db.estoque.create({ data });
  }

  createMovimentacao(
    data: MovimentacaoData,
    tx?: PrismaTransaction,
  ): Promise<MovimentacaoEstoque> {
    const db = tx ?? this.prisma;
    return db.movimentacaoEstoque.create({ data });
  }

  /** Saldos da empresa; com `insumoIds`, só os desses insumos. */
  listByEmpresa(
    empresaId: number,
    insumoIds?: number[],
    tx?: PrismaTransaction,
  ): Promise<Estoque[]> {
    const db = tx ?? this.prisma;
    return db.estoque.findMany({
      where: { empresaId, ...(insumoIds && { insumoId: { in: insumoIds } }) },
    });
  }
}
