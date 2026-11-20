import { round2, round4 } from '../../../shared/domain/arredondamento.js';
import {
  BusinessRuleError,
  InvalidInputError,
} from '../../../shared/domain/errors/domain.error.js';

/** Mesmos valores do enum `StatusVenda` do Prisma. */
export type StatusVenda = 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA';

/** Item informado no registro, com o custo da receita já buscado. */
export interface ItemNovaVenda {
  receitaId: number;
  quantidade: number;
  precoUnitarioReal: number;
  /** `custoUnitario` salvo na receita; `null` quando ela não tem custo. */
  custoUnitario: number | null;
}

export interface ItemVendaCalculado extends ItemNovaVenda {
  margemRealizada: number | null;
}

/** O que a venda nova grava: o `id` e a `dataVenda` vêm do banco. */
export interface NovaVenda {
  empresaId: number;
  total: number;
  status: StatusVenda;
  itens: ItemVendaCalculado[];
}

export interface DadosVenda {
  id: number;
  empresaId: number;
  status: StatusVenda;
}

/**
 * Venda: a única entidade de classe do projeto, porque tem ciclo de vida.
 * Total, margem e transições de status ficam aqui. Origem: venda.service.ts
 * (`create`, `atualizarStatus`) do sales-service.
 */
export class Venda {
  private constructor(
    readonly id: number,
    readonly empresaId: number,
    private statusAtual: StatusVenda,
  ) {}

  static restaurar(dados: DadosVenda): Venda {
    return new Venda(dados.id, dados.empresaId, dados.status);
  }

  /**
   * Dados de uma venda nova: margem de cada item, total e status `PENDENTE`.
   * Itens vazios → 400 (BE-13, lacuna 25; o DTO já barra antes).
   */
  static nova(empresaId: number, itens: ItemNovaVenda[]): NovaVenda {
    if (itens.length === 0) {
      throw new InvalidInputError(
        'VENDA_SEM_ITENS',
        'A venda precisa ter ao menos um item',
      );
    }
    return {
      empresaId,
      total: Venda.calcularTotal(itens),
      status: 'PENDENTE',
      itens: itens.map((item) => ({
        ...item,
        margemRealizada: Venda.calcularMargemRealizada(
          item.precoUnitarioReal,
          item.custoUnitario,
        ),
      })),
    };
  }

  /** `round4((preço − custo) / preço)`; `null` sem custo. Pode ser negativa. */
  static calcularMargemRealizada(
    precoUnitarioReal: number,
    custoUnitario: number | null,
  ): number | null {
    if (custoUnitario == null) return null;
    return round4((precoUnitarioReal - custoUnitario) / precoUnitarioReal);
  }

  /** `round2(Σ quantidade × preço)`. */
  static calcularTotal(
    itens: Pick<ItemNovaVenda, 'quantidade' | 'precoUnitarioReal'>[],
  ): number {
    return round2(
      itens.reduce(
        (acc, item) => acc + item.quantidade * item.precoUnitarioReal,
        0,
      ),
    );
  }

  get status(): StatusVenda {
    return this.statusAtual;
  }

  /**
   * Só `PENDENTE` muda, e só para `CONCLUIDA` ou `CANCELADA`. Venda já
   * concluída ou cancelada → 422 `VENDA_FINALIZADA`, com a mensagem de hoje
   * (era 400). `PENDENTE` → `PENDENTE` → 422 `TRANSICAO_INVALIDA`.
   */
  alterarStatus(novo: StatusVenda): void {
    if (this.statusAtual !== 'PENDENTE') {
      throw vendaFinalizada();
    }
    if (novo === 'PENDENTE') {
      throw new BusinessRuleError(
        'TRANSICAO_INVALIDA',
        'Venda pendente só pode ser concluída ou cancelada',
      );
    }
    this.statusAtual = novo;
  }
}

export function vendaFinalizada(): BusinessRuleError {
  return new BusinessRuleError(
    'VENDA_FINALIZADA',
    'Venda já finalizada não pode ser alterada',
  );
}
