import { Injectable } from '@nestjs/common';
import type { Estoque } from '../../../../generated/prisma/client.js';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import {
  calcularQuantidadeBaixa,
  calcularSaldoAposMovimentacao,
} from '../../domain/estoque.calculos.js';
import { EstoqueRepository } from '../../infra/repositories/estoque.repository.js';
import type { AtualizarMinimoEstoqueDto } from '../dto/atualizar-minimo-estoque.dto.js';
import { type EstoqueDto, toEstoqueDto } from '../dto/estoque.dto.js';
import {
  type MovimentacaoEstoqueDto,
  toMovimentacaoEstoqueDto,
} from '../dto/movimentacao-estoque.dto.js';
import type { RegistrarEntradaEstoqueDto } from '../dto/registrar-entrada-estoque.dto.js';
import type { SaldoInsumo } from '../dto/saldo-insumo.dto.js';

/** Item de receita que a produção baixa do estoque (quantidade por lote). */
export interface ItemBaixaProducao {
  insumoId: number;
  quantidade: number;
}

@Injectable()
export class EstoqueService {
  constructor(
    private readonly repository: EstoqueRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  /**
   * Um item por insumo da empresa, inclusive os sem movimentação: todo insumo
   * nasce com o registro de estoque (`criarRegistroInicial`, BE-07).
   */
  async list(empresaId: number): Promise<EstoqueDto[]> {
    const rows = await this.repository.listByEmpresa(empresaId);
    return rows.map(toEstoqueDto);
  }

  async findByInsumo(insumoId: number, empresaId: number): Promise<EstoqueDto> {
    return toEstoqueDto(await this.getOrFail(insumoId, empresaId));
  }

  /**
   * Entrada manual (`ENTRADA/COMPRA`): saldo e movimentação na mesma transação.
   * Sem valor, não mexe no custo médio do insumo (é como entrar ao médio); a
   * compra com valor é `POST /insumos/:id/compras` (BE-29).
   */
  registrarEntrada(
    insumoId: number,
    dto: RegistrarEntradaEstoqueDto,
    empresaId: number,
  ): Promise<EstoqueDto> {
    return this.transactionManager.run(async (tx) => {
      const estoque = await this.getForUpdateOrFail(insumoId, empresaId, tx);
      const atualizado = await this.repository.updateQuantidadeDisponivel(
        estoque.id,
        calcularSaldoAposMovimentacao(
          estoque.quantidadeDisponivel,
          'ENTRADA',
          dto.quantidade,
        ),
        tx,
      );
      // A quantidade da movimentação é gravada como veio, como no operations-service.
      await this.repository.createMovimentacao(
        {
          empresaId,
          insumoId,
          tipo: 'ENTRADA',
          origem: 'COMPRA',
          quantidade: dto.quantidade,
          observacao: dto.observacao ?? null,
        },
        tx,
      );
      return toEstoqueDto(atualizado);
    });
  }

  /** Novo (BE-11, lacuna 14): define o estoque mínimo, sem movimentação. */
  async atualizarMinimo(
    insumoId: number,
    dto: AtualizarMinimoEstoqueDto,
    empresaId: number,
  ): Promise<EstoqueDto> {
    const estoque = await this.getOrFail(insumoId, empresaId);
    const atualizado = await this.repository.updateQuantidadeMinima(
      estoque.id,
      dto.quantidadeMinima,
    );
    return toEstoqueDto(atualizado);
  }

  /** Mais recentes primeiro. */
  async listMovimentacoes(
    insumoId: number,
    empresaId: number,
  ): Promise<MovimentacaoEstoqueDto[]> {
    await this.getOrFail(insumoId, empresaId);
    const rows = await this.repository.listMovimentacoesByInsumoAndEmpresa(
      insumoId,
      empresaId,
    );
    return rows.map(toMovimentacaoEstoqueDto);
  }

  /**
   * Para o módulo insumos, na transação que cria o insumo: cria o saldo e,
   * com quantidade maior que 0, uma movimentação ENTRADA/COMPRA, com o id da
   * compra inicial em `referenciaId` (BE-29). Substitui o evento
   * `insumo-criado` dos microsserviços.
   */
  async criarRegistroInicial(
    insumoId: number,
    empresaId: number,
    quantidade: number,
    tx: PrismaTransaction,
    compraId: number | null = null,
  ): Promise<SaldoInsumo> {
    const estoque = await this.repository.create(
      { empresaId, insumoId, quantidadeDisponivel: quantidade },
      tx,
    );
    if (quantidade > 0) {
      await this.repository.createMovimentacao(
        {
          empresaId,
          insumoId,
          tipo: 'ENTRADA',
          origem: 'COMPRA',
          quantidade,
          referenciaId: compraId,
        },
        tx,
      );
    }
    return {
      quantidadeDisponivel: estoque.quantidadeDisponivel,
      quantidadeMinima: estoque.quantidadeMinima,
    };
  }

  /**
   * Para o módulo insumos (BE-29), na transação da compra: trava o saldo, dá
   * entrada da quantidade (`ENTRADA/COMPRA`, `referenciaId` = id da compra) e
   * devolve o saldo **antes** da entrada, que pondera o custo médio. A trava
   * vale até o fim da transação, então duas compras do mesmo insumo não leem
   * o mesmo saldo nem o mesmo médio.
   */
  async registrarEntradaPorCompra(
    insumoId: number,
    quantidade: number,
    compraId: number,
    observacao: string | null,
    empresaId: number,
    tx: PrismaTransaction,
  ): Promise<{ saldoAnterior: number }> {
    const estoque = await this.getForUpdateOrFail(insumoId, empresaId, tx);
    await this.repository.updateQuantidadeDisponivel(
      estoque.id,
      calcularSaldoAposMovimentacao(
        estoque.quantidadeDisponivel,
        'ENTRADA',
        quantidade,
      ),
      tx,
    );
    await this.repository.createMovimentacao(
      {
        empresaId,
        insumoId,
        tipo: 'ENTRADA',
        origem: 'COMPRA',
        quantidade,
        referenciaId: compraId,
        observacao,
      },
      tx,
    );
    return { saldoAnterior: estoque.quantidadeDisponivel };
  }

  /**
   * Para o módulo insumos: saldo e mínimo por id de insumo, só da empresa.
   * Com `insumoIds`, busca só esses insumos.
   */
  async saldosPorInsumo(
    empresaId: number,
    insumoIds?: number[],
    tx?: PrismaTransaction,
  ): Promise<Map<number, SaldoInsumo>> {
    const rows = await this.repository.listByEmpresa(empresaId, insumoIds, tx);
    return new Map(
      rows.map((row) => [
        row.insumoId,
        {
          quantidadeDisponivel: row.quantidadeDisponivel,
          quantidadeMinima: row.quantidadeMinima,
        },
      ]),
    );
  }

  /**
   * Para o módulo producoes (BE-12), na transação da produção: para cada item,
   * baixa `round6(item.quantidade × lotes)` (`SAIDA/PRODUCAO`, `referenciaId`
   * = id da produção). Aceita saldo negativo, como hoje (lacuna 10): bloquear a
   * produção sem saldo é decisão de produto e pede uma issue própria.
   */
  async baixarPorProducao(
    itens: ItemBaixaProducao[],
    lotes: number,
    producaoId: number,
    empresaId: number,
    tx: PrismaTransaction,
  ): Promise<void> {
    for (const item of itens) {
      const estoque = await this.getForUpdateOrFail(
        item.insumoId,
        empresaId,
        tx,
      );
      const quantidade = calcularQuantidadeBaixa(item.quantidade, lotes);
      await this.repository.updateQuantidadeDisponivel(
        estoque.id,
        calcularSaldoAposMovimentacao(
          estoque.quantidadeDisponivel,
          'SAIDA',
          quantidade,
        ),
        tx,
      );
      await this.repository.createMovimentacao(
        {
          empresaId,
          insumoId: item.insumoId,
          tipo: 'SAIDA',
          origem: 'PRODUCAO',
          quantidade,
          referenciaId: producaoId,
        },
        tx,
      );
    }
  }

  /**
   * Confere a empresa pelo `empresa_id` do próprio estoque (BE-05): insumo
   * inexistente ou de outra empresa → 404.
   */
  private async getOrFail(
    insumoId: number,
    empresaId: number,
  ): Promise<Estoque> {
    const row = await this.repository.findByInsumoAndEmpresa(
      insumoId,
      empresaId,
    );
    if (!row) throw insumoNaoEncontrado();
    return row;
  }

  private async getForUpdateOrFail(
    insumoId: number,
    empresaId: number,
    tx: PrismaTransaction,
  ): Promise<Estoque> {
    const row = await this.repository.findByInsumoAndEmpresaForUpdate(
      insumoId,
      empresaId,
      tx,
    );
    if (!row) throw insumoNaoEncontrado();
    return row;
  }
}

function insumoNaoEncontrado(): NotFoundError {
  return new NotFoundError('INSUMO_NAO_ENCONTRADO', 'Insumo não encontrado');
}
