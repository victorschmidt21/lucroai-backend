import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { CanalVendaService } from '../../../canais/application/services/canal-venda.service.js';
import { ConfiguracaoCustosService } from '../../../configuracao-custos/application/services/configuracao-custos.service.js';
import { GastoIndiretoService } from '../../../gastos-indiretos/application/services/gasto-indireto.service.js';
import { InsumoService } from '../../../insumos/application/services/insumo.service.js';
import { calcularCustoReposicao } from '../../../insumos/domain/insumos.calculos.js';
import {
  type BasePreco,
  calcularCustoReceita,
  calcularPrecoNoCanal,
  calcularPrecoVenda,
  type CustoReceita,
  type FichaTecnica,
  lucroPercentualInformado,
  resolverFichaTecnica,
  simularCenario,
  somarGastosPercentuais,
  validarFichaTecnica,
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
  type PrecoDoCanal,
  type ReceitaComItens,
  type ReceitaDto,
  toReceitaDto,
} from '../dto/receita.dto.js';
import {
  type SimulacaoCenarioDto,
  type SimularCenarioDto,
  toSimulacaoCenarioDto,
} from '../dto/simular-cenario.dto.js';
import type { UpdateReceitaDto } from '../dto/update-receita.dto.js';

/**
 * Receita com o custo de 1 lote calculado na leitura, para outros módulos
 * (produções, vendas). **Muda (BE-30):** o custo usa o **custo médio** dos
 * insumos (o que já foi gasto), não a reposição, que só forma o preço.
 * Valores **sem arredondar** (BE-23).
 */
export type ReceitaComCusto = ReceitaComItens & {
  custo: CustoReceita;
  /** Imposto, maquininha, gastos `PERCENTUAL_VENDA` e lucro da receita. */
  basePreco: BasePreco;
};

/** O que o custo de uma receita precisa da empresa, buscado uma vez só. */
interface ContextoCusto {
  /** Custo de reposição (BE-29): forma o preço. */
  custoPorInsumo: Map<number, number>;
  /** Custo médio (BE-30): o custo de produção e venda. */
  custoMedioPorInsumo: Map<number, number>;
  gastos: Awaited<ReturnType<GastoIndiretoService['listarPorEmpresa']>>;
  configuracao: Awaited<
    ReturnType<ConfiguracaoCustosService['buscarDaEmpresa']>
  >;
  canais: Awaited<ReturnType<CanalVendaService['listarAtivosDaEmpresa']>>;
}

