import { describe, expect, it } from 'vitest';
import {
  calcularProducao,
  type GastoParaProducao,
} from './producoes.calculos.js';

// BE-30: consumo dos insumos ao custo médio + gastos mensais pelo uso de
// forno, uma vez só. Pão francês da BE-28: ingredientes de R$ 3,305 por lote,
// rendimento 50, gastos mensais de R$ 2.435 e capacidade de 100 fornadas.
const P = 10;
const aluguel: GastoParaProducao = {
  id: 1,
  descricao: 'Aluguel',
  valor: 1800,
  tipo: 'MENSAL',
};
const luz: GastoParaProducao = {
  id: 2,
  descricao: 'Luz',
  valor: 450,
  tipo: 'MENSAL',
};
const gas: GastoParaProducao = {
  id: 3,
  descricao: 'Gás',
  valor: 185,
  tipo: 'MENSAL',
};
const saquinho: GastoParaProducao = {
  id: 4,
  descricao: 'Saquinho',
  valor: 0.1,
  tipo: 'POR_UNIDADE',
};
const comissao: GastoParaProducao = {
  id: 5,
  descricao: 'Comissão',
  valor: 0.12,
  tipo: 'PERCENTUAL_VENDA',
};
const pao = { ingredientesLote: 3.305, rendimento: 50, usoPorLote: 1 };
const CAPACIDADE = 100;

describe('calcularProducao (BE-30)', () => {
  it('2 lotes do pão cobram os gastos mensais de 2 fornadas, uma vez só', () => {
    expect(
      calcularProducao(
        pao,
        2,
        [aluguel, luz, gas, saquinho, comissao],
        CAPACIDADE,
      ),
    ).toEqual({
      totalUnidades: 100,
      // 3,305 × 2 + 2.435 × 2 ÷ 100 = 6,61 + 48,70
      custoTotal: expect.closeTo(55.31, P),
      custoUnitario: expect.closeTo(0.5531, P),
      custoTrabalho: 0,
      rateios: [
        { gastoIndiretoId: 1, descricao: 'Aluguel', valorRateado: 36 },
        { gastoIndiretoId: 2, descricao: 'Luz', valorRateado: 9 },
        {
          gastoIndiretoId: 3,
          descricao: 'Gás',
          valorRateado: expect.closeTo(3.7, P),
        },
      ],
    });
  });

  it('o custo total é ingredientes + rateios, sem somar o custo da receita de novo', () => {
    const calculo = calcularProducao(pao, 2, [aluguel, luz, gas], CAPACIDADE);
    const totalRateio = calculo.rateios.reduce(
      (acc, r) => acc + r.valorRateado,
      0,
    );
    expect(calculo.custoTotal).toBeCloseTo(3.305 * 2 + totalRateio, P);
  });

  it('o mensal usa o usoPorLote da receita', () => {
    const calculo = calcularProducao(
      { ...pao, usoPorLote: 2 },
      3,
      [aluguel],
      CAPACIDADE,
    );
    // 1800 × 2 × 3 ÷ 100
    expect(calculo.rateios[0].valorRateado).toBe(108);
  });

  it('POR_UNIDADE e PERCENTUAL_VENDA não geram rateio', () => {
    expect(
      calcularProducao(pao, 1, [saquinho, comissao], CAPACIDADE),
    ).toMatchObject({
      custoTotal: 3.305,
      rateios: [],
    });
  });

  it('sem gastos, só os ingredientes', () => {
    expect(calcularProducao(pao, 3, [], CAPACIDADE)).toEqual({
      totalUnidades: 150,
      custoTotal: expect.closeTo(9.915, P),
      custoUnitario: expect.closeTo(0.0661, P),
      custoTrabalho: 0,
      rateios: [],
    });
  });

  it('sem unidades, custo unitário 0', () => {
    expect(
      calcularProducao(
        { ingredientesLote: 10, rendimento: 0 },
        2,
        [],
        CAPACIDADE,
      ),
    ).toMatchObject({ totalUnidades: 0, custoTotal: 20, custoUnitario: 0 });
  });
});

describe('calcularProducao com seu trabalho (BE-47)', () => {
  // 40 min por lote a R$ 18,75 a hora = R$ 12,50 por lote.
  const paoComTrabalho = { ...pao, trabalhoLote: 12.5 };

  it('2 lotes com R$ 12,50 de trabalho por lote gravam 25 e somam 25 ao custo total', () => {
    const sem = calcularProducao(pao, 2, [aluguel, luz, gas], CAPACIDADE);
    const com = calcularProducao(
      paoComTrabalho,
      2,
      [aluguel, luz, gas],
      CAPACIDADE,
    );
    expect(com.custoTrabalho).toBe(25);
    expect(com.custoTotal).toBeCloseTo(sem.custoTotal + 25, P);
    // 55,31 + 25 = 80,31 ÷ 100 unidades boas
    expect(com.custoUnitario).toBeCloseTo(0.8031, P);
    expect(com.rateios).toEqual(sem.rateios);
  });

  it('o trabalho das unidades perdidas fica nas boas: o custo é por lote', () => {
    // Rendimento já é de unidades boas; o trabalho do lote inteiro se divide por elas.
    const calculo = calcularProducao(
      { ingredientesLote: 0, rendimento: 8, trabalhoLote: 12.5 },
      2,
      [],
      CAPACIDADE,
    );
    expect(calculo).toMatchObject({
      totalUnidades: 16,
      custoTotal: 25,
      custoTrabalho: 25,
      custoUnitario: 1.5625,
    });
  });

  it('sem trabalho informado, custoTrabalho 0 e nada muda', () => {
    expect(calcularProducao(pao, 3, [], CAPACIDADE).custoTrabalho).toBe(0);
  });
});
