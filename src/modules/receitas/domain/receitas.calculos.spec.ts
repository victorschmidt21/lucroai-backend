import { describe, expect, it } from 'vitest';
import type { GastoParaRateio } from '../../gastos-indiretos/domain/gastos-indiretos.calculos.js';
import {
  calcularCustoInvisivel,
  calcularCustoItem,
  calcularCustoReceita,
  calcularPrecoSugerido,
  calcularPrecoVenda,
  precisaRecalcular,
  resolverMargem,
  simularCenario,
} from './receitas.calculos.js';

// Insumos e gastos do seed dos microsserviços (catalog-service). As fórmulas
// são as do custo.service.ts e do default-custo-invisivel-result.provider.ts
// do recipe-service, mas sem arredondamento intermediário (BE-23): os valores
// esperados são os exatos, comparados com `toBeCloseTo` por causa do ponto
// flutuante. Quem arredonda são os DTOs de resposta.
const P = 10;
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
  it('quantidade × custo unitário, sem arredondar (BE-23)', () => {
    // 15 g × R$ 0,017 = R$ 0,255 (era round2 → 0,26)
    expect(calcularCustoItem(15, custo.fermento)).toBeCloseTo(0.255, P);
    expect(calcularCustoItem(0.02, custo.sal)).toBeCloseTo(0.05, P);
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
    ).toBeCloseTo(1.515, P);
  });

  it('sem gastos é 0', () => {
    expect(calcularCustoInvisivel([], 12)).toBe(0);
  });

  it('N lotes: FIXO uma vez, PROPORCIONAL × lotes, POR_UNIDADE × total de unidades', () => {
    // 1800 + (450 + 185) × 3 + 120 × 150
    expect(calcularCustoInvisivel(gastosSeed, 50, 3)).toBe(21705);
  });
});

describe('calcularPrecoSugerido', () => {
  it('com margem, sem arredondar', () => {
    expect(calcularPrecoSugerido(0.81, 0.5)).toBeCloseTo(1.215, P);
  });

  it('sem margem é null', () => {
    expect(calcularPrecoSugerido(0.81, null)).toBeNull();
  });

  it('margem 0 mantém o custo', () => {
    expect(calcularPrecoSugerido(0.81, 0)).toBe(0.81);
  });
});

describe('calcularCustoReceita', () => {
  it('custo dos ingredientes sem arredondar os itens: R$ 3,305, não R$ 3,31 (BE-23)', () => {
    // Farinha 1 kg a R$ 3,00/kg, sal 0,02 kg a R$ 2,50/kg e fermento 15 g a
    // R$ 0,017/g.
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
        {
          insumoId: 8,
          quantidade: 0.02,
          custoCalculado: expect.closeTo(0.05, P),
        },
        {
          insumoId: 6,
          quantidade: 15,
          custoCalculado: expect.closeTo(0.255, P),
        },
      ],
      lotes: 1,
      totalUnidades: 50,
      custoIngredientes: expect.closeTo(3.305, P),
      custoInvisivel: 0,
      custoProducao: expect.closeTo(3.305, P),
      custoUnitario: expect.closeTo(0.0661, P),
      precoSugerido: expect.closeTo(0.10576, P),
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
    expect(r.custoProducao).toBeCloseTo(8438.305, P);
    expect(r.custoUnitario).toBeCloseTo(168.7661, P);
    expect(r.precoSugerido).toBeCloseTo(270.02576, P);
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
    expect(r.itens.map((i) => i.custoCalculado)).toEqual(
      [0.75, 0.88, 2.4, 2.25, 1, 2.25, 0.17].map((v) => expect.closeTo(v, P)),
    );
    expect(r.custoIngredientes).toBeCloseTo(9.7, P);
    expect(r.custoInvisivel).toBe(3875);
    expect(r.custoProducao).toBeCloseTo(3884.7, P);
    expect(r.custoUnitario).toBeCloseTo(323.725, P);
    expect(r.precoSugerido).toBeCloseTo(485.5875, P);
  });

  it('sem margem não tem preço sugerido', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      margemLucro: null,
      gastos: [],
    });
    expect(r.custoUnitario).toBeCloseTo(0.0661, P);
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

describe('calcularCustoReceita para N lotes', () => {
  // Esperados conferidos com a aritmética de calcularReceita
  // (custo.service.ts) e do default-custo-invisivel-result.provider.ts.
  it('omitir lotes é o mesmo que 1 lote', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      margemLucro: 0.6,
      gastos: gastosSeed,
    });
    expect(r.lotes).toBe(1);
    expect(r.totalUnidades).toBe(50);
  });

  it('Pão Francês, 3 lotes, sem gastos: o item multiplica a quantidade pelos lotes', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      margemLucro: 0.6,
      gastos: [],
      lotes: 3,
    });
    // fermento: 45 × 0.017 = 0.765
    expect(r.itens).toEqual([
      { insumoId: 1, quantidade: 3, custoCalculado: 9 },
      {
        insumoId: 8,
        quantidade: 0.06,
        custoCalculado: expect.closeTo(0.15, P),
      },
      {
        insumoId: 6,
        quantidade: 45,
        custoCalculado: expect.closeTo(0.765, P),
      },
    ]);
    expect(r).toMatchObject({
      lotes: 3,
      totalUnidades: 150,
      custoInvisivel: 0,
      custoProducao: expect.closeTo(9.915, P),
      custoUnitario: expect.closeTo(0.0661, P),
    });
  });

  it('Pão Francês, 3 lotes, com os gastos do seed', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      margemLucro: 0.6,
      gastos: gastosSeed,
      lotes: 3,
    });
    expect(r.custoInvisivel).toBe(21705);
    expect(r.custoProducao).toBeCloseTo(21714.915, P);
    expect(r.custoUnitario).toBeCloseTo(144.7661, P);
  });

  it('Bolo de Chocolate, 7 lotes, com gastos dos três métodos', () => {
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
      gastos: [
        { valor: 12.5, metodoRateio: 'FIXO' },
        { valor: 0.015, metodoRateio: 'POR_UNIDADE' },
        { valor: 3.3, metodoRateio: 'PROPORCIONAL' },
      ],
      lotes: 7,
    });
    expect(r.itens.map((i) => i.custoCalculado)).toEqual(
      [5.25, 6.16, 16.8, 15.75, 7, 15.75, 1.19].map((v) =>
        expect.closeTo(v, P),
      ),
    );
    expect(r.totalUnidades).toBe(84);
    // 12.5 + 0.015 × 84 + 3.3 × 7
    expect(r.custoInvisivel).toBeCloseTo(36.86, P);
    expect(r.custoProducao).toBeCloseTo(104.76, P);
    expect(r.custoUnitario).toBeCloseTo(104.76 / 84, P);
  });
});

