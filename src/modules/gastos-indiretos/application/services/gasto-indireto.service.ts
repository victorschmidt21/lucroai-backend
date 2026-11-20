import { Injectable } from '@nestjs/common';
import type { GastoIndireto } from '../../../../generated/prisma/client.js';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { GastoIndiretoRepository } from '../../infra/repositories/gasto-indireto.repository.js';
import type { CreateGastoIndiretoDto } from '../dto/create-gasto-indireto.dto.js';
import {
  type GastoIndiretoDto,
  toGastoIndiretoDto,
} from '../dto/gasto-indireto.dto.js';
import type { UpdateGastoIndiretoDto } from '../dto/update-gasto-indireto.dto.js';

@Injectable()
export class GastoIndiretoService {
  constructor(private readonly repository: GastoIndiretoRepository) {}

  /** O mais novo primeiro (id decrescente). */
  list(empresaId: number): Promise<GastoIndiretoDto[]> {
    return this.listarPorEmpresa(empresaId);
  }

  async findById(id: number, empresaId: number): Promise<GastoIndiretoDto> {
    return toGastoIndiretoDto(await this.getOrFail(id, empresaId));
  }

  async create(
    dto: CreateGastoIndiretoDto,
    empresaId: number,
  ): Promise<GastoIndiretoDto> {
    const row = await this.repository.create(empresaId, {
      descricao: dto.descricao,
      valor: dto.valor,
      metodoRateio: dto.metodo_rateio,
    });
    return toGastoIndiretoDto(row);
  }

  /** Campo omitido mantém o valor salvo. */
  async update(
    id: number,
    dto: UpdateGastoIndiretoDto,
    empresaId: number,
  ): Promise<GastoIndiretoDto> {
    await this.getOrFail(id, empresaId);
    const row = await this.repository.update(id, {
      descricao: dto.descricao,
      valor: dto.valor,
      metodoRateio: dto.metodo_rateio,
    });
    return toGastoIndiretoDto(row);
  }

  /** Os rateios das produções antigas ficam, com a descrição do gasto (BE-05). */
  async delete(id: number, empresaId: number): Promise<void> {
    await this.getOrFail(id, empresaId);
    await this.repository.delete(id);
  }

  /** Para outros módulos: todos os gastos da empresa, o mais novo primeiro. */
  async listarPorEmpresa(
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<GastoIndiretoDto[]> {
    const rows = await this.repository.listByEmpresa(empresaId, tx);
    return rows.map(toGastoIndiretoDto);
  }

  /**
   * Para outros módulos: 404 se algum id não existir ou for de outra empresa
   * (corrige a lacuna 11 na produção). Ids repetidos contam uma vez; lista
   * vazia devolve lista vazia.
   */
  async buscarVariosDaEmpresa(
    ids: number[],
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<GastoIndiretoDto[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return [];
    const rows = await this.repository.listByIdsAndEmpresa(
      unicos,
      empresaId,
      tx,
    );
    if (rows.length !== unicos.length) throw naoEncontrado();
    return rows.map(toGastoIndiretoDto);
  }

  private async getOrFail(
    id: number,
    empresaId: number,
  ): Promise<GastoIndireto> {
    const row = await this.repository.findByIdAndEmpresa(id, empresaId);
    if (!row) throw naoEncontrado();
    return row;
  }
}

function naoEncontrado(): NotFoundError {
  return new NotFoundError(
    'GASTO_INDIRETO_NAO_ENCONTRADO',
    'Gasto indireto não encontrado',
  );
}
