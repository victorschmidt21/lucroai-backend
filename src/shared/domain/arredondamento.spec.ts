import { describe, expect, it } from 'vitest';
import { round2, round4, round6 } from './arredondamento.js';

describe('arredondamento', () => {
  it('round2 arredonda para 2 casas', () => {
    expect(round2(72.11200000000001)).toBe(72.11);
    expect(round2(1.236)).toBe(1.24);
  });

  it('round2 segue o toFixed nos casos de borda do ponto flutuante', () => {
    // 1.005 é 1.00499999... em binário: toFixed(2) dá '1.00', não '1.01'
    expect(round2(1.005)).toBe(1);
  });

  it('round4 arredonda para 4 casas', () => {
    expect(round4(0.123456)).toBe(0.1235);
  });

  it('round6 arredonda para 6 casas', () => {
    expect(round6(0.1 + 0.2)).toBe(0.3);
    expect(round6(1.0000004)).toBe(1);
  });

  it('mantém o sinal de valores negativos', () => {
    expect(round2(-1.236)).toBe(-1.24);
  });
});
