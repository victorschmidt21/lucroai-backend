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
  /**
   * Custo unitário da receita com o custo médio dos insumos (BE-30); `null`
   * quando ela não tem custo.
   */
  custoUnitario: number | null;
}

export interface ItemVendaCalculado extends ItemNovaVenda {
  margemRealizada: number | null;
  lucroReal: number | null;
}

/** Canal da venda nova (BE-30). */
export interface CanalDaVenda {
  canalId: number | null;
  /** Imposto + taxa do canal + gastos `PERCENTUAL_VENDA`, fração do preço. */
  percentuaisSemLucro: number;
}

/** O que a venda nova grava: o `id` e a `dataVenda` vêm do banco. */
export interface NovaVenda {
  empresaId: number;
  canalId: number | null;
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
   * Dados de uma venda nova: margem e lucro real de cada item (BE-30), total
   * e status `PENDENTE`. Itens vazios → 400 (BE-13, lacuna 25; o DTO já barra
   * antes).
   */
  static nova(
    empresaId: number,
    itens: ItemNovaVenda[],
    canal: CanalDaVenda,
  ): NovaVenda {
    if (itens.length === 0) {
      throw new InvalidInputError(
        'VENDA_SEM_ITENS',
        'A venda precisa ter ao menos um item',
      );
    }
    return {
      empresaId,
      canalId: canal.canalId,
      total: Venda.calcularTotal(itens),
      status: 'PENDENTE',
      itens: itens.map((item) => ({
        ...item,
        margemRealizada: Venda.calcularMargemRealizada(
          item.precoUnitarioReal,
          item.custoUnitario,
        ),
        lucroReal: Venda.calcularLucroReal(
          item.precoUnitarioReal,
          item.custoUnitario,
          canal.percentuaisSemLucro,
        ),
      })),
    };
  }

  /**
   * `(preço − custo) / preço`; `null` sem custo. Pode ser negativa. Sem
   * arredondar (BE-23): o `VendaDto` arredonda com `round4`.
   */
  static calcularMargemRealizada(
    precoUnitarioReal: number,
    custoUnitario: number | null,
  ): number | null {
    if (custoUnitario == null) return null;
    return (precoUnitarioReal - custoUnitario) / precoUnitarioReal;
  }

  /**
   * Lucro real do item (BE-30), na mesma base do lucro do preço (fração do
   * preço): `1 − percentuaisSemLucro − custo ÷ preço`. Vendido pelo preço
   * sugerido do canal, é o lucro configurado. `null` sem custo; pode ser
   * negativo. Sem arredondar: o `VendaDto` usa `round4`.
   */
  static calcularLucroReal(
    precoUnitarioReal: number,
    custoUnitario: number | null,
    percentuaisSemLucro: number,
  ): number | null {
    if (custoUnitario == null) return null;
    return 1 - percentuaisSemLucro - custoUnitario / precoUnitarioReal;
  }

  /** `Σ quantidade × preço`, sem arredondar (o `VendaDto` usa `round2`). */
  static calcularTotal(
    itens: Pick<ItemNovaVenda, 'quantidade' | 'precoUnitarioReal'>[],
  ): number {
    return itens.reduce(
      (acc, item) => acc + item.quantidade * item.precoUnitarioReal,
      0,
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
