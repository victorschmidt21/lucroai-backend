import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type UnidadeMedida,
} from '../../../../generated/prisma/client.js';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { ReceitaComItens } from '../../application/dto/receita.dto.js';

interface ItemData {
  insumoId: number;
  quantidade: number;
}

/** Sem custo: desde a BE-27 ele é calculado na leitura. */
interface ReceitaData {
  nome: string;
  rendimento: number;
  unidadeRendimento: UnidadeMedida;
  usoPorLote: number;
  embalagemPorUnidade: number;
  perdaPercentual: number;
  lucroPercentual: number | null;
}

const include = { itens: { orderBy: { id: 'asc' } } } as const;

@Injectable()
export class ReceitaRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByEmpresa(empresaId: number): Promise<ReceitaComItens[]> {
    return this.prisma.receita.findMany({
      where: { empresaId },
      include,
      orderBy: [{ dataCriacao: 'desc' }, { id: 'desc' }],
    });
  }

  findByIdAndEmpresa(
    id: number,
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<ReceitaComItens | null> {
    const db = tx ?? this.prisma;
    return db.receita.findFirst({ where: { id, empresaId }, include });
  }

  /** Receita e itens num único insert aninhado (atômico). */
  create(
    empresaId: number,
    data: ReceitaData,
    itens: ItemData[],
  ): Promise<ReceitaComItens> {
    return this.prisma.receita.create({
      data: { ...data, empresaId, itens: { create: itens } },
      include,
    });
  }

  /**
   * Campos `undefined` mantêm o valor salvo. Com `itens`, troca todos os
   * itens no mesmo update aninhado (atômico), como o recipe-service.
   */
  update(
    id: number,
    data: Partial<ReceitaData>,
    itens?: ItemData[],
  ): Promise<ReceitaComItens> {
    return this.prisma.receita.update({
      where: { id },
      data: {
        ...data,
        ...(itens && { itens: { deleteMany: {}, create: itens } }),
      },
      include,
    });
  }

  /**
   * Os itens, o saldo e as movimentações de produto acabado vão junto
   * (`CASCADE`). Receita usada em produção ou venda é barrada pela FK
   * `RESTRICT` (P2003) e vira 409 `RECEITA_EM_USO`.
   */
  async delete(id: number): Promise<void> {
    try {
      await this.prisma.receita.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictError(
          'RECEITA_EM_USO',
          'Receita usada em produções ou vendas não pode ser excluída',
        );
      }
      throw error;
    }
  }
}
