import { describe, expect, it } from 'vitest';
import type { GastoParaRateio } from '../../gastos-indiretos/domain/gastos-indiretos.calculos.js';
import {
  calcularCustoInvisivel,
  calcularCustoItem,
  calcularCustoReceita,
  calcularPrecoSugerido,
  precisaRecalcular,
  resolverMargem,
} from './receitas.calculos.js';

// Insumos e gastos do seed dos microsserviços (catalog-service). Os números
// esperados saíram da aritmética do custo.service.ts e do
// default-custo-invisivel-result.provider.ts do recipe-service.
const custo = {
  farinha: 15 / 5,
  sal: 2.5 / 1,
  fermento: 8.5 / 500,
};
const paoFrances = [
  { insumoId: 1, quantidade: 1, custoUnitario: custo.farinha },
  { insumoId: 8, quantidade: 0.02, custoUnitario: custo.sal },
  { insumoId: 6, quantidade: 15, custoUnitario: custo.fermento },
];
const gastosSeed: GastoParaRateio[] = [
  { valor: 450, metodoRateio: 'PROPORCIONAL' },
  { valor: 1800, metodoRateio: 'FIXO' },
  { valor: 185, metodoRateio: 'PROPORCIONAL' },
  { valor: 120, metodoRateio: 'POR_UNIDADE' },
];

describe('calcularCustoItem', () => {
  it('arredonda quantidade × custo unitário com o round2 de toFixed', () => {
    // 15 × 0.017 = 0.255… e toFixed(2) dá '0.26', como no seed
    expect(calcularCustoItem(15, custo.fermento)).toBe(0.26);
    expect(calcularCustoItem(0.02, custo.sal)).toBe(0.05);
  });
});

describe('calcularCustoInvisivel', () => {
  it('soma o rateio de 1 lote dos três métodos', () => {
    // FIXO 1800 + PROPORCIONAL (450 + 185) × 1 + POR_UNIDADE 120 × 50
    expect(calcularCustoInvisivel(gastosSeed, 50)).toBe(8435);
  });

  it('cada método isolado', () => {
    expect(
      calcularCustoInvisivel([{ valor: 12.5, metodoRateio: 'FIXO' }], 40),
    ).toBe(12.5);
    expect(
      calcularCustoInvisivel(
        [{ valor: 12.5, metodoRateio: 'PROPORCIONAL' }],
        40,
      ),
    ).toBe(12.5);
    expect(
      calcularCustoInvisivel(
        [{ valor: 0.015, metodoRateio: 'POR_UNIDADE' }],
        101,
      ),
    ).toBe(1.51);
  });

  it('sem gastos é 0', () => {
    expect(calcularCustoInvisivel([], 12)).toBe(0);
  });
});

describe('calcularPrecoSugerido', () => {
  it('com margem', () => {
    expect(calcularPrecoSugerido(0.81, 0.5)).toBe(1.22);
  });

  it('sem margem é null', () => {
    expect(calcularPrecoSugerido(0.81, null)).toBeNull();
  });

  it('margem 0 mantém o custo', () => {
    expect(calcularPrecoSugerido(0.81, 0)).toBe(0.81);
  });
});

describe('calcularCustoReceita', () => {
  it('Pão Francês do seed, sem gastos, bate com os valores salvos', () => {
    expect(
      calcularCustoReceita({
        itens: paoFrances,
        rendimento: 50,
        margemLucro: 0.6,
        gastos: [],
      }),
    ).toEqual({
      itens: [
        { insumoId: 1, quantidade: 1, custoCalculado: 3 },
        { insumoId: 8, quantidade: 0.02, custoCalculado: 0.05 },
        { insumoId: 6, quantidade: 15, custoCalculado: 0.26 },
      ],
      custoInvisivel: 0,
      custoProducao: 3.31,
      custoUnitario: 0.07,
      precoSugerido: 0.11,
    });
  });

  it('Pão Francês com os gastos do seed soma o custo invisível (lacuna 18)', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      margemLucro: 0.6,
      gastos: gastosSeed,
    });
    expect(r.custoInvisivel).toBe(8435);
    expect(r.custoProducao).toBe(8438.31);
    expect(r.custoUnitario).toBe(168.77);
    expect(r.precoSugerido).toBe(270.03);
  });

  it('Bolo de Chocolate do seed com gastos', () => {
    const r = calcularCustoReceita({
      itens: [
        { insumoId: 1, quantidade: 0.25, custoUnitario: 15 / 5 },
        { insumoId: 2, quantidade: 0.2, custoUnitario: 8.8 / 2 },
        { insumoId: 3, quantidade: 100, custoUnitario: 12 / 500 },
        { insumoId: 4, quantidade: 3, custoUnitario: 9 / 12 },
        { insumoId: 5, quantidade: 0.2, custoUnitario: 5 / 1 },
        { insumoId: 7, quantidade: 50, custoUnitario: 9 / 200 },
        { insumoId: 6, quantidade: 10, custoUnitario: 8.5 / 500 },
      ],
      rendimento: 12,
      margemLucro: 0.5,
      gastos: gastosSeed,
    });
    expect(r.itens.map((i) => i.custoCalculado)).toEqual([
      0.75, 0.88, 2.4, 2.25, 1, 2.25, 0.17,
    ]);
    expect(r.custoInvisivel).toBe(3875);
    expect(r.custoProducao).toBe(3884.7);
    expect(r.custoUnitario).toBe(323.72);
    expect(r.precoSugerido).toBe(485.58);
  });

  it('sem margem não tem preço sugerido', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      margemLucro: null,
      gastos: [],
    });
    expect(r.custoUnitario).toBe(0.07);
    expect(r.precoSugerido).toBeNull();
  });

  it.each([0, -1])('rendimento %d → 400 RENDIMENTO_INVALIDO', (rendimento) => {
    expect(() =>
      calcularCustoReceita({
        itens: paoFrances,
        rendimento,
        margemLucro: null,
        gastos: [],
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'RENDIMENTO_INVALIDO',
        message: 'Rendimento da receita deve ser maior que zero',
      }),
    );
  });
});

describe('resolverMargem', () => {
  it('omitida mantém a salva', () => {
    expect(resolverMargem(undefined, 0.6)).toBe(0.6);
  });

  it('null remove a margem (lacuna 21)', () => {
    expect(resolverMargem(null, 0.6)).toBeNull();
  });

  it('número substitui', () => {
    expect(resolverMargem(0.3, 0.6)).toBe(0.3);
    expect(resolverMargem(0, null)).toBe(0);
  });

  it('com margem null o recálculo zera o preço sugerido', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      margemLucro: resolverMargem(null, 0.6),
      gastos: [],
    });
    expect(r.precoSugerido).toBeNull();
  });
});

describe('precisaRecalcular', () => {
  it('só nome ou unidade não recalcula', () => {
    expect(precisaRecalcular({})).toBe(false);
  });

  it('insumos, rendimento ou margem (inclusive null) recalculam', () => {
    expect(precisaRecalcular({ insumos: [] })).toBe(true);
    expect(precisaRecalcular({ rendimento: 10 })).toBe(true);
    expect(precisaRecalcular({ margem_lucro: null })).toBe(true);
  });
});
