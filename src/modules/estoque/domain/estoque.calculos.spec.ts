import { describe, expect, it } from 'vitest';
import {
  calcularQuantidadeBaixa,
  calcularSaldoAposMovimentacao,
} from './estoque.calculos.js';

describe('calcularSaldoAposMovimentacao', () => {
  it('entrada soma a quantidade ao saldo', () => {
    expect(calcularSaldoAposMovimentacao(1000, 'ENTRADA', 500)).toBe(1500);
  });

  it('saída subtrai a quantidade do saldo', () => {
    expect(calcularSaldoAposMovimentacao(1000, 'SAIDA', 250)).toBe(750);
  });

  it('saída maior que o saldo deixa o saldo negativo', () => {
    expect(calcularSaldoAposMovimentacao(100, 'SAIDA', 250)).toBe(-150);
  });

  it('arredonda o saldo com round6', () => {
    // 0.1 + 0.2 = 0.30000000000000004 sem arredondar
    expect(calcularSaldoAposMovimentacao(0.1, 'ENTRADA', 0.2)).toBe(0.3);
    expect(calcularSaldoAposMovimentacao(0.3, 'SAIDA', 0.1)).toBe(0.2);
    expect(calcularSaldoAposMovimentacao(1, 'ENTRADA', 0.0000004)).toBe(1);
  });
});

describe('calcularQuantidadeBaixa', () => {
  it('multiplica a quantidade por lote pelos lotes', () => {
    expect(calcularQuantidadeBaixa(500, 3)).toBe(1500);
  });

  it('arredonda com round6', () => {
    // 0.1 × 3 = 0.30000000000000004 sem arredondar
    expect(calcularQuantidadeBaixa(0.1, 3)).toBe(0.3);
  });
});
