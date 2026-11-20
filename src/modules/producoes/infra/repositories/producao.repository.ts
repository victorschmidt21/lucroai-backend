import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { ProducaoComRateios } from '../../application/dto/producao.dto.js';

interface RateioData {
  gastoIndiretoId: number;
  descricao: string;
  valorRateado: number;
}

interface ProducaoData {
  empresaId: number;
  receitaId: number;
  quantidade: number;
  totalUnidades: number;
  custoTotal: number;
  custoUnitario: number;
  rateios: RateioData[];
}

const include = { rateios: { orderBy: { id: 'asc' } } } as const;

@Injectable()
export class ProducaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Mais recentes primeiro; o id desempata produções no mesmo instante. */
  listByEmpresa(
    empresaId: number,
    receitaId?: number,
  ): Promise<ProducaoComRateios[]> {
    return this.prisma.producao.findMany({
      where: { empresaId, ...(receitaId !== undefined && { receitaId }) },
      include,
      orderBy: [{ dataProducao: 'desc' }, { id: 'desc' }],
    });
  }

  findByIdAndEmpresa(
    id: number,
    empresaId: number,
  ): Promise<ProducaoComRateios | null> {
    return this.prisma.producao.findFirst({
      where: { id, empresaId },
      include,
    });
  }

  /** Produção e rateios num único insert aninhado. */
  create(
    { rateios, ...data }: ProducaoData,
    tx: PrismaTransaction,
  ): Promise<ProducaoComRateios> {
    return tx.producao.create({
      data: { ...data, rateios: { create: rateios } },
      include,
    });
  }
}
