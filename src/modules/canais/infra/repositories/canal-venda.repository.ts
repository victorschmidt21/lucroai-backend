import { Injectable } from '@nestjs/common';
import type { CanalVenda } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { CanalVendaValores } from '../../domain/canais.calculos.js';

@Injectable()
export class CanalVendaRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByEmpresa(empresaId: number): Promise<CanalVenda[]> {
    return this.prisma.canalVenda.findMany({
      where: { empresaId },
      orderBy: { id: 'asc' },
    });
  }

  listAtivosByEmpresa(
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<CanalVenda[]> {
    return (tx ?? this.prisma).canalVenda.findMany({
      where: { empresaId, ativo: true },
      orderBy: { id: 'asc' },
    });
  }

  findByIdAndEmpresa(
    id: number,
    empresaId: number,
  ): Promise<CanalVenda | null> {
    return this.prisma.canalVenda.findFirst({ where: { id, empresaId } });
  }

  /** O Balcão da empresa (o primeiro, se houver mais de um). */
  findBalcaoByEmpresa(empresaId: number): Promise<CanalVenda | null> {
    return this.prisma.canalVenda.findFirst({
      where: { empresaId, balcao: true },
      orderBy: { id: 'asc' },
    });
  }

  create(empresaId: number, data: CanalVendaValores): Promise<CanalVenda> {
    return this.prisma.canalVenda.create({ data: { ...data, empresaId } });
  }

  /** Um `create` por canal, em ordem, para os ids seguirem a lista. */
  async createMany(
    empresaId: number,
    canais: readonly CanalVendaValores[],
    tx?: PrismaTransaction,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    for (const canal of canais) {
      await db.canalVenda.create({ data: { ...canal, empresaId } });
    }
  }

  /** Campo `undefined` mantém o valor salvo; `balcao` nunca muda. */
  update(
    id: number,
    data: Partial<Omit<CanalVendaValores, 'balcao'>>,
  ): Promise<CanalVenda> {
    return this.prisma.canalVenda.update({ where: { id }, data });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.canalVenda.delete({ where: { id } });
  }
}
