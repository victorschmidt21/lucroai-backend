import { describe, expect, it } from 'vitest';
import { round2, round4, round6 } from './arredondamento.js';

describe('arredondamento', () => {
  it('round2 arredonda para 2 casas', () => {
    expect(round2(72.11200000000001)).toBe(72.11);
    expect(round2(1.236)).toBe(1.24);
  });

  it('meio para cima, sem o erro do ponto flutuante (BE-23)', () => {
    // 1.005 é 1.00499999... em binário: toFixed(2) dava '1.00'
    expect(round2(1.005)).toBe(1.01);
    // 3 + 0.05 + 0.255 = 3.3049999999999997
    expect(round2(3 + 0.05 + 0.255)).toBe(3.31);
    expect(round2(0.015 * 101)).toBe(1.52);
    expect(round4(0.00005)).toBe(0.0001);
  });

  it('round4 arredonda para 4 casas', () => {
    expect(round4(0.123456)).toBe(0.1235);
  });

  it('round6 arredonda para 6 casas', () => {
    expect(round6(0.1 + 0.2)).toBe(0.3);
    expect(round6(1.0000004)).toBe(1);
    expect(round6(10 / 3)).toBe(3.333333);
  });

  it('mantém o sinal de valores negativos, sem -0', () => {
    expect(round2(-1.236)).toBe(-1.24);
    expect(round2(-1.005)).toBe(-1.01);
    expect(Object.is(round2(-0.001), 0)).toBe(true);
  });

  it('valores inteiros e grandes não mudam', () => {
    expect(round2(8435)).toBe(8435);
    expect(round2(13492.14)).toBe(13492.14);
  });
});
