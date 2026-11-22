import { Injectable } from '@nestjs/common';
import type { ConfiguracaoCustos } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { ConfiguracaoCustosValores } from '../../domain/configuracao-custos.calculos.js';

@Injectable()
export class ConfiguracaoCustosRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmpresa(
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<ConfiguracaoCustos | null> {
    const db = tx ?? this.prisma;
    return db.configuracaoCustos.findUnique({ where: { empresaId } });
  }

  create(
    empresaId: number,
    data: ConfiguracaoCustosValores,
    tx?: PrismaTransaction,
  ): Promise<ConfiguracaoCustos> {
    const db = tx ?? this.prisma;
    return db.configuracaoCustos.create({ data: { ...data, empresaId } });
  }

  update(
    empresaId: number,
    data: ConfiguracaoCustosValores,
  ): Promise<ConfiguracaoCustos> {
    return this.prisma.configuracaoCustos.update({
      where: { empresaId },
      data,
    });
  }
}
