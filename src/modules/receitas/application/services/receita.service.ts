import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { GastoIndiretoService } from '../../../gastos-indiretos/application/services/gasto-indireto.service.js';
import { InsumoService } from '../../../insumos/application/services/insumo.service.js';
import {
  calcularCustoReceita,
  calcularPrecoVenda,
  type CustoReceita,
  precisaRecalcular,
  resolverMargem,
  simularCenario,
} from '../../domain/receitas.calculos.js';
import { ReceitaRepository } from '../../infra/repositories/receita.repository.js';
import type { CreateReceitaDto } from '../dto/create-receita.dto.js';
import {
  type PrecoVendaBodyDto,
  type PrecoVendaDto,
  toPrecoVendaDto,
} from '../dto/preco-venda.dto.js';
import {
  type ReceitaCustoDto,
  toReceitaCustoDto,
} from '../dto/receita-custo.dto.js';
import {
  type ReceitaComItens,
  type ReceitaDto,
  toReceitaDto,
} from '../dto/receita.dto.js';
import type {
  SimulacaoCenarioDto,
  SimularCenarioDto,
} from '../dto/simular-cenario.dto.js';
import type { UpdateReceitaDto } from '../dto/update-receita.dto.js';

interface ItemEntrada {
  insumo_id: number;
  quantidade: number;
}

@Injectable()
export class ReceitaService {
  constructor(
    private readonly repository: ReceitaRepository,
    private readonly insumoService: InsumoService,
    private readonly gastoIndiretoService: GastoIndiretoService,
  ) {}

  /** Da mais nova para a mais antiga (`dataCriacao`). */
  async list(empresaId: number): Promise<ReceitaDto[]> {
    const rows = await this.repository.listByEmpresa(empresaId);
    return rows.map(toReceitaDto);
  }

  async findById(id: number, empresaId: number): Promise<ReceitaDto> {
    return toReceitaDto(await this.getOrFail(id, empresaId));
  }

  async create(dto: CreateReceitaDto, empresaId: number): Promise<ReceitaDto> {
    const margemLucro = dto.margem_lucro ?? null;
    const custo = await this.calcular(
      dto.insumos,
      dto.rendimento,
      margemLucro,
      empresaId,
    );
    const row = await this.repository.create(
      empresaId,
      {
        nome: dto.nome,
        rendimento: dto.rendimento,
        unidadeRendimento: dto.unidadeRendimento,
        custoProducao: custo.custoProducao,
        custoUnitario: custo.custoUnitario,
        margemLucro,
        precoSugerido: custo.precoSugerido,
      },
      custo.itens,
    );
    return toReceitaDto(row);
  }

  /**
   * Campo omitido mantém o valor salvo. O custo só é recalculado (com os
   * custos atuais dos insumos e os gastos atuais) se vierem insumos,
   * rendimento ou margem; `margem_lucro: null` remove margem e preço sugerido.
   */
  async update(
    id: number,
    dto: UpdateReceitaDto,
    empresaId: number,
  ): Promise<ReceitaDto> {
    const atual = await this.getOrFail(id, empresaId);
    const dadosBasicos = {
      nome: dto.nome ?? undefined,
      unidadeRendimento: dto.unidadeRendimento ?? undefined,
    };
    if (!precisaRecalcular(dto)) {
      return toReceitaDto(await this.repository.update(id, dadosBasicos));
    }

    const rendimento = dto.rendimento ?? atual.rendimento;
    const margemLucro = resolverMargem(dto.margem_lucro, atual.margemLucro);
    const insumos =
      dto.insumos ??
      atual.itens.map((item) => ({
        insumo_id: item.insumoId,
        quantidade: item.quantidade,
      }));
    const custo = await this.calcular(
      insumos,
      rendimento,
      margemLucro,
      empresaId,
    );
    const row = await this.repository.update(
      id,
      {
        ...dadosBasicos,
        rendimento,
        custoProducao: custo.custoProducao,
        custoUnitario: custo.custoUnitario,
        margemLucro,
        precoSugerido: custo.precoSugerido,
      },
      custo.itens,
    );
    return toReceitaDto(row);
  }

  async delete(id: number, empresaId: number): Promise<void> {
    await this.getOrFail(id, empresaId);
    await this.repository.delete(id);
  }

  /**
   * Custo de `lotes` lotes, recalculado com os custos atuais dos insumos e
   * os gastos atuais da empresa (não usa os valores salvos). Não grava nada.
   */
  async calcularCusto(
    id: number,
    lotes: number,
    empresaId: number,
  ): Promise<ReceitaCustoDto> {
    const receita = await this.getOrFail(id, empresaId);
    const custo = await this.calcular(
      receita.itens.map((item) => ({
        insumo_id: item.insumoId,
        quantidade: item.quantidade,
      })),
      receita.rendimento,
      receita.margemLucro,
      empresaId,
      lotes,
    );
    return toReceitaCustoDto(custo);
  }

  /** Simulação de cenário com os valores salvos como padrão. Não grava nada. */
  async simular(
    id: number,
    dto: SimularCenarioDto,
    empresaId: number,
  ): Promise<SimulacaoCenarioDto> {
    const receita = await this.getOrFail(id, empresaId);
    return simularCenario(dto, receita);
  }

  /** Preço de venda para a margem informada, com o custo salvo. Não grava nada. */
  async calcularPrecoVenda(
    id: number,
    dto: PrecoVendaBodyDto,
    empresaId: number,
  ): Promise<PrecoVendaDto> {
    const receita = await this.getOrFail(id, empresaId);
    return toPrecoVendaDto(
      calcularPrecoVenda(receita.custoUnitario, dto.margem_lucro),
    );
  }

  /** Para outros módulos (produções, vendas): a receita com os itens; 404 se não for da empresa. */
  async buscarDaEmpresa(
    id: number,
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<ReceitaDto> {
    return toReceitaDto(await this.getOrFail(id, empresaId, tx));
  }

  /** Insumos da empresa (404 se algum não for) e todos os gastos (lacuna 18). */
  private async calcular(
    insumos: ItemEntrada[],
    rendimento: number,
    margemLucro: number | null,
    empresaId: number,
    lotes = 1,
  ): Promise<CustoReceita> {
    const [encontrados, gastos] = await Promise.all([
      this.insumoService.buscarVariosDaEmpresa(
        insumos.map((item) => item.insumo_id),
        empresaId,
      ),
      this.gastoIndiretoService.listarPorEmpresa(empresaId),
    ]);
    const custoPorId = new Map(encontrados.map((i) => [i.id, i.custoUnitario]));
    return calcularCustoReceita({
      itens: insumos.map((item) => ({
        insumoId: item.insumo_id,
        quantidade: item.quantidade,
        custoUnitario: custoPorId.get(item.insumo_id) ?? 0,
      })),
      rendimento,
      margemLucro,
      gastos,
      lotes,
    });
  }

  private async getOrFail(
    id: number,
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<ReceitaComItens> {
    const row = await this.repository.findByIdAndEmpresa(id, empresaId, tx);
    if (!row) {
      throw new NotFoundError(
        'RECEITA_NAO_ENCONTRADA',
        'Receita não encontrada',
      );
    }
    return row;
  }
}
