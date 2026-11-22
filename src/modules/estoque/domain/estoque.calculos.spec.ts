import { describe, expect, it } from 'vitest';
import { BusinessRuleError } from '../../../shared/domain/errors/domain.error.js';
import {
  calcularQuantidadeBaixa,
  calcularSaidaProdutoAcabado,
  calcularSaldoAposMovimentacao,
  estoqueNegativo,
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

describe('calcularSaidaProdutoAcabado', () => {
  it('subtrai a quantidade do saldo, com round6', () => {
    expect(calcularSaidaProdutoAcabado(1, 36, 10)).toBe(26);
    expect(calcularSaidaProdutoAcabado(1, 0.3, 0.1)).toBe(0.2);
  });

  it('aceita saída igual ao saldo', () => {
    expect(calcularSaidaProdutoAcabado(1, 10, 10)).toBe(0);
  });

  it('saldo menor que a quantidade → 422 ESTOQUE_INSUFICIENTE', () => {
    const chamar = () => calcularSaidaProdutoAcabado(7, 5, 6);
    expect(chamar).toThrow(BusinessRuleError);
    expect(chamar).toThrow(
      'Estoque insuficiente para a receita 7: disponível 5, solicitado 6',
    );
    try {
      chamar();
    } catch (erro) {
      expect(erro).toMatchObject({ code: 'ESTOQUE_INSUFICIENTE' });
    }
  });
});

describe('estoqueNegativo', () => {
  it('saldo abaixo de zero é negativo', () => {
    expect(estoqueNegativo(-0.5)).toBe(true);
    expect(estoqueNegativo(-150)).toBe(true);
  });

  it('saldo zero ou positivo não é negativo', () => {
    expect(estoqueNegativo(0)).toBe(false);
    expect(estoqueNegativo(1500)).toBe(false);
  });
});
