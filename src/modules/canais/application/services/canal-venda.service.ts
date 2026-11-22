import { Injectable } from '@nestjs/common';
import type { CanalVenda } from '../../../../generated/prisma/client.js';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import {
  CANAIS_PADRAO,
  garantirCanalExcluivel,
} from '../../domain/canais.calculos.js';
import { CanalVendaRepository } from '../../infra/repositories/canal-venda.repository.js';
import { type CanalVendaDto, toCanalVendaDto } from '../dto/canal-venda.dto.js';
import type { CreateCanalVendaDto } from '../dto/create-canal-venda.dto.js';
import type { UpdateCanalVendaDto } from '../dto/update-canal-venda.dto.js';

@Injectable()
export class CanalVendaService {
  constructor(private readonly repository: CanalVendaRepository) {}

  /** Em ordem de criação: o Balcão primeiro. */
  async list(empresaId: number): Promise<CanalVendaDto[]> {
    const rows = await this.repository.listByEmpresa(empresaId);
    return rows.map(toCanalVendaDto);
  }

  async create(
    dto: CreateCanalVendaDto,
    empresaId: number,
  ): Promise<CanalVendaDto> {
    const row = await this.repository.create(empresaId, {
      nome: dto.nome,
      comissaoPercentual: dto.comissaoPercentual,
      ativo: dto.ativo ?? true,
      balcao: false,
    });
    return toCanalVendaDto(row);
  }

  /** Campo omitido mantém o valor salvo; `ativo` ativa ou desativa. */
  async update(
    id: number,
    dto: UpdateCanalVendaDto,
    empresaId: number,
  ): Promise<CanalVendaDto> {
    await this.getOrFail(id, empresaId);
    const row = await this.repository.update(id, {
      nome: dto.nome,
      comissaoPercentual: dto.comissaoPercentual,
      ativo: dto.ativo,
    });
    return toCanalVendaDto(row);
  }

  async delete(id: number, empresaId: number): Promise<void> {
    garantirCanalExcluivel(await this.getOrFail(id, empresaId));
    await this.repository.delete(id);
  }

  /** Para o `auth`: cria os canais padrão na transação do cadastro. */
  async criarPadrao(empresaId: number, tx?: PrismaTransaction): Promise<void> {
    await this.repository.createMany(empresaId, CANAIS_PADRAO, tx);
  }

  private async getOrFail(id: number, empresaId: number): Promise<CanalVenda> {
    const row = await this.repository.findByIdAndEmpresa(id, empresaId);
    if (!row) {
      throw new NotFoundError(
        'CANAL_VENDA_NAO_ENCONTRADO',
        'Canal de venda não encontrado',
      );
    }
    return row;
  }
}