/** O Balcão, cuja taxa é a da maquininha: base do `precoSugerido` (BE-28). */
const BALCAO = { balcao: true, comissaoPercentual: 0 };

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
    private readonly configuracaoCustosService: ConfiguracaoCustosService,
    private readonly canalVendaService: CanalVendaService,
  ) {}

  /** Da mais nova para a mais antiga (`dataCriacao`), com o custo atual. */
  async list(empresaId: number): Promise<ReceitaDto[]> {
    const rows = await this.repository.listByEmpresa(empresaId);
    const contexto = await this.contexto(
      rows.flatMap((row) => row.itens.map((item) => item.insumoId)),
      empresaId,
    );
    return rows.map((row) => this.toDto(row, contexto));
  }

  async findById(id: number, empresaId: number): Promise<ReceitaDto> {
    const row = await this.getOrFail(id, empresaId);
    return this.toDto(row, await this.contextoDe(row, empresaId));
  }

  /** Campos da ficha técnica omitidos assumem os padrões (BE-27). */
  async create(dto: CreateReceitaDto, empresaId: number): Promise<ReceitaDto> {
    const ficha = resolverFichaTecnica(this.fichaInformada(dto));
    validarFichaTecnica(ficha);
    // Antes de gravar: 404 se algum insumo não for da empresa.
    const contexto = await this.contexto(
      dto.insumos.map((item) => item.insumo_id),
      empresaId,
    );
    const row = await this.repository.create(
      empresaId,
      {
        nome: dto.nome,
        rendimento: dto.rendimento,
        unidadeRendimento: dto.unidadeRendimento,
        ...ficha,
      },
      dto.insumos.map(toItemData),
    );
    return this.toDto(row, contexto);
  }

  /**
   * Campo omitido mantém o valor salvo; `lucro_percentual: null` (ou
   * `margem_lucro: null`) volta ao lucro padrão. Nada de custo é gravado:
   * a resposta traz o custo atual.
   */
  async update(
    id: number,
    dto: UpdateReceitaDto,
    empresaId: number,
  ): Promise<ReceitaDto> {
    const atual = await this.getOrFail(id, empresaId);
    const ficha = resolverFichaTecnica(this.fichaInformada(dto), atual);
    validarFichaTecnica(ficha);
    const insumos =
      dto.insumos?.map(toItemData) ??
      atual.itens.map((item) => ({
        insumoId: item.insumoId,
        quantidade: item.quantidade,
      }));
    const contexto = await this.contexto(
      insumos.map((item) => item.insumoId),
      empresaId,
    );
    const row = await this.repository.update(
      id,
      {
        nome: dto.nome ?? undefined,
        rendimento: dto.rendimento ?? undefined,
        unidadeRendimento: dto.unidadeRendimento ?? undefined,
        ...ficha,
      },
      dto.insumos ? insumos : undefined,
    );
    return this.toDto(row, contexto);
  }

  async delete(id: number, empresaId: number): Promise<void> {
    await this.getOrFail(id, empresaId);
    await this.repository.delete(id);
  }

  /**
   * Custo de `lotes` lotes, com os custos de reposição dos insumos (BE-29) e os gastos
   * atuais da empresa. Não grava nada.
   */
  async calcularCusto(
    id: number,
    lotes: number,
    empresaId: number,
  ): Promise<ReceitaCustoDto> {
    const receita = await this.getOrFail(id, empresaId);
    const contexto = await this.contextoDe(receita, empresaId);
    return toReceitaCustoDto(this.calcular(receita, contexto, lotes));
  }

  /** Simulação de cenário com o custo e o preço atuais como padrão. Não grava nada. */
  async simular(
    id: number,
    dto: SimularCenarioDto,
    empresaId: number,
  ): Promise<SimulacaoCenarioDto> {
    const receita = await this.getOrFail(id, empresaId);
    const contexto = await this.contextoDe(receita, empresaId);
    const custo = this.calcular(receita, contexto);
    return toSimulacaoCenarioDto(
      simularCenario(dto, {
        custoUnitario: custo.custoUnitario,
        precoSugerido: this.precoSugerido(receita, custo, contexto),
        rendimento: receita.rendimento,
      }),
    );
  }

  /** Preço de venda para a margem informada, com o custo atual. Não grava nada. */
  async calcularPrecoVenda(
    id: number,
    dto: PrecoVendaBodyDto,
    empresaId: number,
  ): Promise<PrecoVendaDto> {
    const receita = await this.getOrFail(id, empresaId);
    const custo = this.calcular(
      receita,
      await this.contextoDe(receita, empresaId),
    );
    return toPrecoVendaDto(
      calcularPrecoVenda(custo.custoUnitario, dto.margem_lucro),
    );
  }

  /**
   * Para outros módulos (produções, vendas): a receita com os itens, o custo
   * de 1 lote com o custo médio dos insumos (BE-30) e a base do preço; 404 se
   * não for da empresa. Valores **sem arredondar** (não o `ReceitaDto`),
   * porque entram em outras contas (BE-23).
   */
  async buscarDaEmpresa(
    id: number,
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<ReceitaComCusto> {
    const receita = await this.getOrFail(id, empresaId, tx);
    const contexto = await this.contextoDe(receita, empresaId, tx);
    return {
      ...receita,
      custo: this.calcular(receita, contexto, 1, contexto.custoMedioPorInsumo),
      basePreco: this.basePreco(receita, contexto),
    };
  }

  private fichaInformada(
    dto: CreateReceitaDto | UpdateReceitaDto,
  ): Parameters<typeof resolverFichaTecnica>[0] {
    return {
      usoPorLote: dto.uso_por_lote,
      embalagemPorUnidade: dto.embalagem_por_unidade,
      perdaPercentual: dto.perda_percentual,
      lucroPercentual: lucroPercentualInformado(dto),
    };
  }

  private toDto(row: ReceitaComItens, contexto: ContextoCusto): ReceitaDto {
    const custo = this.calcular(row, contexto);
    const base = this.basePreco(row, contexto);
    const precos: PrecoDoCanal[] = contexto.canais.map((canal) => ({
      canalId: canal.id,
      canal: canal.nome,
      balcao: canal.balcao,
      ...calcularPrecoNoCanal(custo.detalhe, canal, base),
    }));
    return toReceitaDto(
      row,
      custo,
      base.lucro,
      this.precoSugerido(row, custo, contexto),
      precos,
    );
  }

  /**
   * Preço do Balcão (taxa da maquininha), calculado mesmo com o canal
   * inativo: é o preço de referência da receita (BE-28).
   */
  private precoSugerido(
    receita: FichaTecnica,
    custo: CustoReceita,
    contexto: ContextoCusto,
  ): number | null {
    return calcularPrecoNoCanal(
      custo.detalhe,
      BALCAO,
      this.basePreco(receita, contexto),
    ).preco;
  }

  private basePreco(ficha: FichaTecnica, contexto: ContextoCusto): BasePreco {
    return {
      impostoPercentual: contexto.configuracao.impostoPercentual,
      taxaMaquininha: contexto.configuracao.taxaMaquininha,
      gastosPercentuais: somarGastosPercentuais(contexto.gastos),
      lucro: this.lucroEfetivo(ficha, contexto),
    };
  }

  private lucroEfetivo(ficha: FichaTecnica, contexto: ContextoCusto): number {
    return ficha.lucroPercentual ?? contexto.configuracao.lucroPadrao;
  }

  private calcular(
    receita: ReceitaComItens,
    contexto: ContextoCusto,
    lotes = 1,
    custoPorInsumo = contexto.custoPorInsumo,
  ): CustoReceita {
    return calcularCustoReceita({
      itens: receita.itens.map((item) => ({
        insumoId: item.insumoId,
        quantidade: item.quantidade,
        custoUnitario: custoPorInsumo.get(item.insumoId) ?? 0,
      })),
      rendimento: receita.rendimento,
      usoPorLote: receita.usoPorLote,
      embalagemPorUnidade: receita.embalagemPorUnidade,
      perdaPercentual: receita.perdaPercentual,
      gastos: contexto.gastos,
      capacidadeMensal: contexto.configuracao.capacidadeMensal,
      lotes,
    });
  }

  private contextoDe(
    receita: ReceitaComItens,
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<ContextoCusto> {
    return this.contexto(
      receita.itens.map((item) => item.insumoId),
      empresaId,
      tx,
    );
  }

  /**
   * Custos atuais dos insumos (404 se algum não for da empresa), todos os
   * gastos (lacuna 18), a configuração de custos e os canais ativos (BE-28).
   * Em sequência, porque
   * dentro de uma transação as consultas usam a mesma conexão.
   */
  private async contexto(
    insumoIds: number[],
    empresaId: number,
    tx?: PrismaTransaction,
  ): Promise<ContextoCusto> {
    const insumos = await this.insumoService.buscarVariosDaEmpresa(
      insumoIds,
      empresaId,
      tx,
    );
    const gastos = await this.gastoIndiretoService.listarPorEmpresa(
      empresaId,
      tx,
    );
    const configuracao = await this.configuracaoCustosService.buscarDaEmpresa(
      empresaId,
      tx,
    );
    const canais = await this.canalVendaService.listarAtivosDaEmpresa(
      empresaId,
      tx,
    );
    return {
      // O preço se forma com o custo de reposição (BE-29), não com o médio.
      custoPorInsumo: new Map(
        insumos.map((i) => [i.id, calcularCustoReposicao(i)]),
      ),
      custoMedioPorInsumo: new Map(insumos.map((i) => [i.id, i.custoMedio])),
      gastos,
      configuracao,
      canais,
    };
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

function toItemData(item: ItemEntrada): {
  insumoId: number;
  quantidade: number;
} {
  return { insumoId: item.insumo_id, quantidade: item.quantidade };
}
