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
  tipo: 'MENSAL',
};
const comissao: GastoParaProducao = {
  id: 2,
  descricao: 'Comissão',
  valor: 0.12,
  tipo: 'PERCENTUAL_VENDA',
};
const etiqueta: GastoParaProducao = {
  id: 3,
  descricao: 'Etiqueta',
  valor: 0.015,
  tipo: 'POR_UNIDADE',
};
const bolo = { custoProducao: 3884.7, rendimento: 12 };
const CAPACIDADE = 40;

describe('calcularProducao', () => {
  it('total de unidades, rateio de cada tipo, custo total e unitário', () => {
    expect(
      calcularProducao(bolo, 3, [aluguel, comissao, etiqueta], CAPACIDADE),
    ).toEqual({
      totalUnidades: 36,
      // 3884.7 × 3 + 1800 × 3 ÷ 40 + 0.015 × 36
      custoTotal: expect.closeTo(11789.64, P),
      custoUnitario: expect.closeTo(11789.64 / 36, P),
      rateios: [
        { gastoIndiretoId: 1, descricao: 'Aluguel', valorRateado: 135 },
        {
          gastoIndiretoId: 3,
          descricao: 'Etiqueta',
          valorRateado: expect.closeTo(0.54, P),
        },
      ],
    });
  });

  it('gasto mensal de R$ 1.800 não entra inteiro num lote (BE-26)', () => {
    const calculo = calcularProducao(
      { custoProducao: 0, rendimento: 50 },
      1,
      [aluguel],
      CAPACIDADE,
    );
    expect(calculo.rateios[0].valorRateado).toBe(45);
    expect(calculo.custoTotal).toBe(45);
  });

  it('o mensal usa o usoPorLote da receita (BE-27)', () => {
    const calculo = calcularProducao(
      { custoProducao: 0, rendimento: 50, usoPorLote: 2 },
      3,
      [aluguel, etiqueta],
      CAPACIDADE,
    );
    // 1800 × 2 × 3 ÷ 40; a etiqueta segue por unidade (0.015 × 150)
    expect(calculo.rateios[0].valorRateado).toBe(270);
    expect(calculo.rateios[1].valorRateado).toBeCloseTo(2.25, P);
  });

  it('PERCENTUAL_VENDA não é custo e não gera rateio', () => {
    expect(calcularProducao(bolo, 1, [comissao], CAPACIDADE)).toMatchObject({
      custoTotal: 3884.7,
      rateios: [],
    });
  });

  it('lista de gastos vazia não rateia nada', () => {
    expect(calcularProducao(bolo, 3, [], CAPACIDADE)).toEqual({
      totalUnidades: 36,
      custoTotal: expect.closeTo(11654.1, P),
      custoUnitario: expect.closeTo(323.725, P),
      rateios: [],
    });
  });

  it('receita sem custo salvo usa 0 e fica só com o rateio', () => {
    expect(
      calcularProducao(
        { custoProducao: undefined, rendimento: 50 },
        2,
        [etiqueta],
        CAPACIDADE,
      ),
    ).toMatchObject({
      totalUnidades: 100,
      custoTotal: expect.closeTo(1.5, P),
      custoUnitario: expect.closeTo(0.015, P),
    });
  });

  it('não arredonda o custo total nem o unitário (BE-23)', () => {
    // 0.015 × 50 = 0.75; 9.915 + 0.75 = 10.665; 10.665 / 50 = 0.2133
    expect(
      calcularProducao(
        { custoProducao: 9.915, rendimento: 50 },
        1,
        [etiqueta],
        CAPACIDADE,
      ),
    ).toMatchObject({
      custoTotal: expect.closeTo(10.665, P),
      custoUnitario: expect.closeTo(0.2133, P),
    });
  });

  it('sem unidades, custo unitário 0', () => {
    expect(
      calcularProducao({ custoProducao: 10, rendimento: 0 }, 2, [], CAPACIDADE),
    ).toMatchObject({ totalUnidades: 0, custoTotal: 20, custoUnitario: 0 });
  });
});