describe('simularCenario', () => {
  const pao = { custoUnitario: 0.07, precoSugerido: 0.11, rendimento: 50 };

  it('sem entrada usa custo, preço e rendimento salvos', () => {
    expect(simularCenario({}, pao)).toEqual({
      custoUnitario: 0.07,
      precoVenda: 0.11,
      volume: 50,
      lucroEstimado: expect.closeTo(2, P),
      margemProjetada: expect.closeTo(0.04 / 0.11, P),
      breakEven: 32,
    });
  });

  it('com novo custo, preço e volume', () => {
    expect(
      simularCenario({ novoCusto: 0.81, novoPreco: 1.22, volume: 37 }, pao),
    ).toEqual({
      custoUnitario: 0.81,
      precoVenda: 1.22,
      volume: 37,
      lucroEstimado: expect.closeTo(15.17, P),
      margemProjetada: expect.closeTo(0.41 / 1.22, P),
      breakEven: 25,
    });
  });

  it('prejuízo: lucro e margem negativos, break-even acima do volume', () => {
    expect(
      simularCenario({ novoCusto: 2, novoPreco: 1.5, volume: 100 }, pao),
    ).toEqual({
      custoUnitario: 2,
      precoVenda: 1.5,
      volume: 100,
      lucroEstimado: -50,
      margemProjetada: expect.closeTo(-1 / 3, P),
      breakEven: 134,
    });
  });

  it('break-even ignora o ruído do ponto flutuante', () => {
    // 0.1 × 3 / 0.1 = 3.0000000000000004: o teto direto daria 4
    expect(
      simularCenario({ novoCusto: 0.1, novoPreco: 0.1, volume: 3 }, pao)
        .breakEven,
    ).toBe(3);
  });

  it('sem custo salvo nem novoCusto → 400 RECEITA_SEM_CUSTO', () => {
    expect(() => simularCenario({}, { ...pao, custoUnitario: null })).toThrow(
      expect.objectContaining({
        code: 'RECEITA_SEM_CUSTO',
        message: 'Receita sem custo calculado. Informe novoCusto para simular.',
      }),
    );
  });

  it('sem preço salvo nem novoPreco → 400 RECEITA_SEM_PRECO', () => {
    expect(() => simularCenario({}, { ...pao, precoSugerido: null })).toThrow(
      expect.objectContaining({
        code: 'RECEITA_SEM_PRECO',
        message:
          'Receita sem preço sugerido definido. Informe novoPreco para simular.',
      }),
    );
    expect(
      simularCenario({ novoPreco: 0.2 }, { ...pao, precoSugerido: null })
        .precoVenda,
    ).toBe(0.2);
  });

  it('preço 0 → 400 PRECO_INVALIDO em vez de NaN (lacuna 27)', () => {
    expect(() =>
      simularCenario(
        {},
        { custoUnitario: 0, precoSugerido: 0, rendimento: 10 },
      ),
    ).toThrow(expect.objectContaining({ code: 'PRECO_INVALIDO' }));
  });
});

describe('calcularPrecoVenda', () => {
  it('preço e lucro sem arredondar (o DTO arredonda, BE-23)', () => {
    expect(calcularPrecoVenda(45.07, 0.6)).toEqual({
      custoUnitario: 45.07,
      precoSugerido: expect.closeTo(72.112, P),
      lucroPorUnidade: expect.closeTo(27.042, P),
    });
    expect(calcularPrecoVenda(0.0661, 0.6)).toEqual({
      custoUnitario: 0.0661,
      precoSugerido: expect.closeTo(0.10576, P),
      lucroPorUnidade: expect.closeTo(0.03966, P),
    });
  });

  it('margem 0 dá lucro 0', () => {
    expect(calcularPrecoVenda(323.72, 0)).toEqual({
      custoUnitario: 323.72,
      precoSugerido: 323.72,
      lucroPorUnidade: 0,
    });
  });

  it('sem custo salvo → 400 RECEITA_SEM_CUSTO', () => {
    expect(() => calcularPrecoVenda(null, 0.5)).toThrow(
      expect.objectContaining({
        code: 'RECEITA_SEM_CUSTO',
        message: 'Receita sem custo calculado',
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
