import { Injectable } from '@nestjs/common';
import type {
  EstoqueProdutoAcabado,
  MovimentacaoProdutoAcabado,
  OrigemMovimentacaoProdutoAcabado,
  TipoMovimentacaoEstoque,
} from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';

interface MovimentacaoProdutoData {
  empresaId: number;
  receitaId: number;
  tipo: TipoMovimentacaoEstoque;
  origem: OrigemMovimentacaoProdutoAcabado;
  quantidade: number;
  referenciaId: number;
}

@Injectable()
export class EstoqueProdutoAcabadoRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByEmpresa(empresaId: number): Promise<EstoqueProdutoAcabado[]> {
    return this.prisma.estoqueProdutoAcabado.findMany({
      where: { empresaId },
      orderBy: { receitaId: 'asc' },
    });
  }

  /**
   * Cria o saldo zerado da receita se ainda não existir (`ON CONFLICT DO
   * NOTHING`, seguro com produções simultâneas) e devolve a linha travada
   * (`FOR UPDATE`) até o fim da transação.
   */
  async findOrCreateForUpdate(
    receitaId: number,
    empresaId: number,
    tx: PrismaTransaction,
  ): Promise<EstoqueProdutoAcabado | null> {
    await tx.estoqueProdutoAcabado.createMany({
      data: [{ receitaId, empresaId, quantidadeDisponivel: 0 }],
      skipDuplicates: true,
    });
    return this.findByReceitaAndEmpresaForUpdate(receitaId, empresaId, tx);
  }

  /** Trava a linha (`FOR UPDATE`) até o fim da transação; `null` se não existir. */
  async findByReceitaAndEmpresaForUpdate(
    receitaId: number,
    empresaId: number,
    tx: PrismaTransaction,
  ): Promise<EstoqueProdutoAcabado | null> {
    await tx.$queryRaw`SELECT id FROM estoque_produto_acabado WHERE receita_id = ${receitaId} AND empresa_id = ${empresaId} FOR UPDATE`;
    return tx.estoqueProdutoAcabado.findFirst({
      where: { receitaId, empresaId },
    });
  }

  updateQuantidadeDisponivel(
    id: number,
    quantidadeDisponivel: number,
    tx: PrismaTransaction,
  ): Promise<EstoqueProdutoAcabado> {
    return tx.estoqueProdutoAcabado.update({
      where: { id },
      data: { quantidadeDisponivel },
    });
  }

  createMovimentacao(
    data: MovimentacaoProdutoData,
    tx: PrismaTransaction,
  ): Promise<MovimentacaoProdutoAcabado> {
    return tx.movimentacaoProdutoAcabado.create({ data });
  }
}
