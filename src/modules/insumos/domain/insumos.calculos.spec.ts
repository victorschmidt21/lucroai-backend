import { describe, expect, it } from 'vitest';
import { calcularCustoUnitario } from './insumos.calculos.js';

describe('calcularCustoUnitario', () => {
  it('divide o valor pago pela quantidade base', () => {
    // Farinha: R$ 5,00 por 1000 g
    expect(calcularCustoUnitario(5, 1000)).toBe(0.005);
  });

  it('não arredonda o resultado', () => {
    expect(calcularCustoUnitario(10, 3)).toBe(10 / 3);
  });

  it('valor pago 0 dá custo 0', () => {
    expect(calcularCustoUnitario(0, 500)).toBe(0);
  });

  it('quantidade base ≤ 0 dá custo 0', () => {
    expect(calcularCustoUnitario(10, 0)).toBe(0);
    expect(calcularCustoUnitario(10, -1)).toBe(0);
  });
});
