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
  observacao?: string | null;
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

  /** Saldos da empresa (por insumo); com `insumoIds`, só os desses insumos. */
  listByEmpresa(
    empresaId: number,
    insumoIds?: number[],
    tx?: PrismaTransaction,
  ): Promise<Estoque[]> {
    const db = tx ?? this.prisma;
    return db.estoque.findMany({
      where: { empresaId, ...(insumoIds && { insumoId: { in: insumoIds } }) },
      orderBy: { insumoId: 'asc' },
    });
  }

  findByInsumoAndEmpresa(
    insumoId: number,
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<Estoque | null> {
    const db = tx ?? this.prisma;
    return db.estoque.findFirst({ where: { insumoId, empresaId } });
  }

  /**
   * Como `findByInsumoAndEmpresa`, mas trava a linha (`FOR UPDATE`) até o fim
   * da transação: duas movimentações simultâneas do mesmo insumo não perdem
   * uma atualização do saldo. Só tem efeito dentro de `tx`.
   */
  async findByInsumoAndEmpresaForUpdate(
    insumoId: number,
    empresaId: number,
    tx: PrismaTransaction,
  ): Promise<Estoque | null> {
    await tx.$queryRaw`SELECT id FROM estoque WHERE insumo_id = ${insumoId} AND empresa_id = ${empresaId} FOR UPDATE`;
    return tx.estoque.findFirst({ where: { insumoId, empresaId } });
  }

  updateQuantidadeDisponivel(
    id: number,
    quantidadeDisponivel: number,
    tx?: PrismaTransaction,
  ): Promise<Estoque> {
    const db = tx ?? this.prisma;
    return db.estoque.update({ where: { id }, data: { quantidadeDisponivel } });
  }

  updateQuantidadeMinima(
    id: number,
    quantidadeMinima: number,
    tx?: PrismaTransaction,
  ): Promise<Estoque> {
    const db = tx ?? this.prisma;
    return db.estoque.update({ where: { id }, data: { quantidadeMinima } });
  }

  /** Mais recentes primeiro; o id desempata movimentações no mesmo instante. */
  listMovimentacoesByInsumoAndEmpresa(
    insumoId: number,
    empresaId: number,
  ): Promise<MovimentacaoEstoque[]> {
    return this.prisma.movimentacaoEstoque.findMany({
      where: { insumoId, empresaId },
      orderBy: [{ dataMovimentacao: 'desc' }, { id: 'desc' }],
    });
  }
}
