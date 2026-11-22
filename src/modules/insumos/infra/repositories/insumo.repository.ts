import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Insumo,
  type UnidadeMedida,
} from '../../../../generated/prisma/client.js';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';

interface InsumoData {
  nome: string;
  quantidadeBaseCusto: number;
  unidade: UnidadeMedida;
  valorPago: number;
  custoUnitario: number;
}

@Injectable()
export class InsumoRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByEmpresa(empresaId: number): Promise<Insumo[]> {
    return this.prisma.insumo.findMany({
      where: { empresaId },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
  }

  findByIdAndEmpresa(id: number, empresaId: number): Promise<Insumo | null> {
    return this.prisma.insumo.findFirst({ where: { id, empresaId } });
  }

  listByIdsAndEmpresa(
    ids: number[],
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<Insumo[]> {
    const db = tx ?? this.prisma;
    return db.insumo.findMany({
      where: { id: { in: ids }, empresaId },
    });
  }

  create(
    empresaId: number,
    data: InsumoData,
    tx?: PrismaTransaction,
  ): Promise<Insumo> {
    const db = tx ?? this.prisma;
    return db.insumo.create({ data: { ...data, empresaId } });
  }

  update(id: number, data: Partial<InsumoData>): Promise<Insumo> {
    return this.prisma.insumo.update({ where: { id }, data });
  }

  /**
   * O estoque e as movimentações do insumo vão junto (`CASCADE`). Insumo
   * usado em receita é barrado pela FK `RESTRICT` de `item_receita` (P2003),
   * que vira 409 `INSUMO_EM_USO` (lacuna 13).
   */
  async delete(id: number): Promise<void> {
    try {
      await this.prisma.insumo.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictError(
          'INSUMO_EM_USO',
          'Insumo usado em receitas não pode ser excluído',
        );
      }
      throw error;
    }
  }
}
