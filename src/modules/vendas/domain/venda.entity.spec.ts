import { describe, expect, it } from 'vitest';
import {
  BusinessRuleError,
  InvalidInputError,
} from '../../../shared/domain/errors/domain.error.js';
import { type StatusVenda, Venda } from './venda.entity.js';

// Fórmulas de venda.service.ts (create) do sales-service, sem arredondar
// (BE-23): o VendaDto arredonda a margem com round4 e o total com round2.
const P = 10;

describe('Venda.calcularMargemRealizada', () => {
  it('(preço − custo) / preço, sem arredondar', () => {
    // (12 − 7.3456) / 12 = 0.38786666…
    expect(Venda.calcularMargemRealizada(12, 7.3456)).toBeCloseTo(
      0.3878666667,
      P,
    );
  });

  it('pode ser negativa quando o preço é menor que o custo', () => {
    expect(Venda.calcularMargemRealizada(5, 7.5)).toBe(-0.5);
  });

  it('sem custo na receita → null', () => {
    expect(Venda.calcularMargemRealizada(12, null)).toBeNull();
  });
});

describe('Venda.calcularTotal', () => {
  it('Σ quantidade × preço, sem arredondar', () => {
    expect(
      Venda.calcularTotal([
        { quantidade: 3, precoUnitarioReal: 0.1 },
        { quantidade: 2, precoUnitarioReal: 10.555 },
      ]),
    ).toBeCloseTo(21.41, P);
  });
});

describe('Venda.nova', () => {
  it('calcula a margem de cada item, o total e nasce PENDENTE', () => {
    expect(
      Venda.nova(7, [
        {
          receitaId: 1,
          quantidade: 2,
          precoUnitarioReal: 12,
          custoUnitario: 7.3456,
        },
        {
          receitaId: 2,
          quantidade: 1,
          precoUnitarioReal: 8.5,
          custoUnitario: null,
        },
      ]),
    ).toEqual({
      empresaId: 7,
      total: 32.5,
      status: 'PENDENTE',
      itens: [
        {
          receitaId: 1,
          quantidade: 2,
          precoUnitarioReal: 12,
          custoUnitario: 7.3456,
          margemRealizada: expect.closeTo(0.3878666667, P),
        },
        {
          receitaId: 2,
          quantidade: 1,
          precoUnitarioReal: 8.5,
          custoUnitario: null,
          margemRealizada: null,
        },
      ],
    });
  });

  it('sem itens → 400 VENDA_SEM_ITENS', () => {
    expect(() => Venda.nova(7, [])).toThrow(InvalidInputError);
  });
});

describe('Venda.alterarStatus', () => {
  const venda = (status: StatusVenda) =>
    Venda.restaurar({ id: 1, empresaId: 7, status });

  it.each<StatusVenda>(['CONCLUIDA', 'CANCELADA'])('PENDENTE → %s', (novo) => {
    const v = venda('PENDENTE');
    v.alterarStatus(novo);
    expect(v.status).toBe(novo);
  });

  it.each<[StatusVenda, StatusVenda]>([
    ['CONCLUIDA', 'CANCELADA'],
    ['CONCLUIDA', 'PENDENTE'],
    ['CANCELADA', 'CONCLUIDA'],
    ['CANCELADA', 'CANCELADA'],
  ])('%s → %s dá 422 VENDA_FINALIZADA', (atual, novo) => {
    const v = venda(atual);
    expect(() => v.alterarStatus(novo)).toThrow(
      expect.objectContaining({
        code: 'VENDA_FINALIZADA',
        message: 'Venda já finalizada não pode ser alterada',
      }),
    );
    expect(v.status).toBe(atual);
  });

  it('PENDENTE → PENDENTE dá 422 TRANSICAO_INVALIDA', () => {
    const v = venda('PENDENTE');
    expect(() => v.alterarStatus('PENDENTE')).toThrow(BusinessRuleError);
    expect(v.status).toBe('PENDENTE');
  });
});
