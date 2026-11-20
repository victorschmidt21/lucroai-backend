import { Injectable } from '@nestjs/common';
import type { StatusVenda } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { VendaComItens } from '../../application/dto/venda.dto.js';
import type { NovaVenda } from '../../domain/venda.entity.js';

export interface FiltrosVenda {
  status?: StatusVenda;
  dataInicio?: Date;
  dataFim?: Date;
}

const include = { itens: { orderBy: { id: 'asc' } } } as const;

@Injectable()
export class VendaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Mais recentes primeiro; o id desempata vendas no mesmo instante. */
  listByEmpresa(
    empresaId: number,
    { status, dataInicio, dataFim }: FiltrosVenda,
  ): Promise<VendaComItens[]> {
    const dataVenda =
      dataInicio || dataFim ? { gte: dataInicio, lte: dataFim } : undefined;
    return this.prisma.venda.findMany({
      where: { empresaId, status, dataVenda },
      include,
      orderBy: [{ dataVenda: 'desc' }, { id: 'desc' }],
    });
  }

  findByIdAndEmpresa(
    id: number,
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<VendaComItens | null> {
    const db = tx ?? this.prisma;
    return db.venda.findFirst({ where: { id, empresaId }, include });
  }

  /** Venda e itens num único insert aninhado. */
  create({ itens, ...data }: NovaVenda): Promise<VendaComItens> {
    return this.prisma.venda.create({
      data: { ...data, itens: { create: itens } },
      include,
    });
  }

  /**
   * Muda o status só se a venda ainda estiver `PENDENTE` e devolve se mudou.
   * A linha fica travada até o fim da transação: uma mudança concorrente
   * espera e, depois do commit desta, já não a encontra `PENDENTE`.
   */
  async updateStatusSePendente(
    id: number,
    empresaId: number,
    status: StatusVenda,
    tx: PrismaTransaction,
  ): Promise<boolean> {
    const { count } = await tx.venda.updateMany({
      where: { id, empresaId, status: 'PENDENTE' },
      data: { status },
    });
    return count === 1;
  }
}
