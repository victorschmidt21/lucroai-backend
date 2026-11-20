import { describe, expect, it } from 'vitest';
import { calcularValorRateado } from './gastos-indiretos.calculos.js';

describe('calcularValorRateado', () => {
  it('FIXO não depende de lotes nem de unidades', () => {
    expect(
      calcularValorRateado({ valor: 1800, metodoRateio: 'FIXO' }, 3, 150),
    ).toBe(1800);
  });

  it('FIXO arredonda o valor com round2', () => {
    expect(
      calcularValorRateado({ valor: 10.456, metodoRateio: 'FIXO' }, 1, 1),
    ).toBe(10.46);
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

  it('PROPORCIONAL arredonda o produto com round2', () => {
    // 0.1 × 3 = 0.30000000000000004
    expect(
      calcularValorRateado({ valor: 0.1, metodoRateio: 'PROPORCIONAL' }, 3, 30),
    ).toBe(0.3);
  });

  it('POR_UNIDADE multiplica pelo total de unidades', () => {
    expect(
      calcularValorRateado({ valor: 0.25, metodoRateio: 'POR_UNIDADE' }, 2, 40),
    ).toBe(10);
  });

  it('POR_UNIDADE arredonda com o round2 de toFixed', () => {
    // 0.015 × 101 = 1.515 no ponto flutuante, e toFixed(2) dá '1.51'
    expect(
      calcularValorRateado(
        { valor: 0.015, metodoRateio: 'POR_UNIDADE' },
        1,
        101,
      ),
    ).toBe(1.51);
  });

  it('valor 0 dá rateio 0', () => {
    expect(
      calcularValorRateado({ valor: 0, metodoRateio: 'POR_UNIDADE' }, 2, 40),
    ).toBe(0);
  });
});
