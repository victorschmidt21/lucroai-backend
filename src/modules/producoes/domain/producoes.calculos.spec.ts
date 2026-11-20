import { describe, expect, it } from 'vitest';
import {
  calcularProducao,
  type GastoParaProducao,
} from './producoes.calculos.js';

// Números conferidos numa réplica literal de producao.service.ts (create) do
// operations-service.
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
      custoTotal: 13492.14, // 3884.7 × 3 + 1800 + 37.5 + 0.54
      custoUnitario: 374.78,
      rateios: [
        { gastoIndiretoId: 1, descricao: 'Aluguel', valorRateado: 1800 },
        { gastoIndiretoId: 2, descricao: 'Embalagem', valorRateado: 37.5 },
        { gastoIndiretoId: 3, descricao: 'Etiqueta', valorRateado: 0.54 },
      ],
    });
  });

  it('lista de gastos vazia não rateia nada', () => {
    expect(calcularProducao(bolo, 3, [])).toEqual({
      totalUnidades: 36,
      custoTotal: 11654.1,
      custoUnitario: 323.73,
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
      custoTotal: 1.5,
      custoUnitario: 0.01,
    });
  });

  it('arredonda com o round2 de toFixed', () => {
    // 0.015 × 50 = 0.75; 9.92 + 0.75 = 10.67; 10.67 / 50 = 0.2134
    expect(
      calcularProducao({ custoProducao: 9.92, rendimento: 50 }, 1, [etiqueta]),
    ).toMatchObject({ custoTotal: 10.67, custoUnitario: 0.21 });
    // (1.005).toFixed(2) dá '1.00'
    expect(
      calcularProducao({ custoProducao: 1.005, rendimento: 1 }, 1, []),
    ).toMatchObject({ custoTotal: 1, custoUnitario: 1 });
  });

  it('sem unidades, custo unitário 0', () => {
    expect(
      calcularProducao({ custoProducao: 10, rendimento: 0 }, 2, []),
    ).toMatchObject({ totalUnidades: 0, custoTotal: 20, custoUnitario: 0 });
  });
});
