import { Injectable } from '@nestjs/common';
import type {
  GastoIndireto,
  TipoGasto,
} from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';

interface GastoIndiretoData {
  descricao: string;
  valor: number;
  tipo: TipoGasto;
}

@Injectable()
export class GastoIndiretoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** O mais novo primeiro, como o catalog-service. */
  listByEmpresa(
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<GastoIndireto[]> {
    const db = tx ?? this.prisma;
    return db.gastoIndireto.findMany({
      where: { empresaId },
      orderBy: { id: 'desc' },
    });
  }

  findByIdAndEmpresa(
    id: number,
    empresaId: number,
  ): Promise<GastoIndireto | null> {
    return this.prisma.gastoIndireto.findFirst({ where: { id, empresaId } });
  }

  listByIdsAndEmpresa(
    ids: number[],
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<GastoIndireto[]> {
    const db = tx ?? this.prisma;
    return db.gastoIndireto.findMany({
      where: { id: { in: ids }, empresaId },
      orderBy: { id: 'desc' },
    });
  }

  create(empresaId: number, data: GastoIndiretoData): Promise<GastoIndireto> {
    return this.prisma.gastoIndireto.create({ data: { ...data, empresaId } });
  }

  /** Campo `undefined` mantém o valor salvo. */
  update(id: number, data: Partial<GastoIndiretoData>): Promise<GastoIndireto> {
    return this.prisma.gastoIndireto.update({ where: { id }, data });
  }

  /** Os rateios das produções antigas ficam, com o id do gasto e a descrição (sem FK, BE-12). */
  async delete(id: number): Promise<void> {
    await this.prisma.gastoIndireto.delete({ where: { id } });
  }
}
