import { Injectable } from '@nestjs/common';
import type { CompraInsumo } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';

interface CompraInsumoData {
  empresaId: number;
  insumoId: number;
  quantidade: number;
  valorTotal: number;
  custoUnitario: number;
  observacao: string | null;
}

/** A compra é imutável (BE-29): só cria e lista. */
@Injectable()
export class CompraInsumoRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: CompraInsumoData,
    tx?: PrismaTransaction,
  ): Promise<CompraInsumo> {
    const db = tx ?? this.prisma;
    return db.compraInsumo.create({ data });
  }

  /** Mais recentes primeiro; o id desempata compras no mesmo instante. */
  listByInsumoAndEmpresa(
    insumoId: number,
    empresaId: number,
  ): Promise<CompraInsumo[]> {
    return this.prisma.compraInsumo.findMany({
      where: { insumoId, empresaId },
      orderBy: [{ dataCompra: 'desc' }, { id: 'desc' }],
    });
  }
}
