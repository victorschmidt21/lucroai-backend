import { Injectable } from '@nestjs/common';
import type { ConfiguracaoCustos } from '../../../../generated/prisma/client.js';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import {
  CONFIGURACAO_CUSTOS_PADRAO,
  validarConfiguracaoCustos,
} from '../../domain/configuracao-custos.calculos.js';
import { ConfiguracaoCustosRepository } from '../../infra/repositories/configuracao-custos.repository.js';
import {
  type ConfiguracaoCustosDto,
  toConfiguracaoCustosDto,
} from '../dto/configuracao-custos.dto.js';
import type { UpdateConfiguracaoCustosDto } from '../dto/update-configuracao-custos.dto.js';

@Injectable()
export class ConfiguracaoCustosService {
  constructor(private readonly repository: ConfiguracaoCustosRepository) {}

  async find(empresaId: number): Promise<ConfiguracaoCustosDto> {
    return toConfiguracaoCustosDto(await this.getOrFail(empresaId));
  }

  async update(
    dto: UpdateConfiguracaoCustosDto,
    empresaId: number,
  ): Promise<ConfiguracaoCustosDto> {
    const atual = await this.getOrFail(empresaId);
    const config = {
      baseRateio: dto.baseRateio ?? atual.baseRateio,
      capacidadeMensal: dto.capacidadeMensal ?? atual.capacidadeMensal,
      lucroPadrao: dto.lucroPadrao ?? atual.lucroPadrao,
      impostoPercentual: dto.impostoPercentual ?? atual.impostoPercentual,
      taxaMaquininha: dto.taxaMaquininha ?? atual.taxaMaquininha,
      valorHora: dto.valorHora ?? atual.valorHora,
    };
    validarConfiguracaoCustos(config);
    return toConfiguracaoCustosDto(
      await this.repository.update(empresaId, config),
    );
  }

  /** Para o `auth`: cria a configuração padrão na transação do cadastro. */
  async criarPadrao(empresaId: number, tx?: PrismaTransaction): Promise<void> {
    await this.repository.create(
      empresaId,
      { ...CONFIGURACAO_CUSTOS_PADRAO },
      tx,
    );
  }

  /** Para outros módulos (receitas, produções): a configuração da empresa. */
  async buscarDaEmpresa(
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<ConfiguracaoCustosDto> {
    return toConfiguracaoCustosDto(await this.getOrFail(empresaId, tx));
  }

  // Toda empresa tem configuração (cadastro, seed e a migration que a criou
  // para as empresas antigas); o 404 só protege contra um banco inconsistente.
  private async getOrFail(
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<ConfiguracaoCustos> {
    const row = await this.repository.findByEmpresa(empresaId, tx);
    if (!row) {
      throw new NotFoundError(
        'CONFIGURACAO_CUSTOS_NAO_ENCONTRADA',
        'Configuração de custos não encontrada',
      );
    }
    return row;
  }
}
