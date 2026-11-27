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

/** Receita usada dentro de outra (BE-39). */
export interface ItemReceitaData {
  receitaUsadaId: number;
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
  minutosTrabalhoPorLote: number;
  vendavel: boolean;
}

const include = {
  itens: { orderBy: { id: 'asc' } },
  receitasUsadas: {
    orderBy: { id: 'asc' },
    include: {
      // O custo da receita usada (BE-40) vem na mesma consulta: o Prisma
      // busca cada nível de uma vez para todas as receitas, sem N+1.
      receitaUsada: {
        select: {
          nome: true,
          unidadeRendimento: true,
          rendimento: true,
          usoPorLote: true,
          perdaPercentual: true,
          itens: {
            orderBy: { id: 'asc' },
            select: { insumoId: true, quantidade: true },
          },
        },
      },
    },
  },
  usadaEm: {
    orderBy: { receitaId: 'asc' },
    select: { receita: { select: { id: true, nome: true } } },
  },
} as const;

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

  /**
   * Receitas da empresa entre `ids`, com a indicação de se já usam receitas
   * dentro (BE-39) e os insumos delas (BE-40, para o custo). Ids de outra
   * empresa ficam de fora.
   */
  async findParaUso(
    ids: number[],
    empresaId: number,
  ): Promise<{ id: number; temReceitas: boolean; insumoIds: number[] }[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.receita.findMany({
      where: { id: { in: ids }, empresaId },
      select: {
        id: true,
        itens: { select: { insumoId: true } },
        _count: { select: { receitasUsadas: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      temReceitas: row._count.receitasUsadas > 0,
      insumoIds: row.itens.map((item) => item.insumoId),
    }));
  }

  /** Receita e itens num único insert aninhado (atômico). */
  create(
    empresaId: number,
    data: ReceitaData,
    itens: ItemData[],
    receitas: ItemReceitaData[],
  ): Promise<ReceitaComItens> {
    return this.prisma.receita.create({
      data: {
        ...data,
        empresaId,
        itens: { create: itens },
        receitasUsadas: { create: receitas },
      },
      include,
    });
  }

  /**
   * Campos `undefined` mantêm o valor salvo. Com `itens` (ou `receitas`),
   * troca todos os itens no mesmo update aninhado (atômico), como o
   * recipe-service.
   */
  update(
    id: number,
    data: Partial<ReceitaData>,
    itens?: ItemData[],
    receitas?: ItemReceitaData[],
  ): Promise<ReceitaComItens> {
    return this.prisma.receita.update({
      where: { id },
      data: {
        ...data,
        ...(itens && { itens: { deleteMany: {}, create: itens } }),
        ...(receitas && {
          receitasUsadas: { deleteMany: {}, create: receitas },
        }),
      },
      include,
    });
  }

  /**
   * Os itens, o saldo e as movimentações de produto acabado vão junto
   * (`CASCADE`). Receita usada em produção ou venda é barrada pela FK
   * `RESTRICT` (P2003) e vira 409 `RECEITA_EM_USO`. A usada em outra receita
   * o service barra antes, com os nomes (BE-39); a FK fica de garantia.
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
          'Receita usada em produções, vendas ou outras receitas não pode ser excluída',
        );
      }
      throw error;
    }
  }
}
