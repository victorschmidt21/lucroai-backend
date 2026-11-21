import { describe, expect, it } from 'vitest';
import { calcularValorRateado } from './gastos-indiretos.calculos.js';

describe('calcularValorRateado', () => {
  it('FIXO não depende de lotes nem de unidades', () => {
    expect(
      calcularValorRateado({ valor: 1800, metodoRateio: 'FIXO' }, 3, 150),
    ).toBe(1800);
  });

  it('FIXO não arredonda o valor (BE-23)', () => {
    expect(
      calcularValorRateado({ valor: 10.456, metodoRateio: 'FIXO' }, 1, 1),
    ).toBe(10.456);
  });

  it('PROPORCIONAL multiplica pelos lotes', () => {
    expect(
      calcularValorRateado(
        { valor: 12.5, metodoRateio: 'PROPORCIONAL' },
        3,
        150,
      ),
    ).toBe(37.5);
  });

  it('PROPORCIONAL não arredonda o produto (BE-23)', () => {
    expect(
      calcularValorRateado(
        { valor: 0.125, metodoRateio: 'PROPORCIONAL' },
        3,
        30,
      ),
    ).toBe(0.375);
  });

  it('POR_UNIDADE multiplica pelo total de unidades', () => {
    expect(
      calcularValorRateado({ valor: 0.25, metodoRateio: 'POR_UNIDADE' }, 2, 40),
    ).toBe(10);
  });

  it('POR_UNIDADE não arredonda o produto (BE-23)', () => {
    // era round2 → 1.51
    expect(
      calcularValorRateado(
        { valor: 0.015, metodoRateio: 'POR_UNIDADE' },
        1,
        101,
      ),
    ).toBeCloseTo(1.515, 12);
  });

  it('valor 0 dá rateio 0', () => {
    expect(
      calcularValorRateado({ valor: 0, metodoRateio: 'POR_UNIDADE' }, 2, 40),
    ).toBe(0);
  });
});
