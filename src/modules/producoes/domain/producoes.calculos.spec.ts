import { describe, expect, it } from 'vitest';
import {
  calcularProducao,
  type GastoParaProducao,
} from './producoes.calculos.js';

// Fórmula de producao.service.ts (create) do operations-service, sem
// arredondamento intermediário (BE-23).
const P = 10;
const aluguel: GastoParaProducao = {
  id: 1,
  descricao: 'Aluguel',
  valor: 1800,
  metodoRateio: 'FIXO',
};
const embalagem: GastoParaProducao = {
  id: 2,
  descricao: 'Embalagem',
  valor: 12.5,
  metodoRateio: 'PROPORCIONAL',
};
const etiqueta: GastoParaProducao = {
  id: 3,
  descricao: 'Etiqueta',
  valor: 0.015,
  metodoRateio: 'POR_UNIDADE',
};
const bolo = { custoProducao: 3884.7, rendimento: 12 };

describe('calcularProducao', () => {
  it('total de unidades, rateio de cada método, custo total e unitário', () => {
    expect(calcularProducao(bolo, 3, [aluguel, embalagem, etiqueta])).toEqual({
      totalUnidades: 36,
      custoTotal: expect.closeTo(13492.14, P), // 3884.7 × 3 + 1800 + 37.5 + 0.54
      custoUnitario: expect.closeTo(13492.14 / 36, P),
      rateios: [
        { gastoIndiretoId: 1, descricao: 'Aluguel', valorRateado: 1800 },
        { gastoIndiretoId: 2, descricao: 'Embalagem', valorRateado: 37.5 },
        {
          gastoIndiretoId: 3,
          descricao: 'Etiqueta',
          valorRateado: expect.closeTo(0.54, P),
        },
      ],
    });
  });

  it('lista de gastos vazia não rateia nada', () => {
    expect(calcularProducao(bolo, 3, [])).toEqual({
      totalUnidades: 36,
      custoTotal: expect.closeTo(11654.1, P),
      custoUnitario: expect.closeTo(323.725, P),
      rateios: [],
    });
  });

  it('receita sem custo salvo usa 0 e fica só com o rateio', () => {
    expect(
      calcularProducao({ custoProducao: undefined, rendimento: 50 }, 2, [
        etiqueta,
      ]),
    ).toMatchObject({
      totalUnidades: 100,
      custoTotal: expect.closeTo(1.5, P),
      custoUnitario: expect.closeTo(0.015, P),
    });
  });

  it('não arredonda o custo total nem o unitário (BE-23)', () => {
    // 0.015 × 50 = 0.75; 9.915 + 0.75 = 10.665; 10.665 / 50 = 0.2133
    expect(
      calcularProducao({ custoProducao: 9.915, rendimento: 50 }, 1, [etiqueta]),
    ).toMatchObject({
      custoTotal: expect.closeTo(10.665, P),
      custoUnitario: expect.closeTo(0.2133, P),
    });
  });

  it('sem unidades, custo unitário 0', () => {
    expect(
      calcularProducao({ custoProducao: 10, rendimento: 0 }, 2, []),
    ).toMatchObject({ totalUnidades: 0, custoTotal: 20, custoUnitario: 0 });
  });
});
