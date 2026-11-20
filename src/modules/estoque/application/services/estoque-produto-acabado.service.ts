import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import {
  calcularSaidaProdutoAcabado,
  calcularSaldoAposMovimentacao,
} from '../../domain/estoque.calculos.js';
import { EstoqueProdutoAcabadoRepository } from '../../infra/repositories/estoque-produto-acabado.repository.js';
import {
  type EstoqueProdutoDto,
  toEstoqueProdutoDto,
} from '../dto/estoque-produto.dto.js';

/**
 * Saldo de produto acabado por receita. Substitui o
 * `EstoqueProdutoAcabadoService` do operations-service; a entrada e a saída
 * acontecem na transação de quem chama (produção e venda), sem eventos.
 */
@Injectable()
export class EstoqueProdutoAcabadoService {
  constructor(private readonly repository: EstoqueProdutoAcabadoRepository) {}

  /** Novo (BE-12, lacuna 6): só as receitas que já tiveram movimentação. */
  async list(empresaId: number): Promise<EstoqueProdutoDto[]> {
    const rows = await this.repository.listByEmpresa(empresaId);
    return rows.map(toEstoqueProdutoDto);
  }

  /**
   * Para o módulo producoes, na transação da produção: soma `totalUnidades`
   * ao saldo da receita (`ENTRADA/PRODUCAO`, `referenciaId` = id da produção).
   * A receita já foi conferida contra a empresa por quem chama.
   */
  async entradaPorProducao(
    receitaId: number,
    totalUnidades: number,
    producaoId: number,
    empresaId: number,
    tx: PrismaTransaction,
  ): Promise<EstoqueProdutoDto> {
    const estoque = await this.repository.findOrCreateForUpdate(
      receitaId,
      empresaId,
      tx,
    );
    // Só acontece se o saldo da receita existir com outra empresa, o que a
    // conferência da receita por quem chama já impede.
    if (!estoque) throw receitaNaoEncontrada();
    const atualizado = await this.repository.updateQuantidadeDisponivel(
      estoque.id,
      calcularSaldoAposMovimentacao(
        estoque.quantidadeDisponivel,
        'ENTRADA',
        totalUnidades,
      ),
      tx,
    );
    await this.repository.createMovimentacao(
      {
        empresaId,
        receitaId,
        tipo: 'ENTRADA',
        origem: 'PRODUCAO',
        quantidade: totalUnidades,
        referenciaId: producaoId,
      },
      tx,
    );
    return toEstoqueProdutoDto(atualizado);
  }

  /**
   * Para o módulo vendas (BE-13), na transação da conclusão: tira `quantidade`
   * do saldo da receita (`SAIDA/VENDA`, `referenciaId` = id da venda). Sem
   * saldo suficiente (ou sem registro, saldo 0) → 422 `ESTOQUE_INSUFICIENTE`.
   */
  async saidaPorVenda(
    receitaId: number,
    quantidade: number,
    vendaId: number,
    empresaId: number,
    tx: PrismaTransaction,
  ): Promise<EstoqueProdutoDto> {
    const estoque = await this.repository.findByReceitaAndEmpresaForUpdate(
      receitaId,
      empresaId,
      tx,
    );
    const saldo = calcularSaidaProdutoAcabado(
      receitaId,
      estoque?.quantidadeDisponivel ?? 0,
      quantidade,
    );
    // Com quantidade > 0, o saldo sem registro (0) já deu 422 acima.
    if (!estoque) throw receitaNaoEncontrada();
    const atualizado = await this.repository.updateQuantidadeDisponivel(
      estoque.id,
      saldo,
      tx,
    );
    await this.repository.createMovimentacao(
      {
        empresaId,
        receitaId,
        tipo: 'SAIDA',
        origem: 'VENDA',
        quantidade,
        referenciaId: vendaId,
      },
      tx,
    );
    return toEstoqueProdutoDto(atualizado);
  }
}

function receitaNaoEncontrada(): NotFoundError {
  return new NotFoundError('RECEITA_NAO_ENCONTRADA', 'Receita não encontrada');
}
