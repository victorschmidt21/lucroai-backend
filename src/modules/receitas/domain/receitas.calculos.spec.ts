import { describe, expect, it } from 'vitest';
import { round4 } from '../../../shared/domain/arredondamento.js';
import type { GastoParaCusto } from '../../gastos-indiretos/domain/gastos-indiretos.calculos.js';
import {
  calcularCustoInvisivel,
  calcularCustoItem,
  calcularCustoReceita,
  calcularCustoUnitario,
  calcularPreco,
  calcularPrecoNoCanal,
  calcularPrecoVenda,
  FICHA_TECNICA_PADRAO,
  lucroDaMargem,
  lucroPercentualInformado,
  margemDoLucro,
  resolverFichaTecnica,
  simularCenario,
  somarGastosMensaisLote,
  somarGastosPercentuais,
  somarGastosPorUnidade,
  validarFichaTecnica,
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
// Tipos de gasto da BE-26: energia, aluguel e gás são do mês; o saquinho é
// por unidade; a comissão é fração do preço e não entra no custo.
const gastosSeed: GastoParaCusto[] = [
  { valor: 450, tipo: 'MENSAL' },
  { valor: 1800, tipo: 'MENSAL' },
  { valor: 185, tipo: 'MENSAL' },
  { valor: 0.1, tipo: 'POR_UNIDADE' },
  { valor: 0.12, tipo: 'PERCENTUAL_VENDA' },
];
const CAPACIDADE = 100;

describe('calcularCustoItem', () => {
  it('quantidade × custo unitário, sem arredondar (BE-23)', () => {
    // 15 g × R$ 0,017 = R$ 0,255 (era round2 → 0,26)
    expect(calcularCustoItem(15, custo.fermento)).toBeCloseTo(0.255, P);
    expect(calcularCustoItem(0.02, custo.sal)).toBeCloseTo(0.05, P);
  });
});

describe('calcularCustoInvisivel', () => {
  it('1 lote: mensais ÷ capacidade + por unidade × rendimento', () => {
    // (450 + 1800 + 185) ÷ 100 + 0.1 × 50
    expect(calcularCustoInvisivel(gastosSeed, 50, CAPACIDADE)).toBeCloseTo(
      29.35,
      P,
    );
  });

  it('gasto mensal de R$ 1.800 não entra inteiro num lote (BE-26)', () => {
    expect(
      calcularCustoInvisivel([{ valor: 1800, tipo: 'MENSAL' }], 50, 40),
    ).toBe(45);
  });

  it('cada tipo isolado', () => {
    expect(
      calcularCustoInvisivel([{ valor: 12.5, tipo: 'MENSAL' }], 40, CAPACIDADE),
    ).toBe(0.125);
    expect(
      calcularCustoInvisivel(
        [{ valor: 0.015, tipo: 'POR_UNIDADE' }],
        101,
        CAPACIDADE,
      ),
    ).toBeCloseTo(1.515, P);
    expect(
      calcularCustoInvisivel(
        [{ valor: 0.12, tipo: 'PERCENTUAL_VENDA' }],
        50,
        CAPACIDADE,
      ),
    ).toBe(0);
  });

  it('sem gastos é 0', () => {
    expect(calcularCustoInvisivel([], 12, CAPACIDADE)).toBe(0);
  });

  it('N lotes: mensais × lotes ÷ capacidade, por unidade × total de unidades', () => {
    // 2435 × 3 ÷ 100 + 0.1 × 150
    expect(calcularCustoInvisivel(gastosSeed, 50, CAPACIDADE, 3)).toBeCloseTo(
      88.05,
      P,
    );
  });
});

// Critério de aceite da BE-28: pão francês com ingredientes de R$ 3,305,
// rendimento 50, gastos mensais de R$ 2.435, capacidade de 100 fornadas, uso
// de 1 fornada, perda de 5%, imposto 0, maquininha 1,36% e lucro 15%.
const gastosMensaisPao: GastoParaCusto[] = [
  { valor: 450, tipo: 'MENSAL' },
  { valor: 1800, tipo: 'MENSAL' },
  { valor: 185, tipo: 'MENSAL' },
];
const basePao = {
  impostoPercentual: 0,
  taxaMaquininha: 0.0136,
  gastosPercentuais: 0,
  lucro: 0.15,
};
const custoPao = () =>
  calcularCustoReceita({
    itens: paoFrances,
    rendimento: 50,
    usoPorLote: 1,
    embalagemPorUnidade: 0,
    perdaPercentual: 0.05,
    gastos: gastosMensaisPao,
    capacidadeMensal: 100,
  });

describe('somarGastos* (BE-28)', () => {
  it('mensais de 1 lote: Σ MENSAL × usoPorLote ÷ capacidade', () => {
    expect(somarGastosMensaisLote(gastosSeed, 1, 100)).toBeCloseTo(24.35, P);
    expect(somarGastosMensaisLote(gastosSeed, 45, 6000)).toBeCloseTo(
      (2435 * 45) / 6000,
      P,
    );
  });

  it('por unidade e percentuais só somam o próprio tipo', () => {
    expect(somarGastosPorUnidade(gastosSeed)).toBeCloseTo(0.1, P);
    expect(somarGastosPercentuais(gastosSeed)).toBeCloseTo(0.12, P);
    expect(somarGastosPorUnidade([])).toBe(0);
    expect(somarGastosPercentuais([])).toBe(0);
  });
});

describe('calcularCustoUnitario (BE-28)', () => {
  it('((ingredientes + mensais) ÷ rendimento + embalagem + por unidade) ÷ (1 − perda)', () => {
    const d = calcularCustoUnitario({
      ingredientesLote: 10,
      gastosMensaisLote: 5,
      rendimento: 10,
      embalagemPorUnidade: 0.3,
      gastosPorUnidade: 0.2,
      perdaPercentual: 0.2,
    });
    // (1 + 0,5 + 0,3 + 0,2) ÷ 0,8 = 2,5
    expect(d).toEqual({
      ingredientesLote: 10,
      gastosMensaisLote: 5,
      ingredientes: 1,
      gastosMensais: 0.5,
      gastosPorUnidade: 0.2,
      embalagem: 0.3,
      perdas: expect.closeTo(0.5, P),
      custoUnitario: expect.closeTo(2.5, P),
    });
  });

  it('sem perda, perdas é 0', () => {
    const d = calcularCustoUnitario({
      ingredientesLote: 3,
      gastosMensaisLote: 0,
      rendimento: 3,
      embalagemPorUnidade: 0,
      gastosPorUnidade: 0,
      perdaPercentual: 0,
    });
    expect(d.custoUnitario).toBe(1);
    expect(d.perdas).toBe(0);
  });

  it('pão francês do critério de aceite: R$ 0,5822', () => {
    const r = custoPao();
    expect(r.detalhe.ingredientesLote).toBeCloseTo(3.305, P);
    expect(r.detalhe.gastosMensaisLote).toBeCloseTo(24.35, P);
    // (3,305 + 24,35) ÷ 50 ÷ 0,95
    expect(r.custoUnitario).toBeCloseTo(27.655 / 50 / 0.95, P);
    expect(round4(r.custoUnitario)).toBe(0.5822);
  });
});

describe('calcularPreco (BE-28)', () => {
  // (0,6 + 0,1 + 0,05 + 0,05) ÷ 0,8 = 1
  const custo = calcularCustoUnitario({
    ingredientesLote: 6,
    gastosMensaisLote: 1,
    rendimento: 10,
    embalagemPorUnidade: 0.05,
    gastosPorUnidade: 0.05,
    perdaPercentual: 0.2,
  });
  const p = {
    imposto: 0.06,
    taxaCanal: 0.15,
    gastosPercentuais: 0.04,
    lucro: 0.25,
  };

  it('custo ÷ (1 − imposto − taxa − % de venda − lucro)', () => {
    const r = calcularPreco(custo, p);
    expect(r.percentuais).toBeCloseTo(0.5, P);
    expect(r.preco).toBeCloseTo(2, P);
    expect(r.motivo).toBeNull();
  });

  it('composição: as partes em reais somam o preço e as frações somam 1', () => {
    const r = calcularPreco(custo, p);
    const parte = (valor: number, fracao: number) => ({
      valor: expect.closeTo(valor, P),
      fracao: expect.closeTo(fracao, P),
    });
    expect(r.composicao).toEqual({
      ingredientes: parte(0.6, 0.3),
      gastosMensais: parte(0.1, 0.05),
      gastosPorUnidade: parte(0.05, 0.025),
      embalagem: parte(0.05, 0.025),
      perdas: parte(0.2, 0.1),
      imposto: parte(0.12, 0.06),
      taxaCanal: parte(0.3, 0.15),
      gastosPercentuais: parte(0.08, 0.04),
      lucro: parte(0.5, 0.25),
    });
    const partes = Object.values(r.composicao ?? {});
    expect(partes.reduce((t, x) => t + x.valor, 0)).toBeCloseTo(2, P);
    expect(partes.reduce((t, x) => t + x.fracao, 0)).toBeCloseTo(1, P);
  });

  it('lucro ÷ preço é exatamente o lucro configurado', () => {
    const r = calcularPreco(custoPao().detalhe, {
      imposto: 0,
      taxaCanal: 0.0136,
      gastosPercentuais: 0,
      lucro: 0.15,
    });
    expect((r.composicao?.lucro.valor ?? 0) / (r.preco ?? 1)).toBeCloseTo(
      0.15,
      12,
    );
  });

  it.each([
    { imposto: 0.1, taxaCanal: 0.3, gastosPercentuais: 0.2, lucro: 0.4 },
    { imposto: 0.3, taxaCanal: 0.4, gastosPercentuais: 0.15, lucro: 0.15 },
  ])('percentuais ≥ 100% → sem preço, com o motivo', (percentuais) => {
    expect(calcularPreco(custo, percentuais)).toEqual({
      percentuais: expect.any(Number),
      preco: null,
      motivo: 'PERCENTUAIS_ACIMA_DE_100',
      composicao: null,
    });
  });

  it('custo 0 dá preço 0, sem divisão por zero na composição', () => {
    const zero = calcularCustoUnitario({
      ingredientesLote: 0,
      gastosMensaisLote: 0,
      rendimento: 1,
      embalagemPorUnidade: 0,
      gastosPorUnidade: 0,
      perdaPercentual: 0,
    });
    const r = calcularPreco(zero, p);
    expect(r.preco).toBe(0);
    expect(r.composicao?.ingredientes).toEqual({ valor: 0, fracao: 0 });
  });
});

describe('calcularPrecoNoCanal (BE-28)', () => {
  it('pão francês no Balcão: R$ 0,6961, com a taxa da maquininha', () => {
    const r = calcularPrecoNoCanal(
      custoPao().detalhe,
      { balcao: true, comissaoPercentual: 0.5 },
      basePao,
    );
    expect(r.percentuais).toBeCloseTo(0.1636, P);
    expect(round4(r.preco ?? 0)).toBe(0.6961);
    expect(r.composicao?.lucro.fracao).toBe(0.15);
    expect(r.composicao?.taxaCanal.fracao).toBe(0.0136);
  });

  it('nos outros canais a taxa é a comissão', () => {
    const r = calcularPrecoNoCanal(
      custoPao().detalhe,
      { balcao: false, comissaoPercentual: 0.152 },
      basePao,
    );
    // 0,58221 ÷ (1 − 0,152 − 0,15)
    expect(r.preco).toBeCloseTo(27.655 / 50 / 0.95 / 0.698, P);
  });

  it('canal com percentuais ≥ 100% não tem preço', () => {
    const r = calcularPrecoNoCanal(
      custoPao().detalhe,
      { balcao: false, comissaoPercentual: 0.85 },
      basePao,
    );
    expect(r).toMatchObject({
      preco: null,
      motivo: 'PERCENTUAIS_ACIMA_DE_100',
    });
  });

  it('gastos PERCENTUAL_VENDA e imposto entram nos percentuais', () => {
    const r = calcularPrecoNoCanal(
      custoPao().detalhe,
      { balcao: true, comissaoPercentual: 0 },
      { ...basePao, impostoPercentual: 0.06, gastosPercentuais: 0.12 },
    );
    expect(r.percentuais).toBeCloseTo(0.3436, P);
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
        gastos: [],
        capacidadeMensal: CAPACIDADE,
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
      detalhe: expect.objectContaining({
        ingredientesLote: expect.closeTo(3.305, P),
        custoUnitario: expect.closeTo(0.0661, P),
      }),
    });
  });

  it('Pão Francês com os gastos do seed soma o custo invisível pelo tipo (BE-26)', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      gastos: gastosSeed,
      capacidadeMensal: CAPACIDADE,
    });
    expect(r.custoInvisivel).toBeCloseTo(29.35, P);
    expect(r.custoProducao).toBeCloseTo(32.655, P);
    expect(r.custoUnitario).toBeCloseTo(0.6531, P);
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
      gastos: gastosSeed,
      capacidadeMensal: CAPACIDADE,
    });
    expect(r.itens.map((i) => i.custoCalculado)).toEqual(
      [0.75, 0.88, 2.4, 2.25, 1, 2.25, 0.17].map((v) => expect.closeTo(v, P)),
    );
    expect(r.custoIngredientes).toBeCloseTo(9.7, P);
    // 2435 ÷ 100 + 0.1 × 12
    expect(r.custoInvisivel).toBeCloseTo(25.55, P);
    expect(r.custoProducao).toBeCloseTo(35.25, P);
    expect(r.custoUnitario).toBeCloseTo(2.9375, P);
  });

  it('embalagem e perda entram no custo unitário e no de produção (BE-28)', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      embalagemPorUnidade: 0.05,
      perdaPercentual: 0.05,
      gastos: [],
      capacidadeMensal: CAPACIDADE,
      lotes: 2,
    });
    // (3,305 ÷ 50 + 0,05) ÷ 0,95
    expect(r.custoUnitario).toBeCloseTo(0.1161 / 0.95, P);
    expect(r.custoProducao).toBeCloseTo((0.1161 / 0.95) * 100, P);
    expect(r.custoIngredientes).toBeCloseTo(6.61, P);
    expect(r.detalhe.ingredientesLote).toBeCloseTo(3.305, P);
  });

  it.each([0, -1])('rendimento %d → 400 RENDIMENTO_INVALIDO', (rendimento) => {
    expect(() =>
      calcularCustoReceita({
        itens: paoFrances,
        rendimento,
        gastos: [],
        capacidadeMensal: CAPACIDADE,
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
      gastos: gastosSeed,
      capacidadeMensal: CAPACIDADE,
    });
    expect(r.lotes).toBe(1);
    expect(r.totalUnidades).toBe(50);
  });

  it('Pão Francês, 3 lotes, sem gastos: o item multiplica a quantidade pelos lotes', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      gastos: [],
      capacidadeMensal: CAPACIDADE,
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
      gastos: gastosSeed,
      capacidadeMensal: CAPACIDADE,
      lotes: 3,
    });
    expect(r.custoInvisivel).toBeCloseTo(88.05, P);
    expect(r.custoProducao).toBeCloseTo(97.965, P);
    expect(r.custoUnitario).toBeCloseTo(0.6531, P);
  });

  it('Bolo de Chocolate, 7 lotes, com gastos dos três tipos', () => {
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
      gastos: [
        { valor: 12.5, tipo: 'MENSAL' },
        { valor: 0.015, tipo: 'POR_UNIDADE' },
        { valor: 0.12, tipo: 'PERCENTUAL_VENDA' },
      ],
      capacidadeMensal: CAPACIDADE,
      lotes: 7,
    });
    expect(r.itens.map((i) => i.custoCalculado)).toEqual(
      [5.25, 6.16, 16.8, 15.75, 7, 15.75, 1.19].map((v) =>
        expect.closeTo(v, P),
      ),
    );
    expect(r.totalUnidades).toBe(84);
    // 12.5 × 7 ÷ 100 + 0.015 × 84 (a comissão não é custo)
    expect(r.custoInvisivel).toBeCloseTo(2.135, P);
    expect(r.custoProducao).toBeCloseTo(70.035, P);
    expect(r.custoUnitario).toBeCloseTo(70.035 / 84, P);
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

describe('calcularCustoInvisivel com uso de forno (BE-27)', () => {
  it('o gasto mensal é multiplicado pelo usoPorLote; o por unidade, não', () => {
    // 2435 × 2 ÷ 100 + 0.1 × 50
    expect(
      calcularCustoInvisivel(gastosSeed, 50, CAPACIDADE, 1, 2),
    ).toBeCloseTo(53.7, P);
  });

  it('minutos de forno: 45 min de 6000 min no mês', () => {
    expect(
      calcularCustoInvisivel(
        [{ valor: 1800, tipo: 'MENSAL' }],
        12,
        6000,
        1,
        45,
      ),
    ).toBeCloseTo(13.5, P);
  });

  it('calcularCustoReceita repassa o usoPorLote', () => {
    const r = calcularCustoReceita({
      itens: paoFrances,
      rendimento: 50,
      usoPorLote: 0.5,
      gastos: [{ valor: 2000, tipo: 'MENSAL' }],
      capacidadeMensal: CAPACIDADE,
      lotes: 2,
    });
    // 2000 × 0.5 × 2 ÷ 100
    expect(r.custoInvisivel).toBeCloseTo(20, P);
  });
});

describe('resolverFichaTecnica', () => {
  it('receita criada sem os campos novos assume os padrões', () => {
    expect(resolverFichaTecnica({})).toEqual({
      usoPorLote: 1,
      embalagemPorUnidade: 0,
      perdaPercentual: 0,
      lucroPercentual: null,
    });
    expect(
      resolverFichaTecnica({
        usoPorLote: null,
        embalagemPorUnidade: null,
        perdaPercentual: null,
        lucroPercentual: null,
      }),
    ).toEqual(FICHA_TECNICA_PADRAO);
  });

  it('campo informado substitui; omitido mantém o salvo', () => {
    const salva = {
      usoPorLote: 2,
      embalagemPorUnidade: 0.3,
      perdaPercentual: 0.05,
      lucroPercentual: 0.2,
    };
    expect(resolverFichaTecnica({ usoPorLote: 3 }, salva)).toEqual({
      ...salva,
      usoPorLote: 3,
    });
  });

  it('lucroPercentual null volta ao lucro padrão; os outros null mantêm', () => {
    const salva = {
      usoPorLote: 2,
      embalagemPorUnidade: 0.3,
      perdaPercentual: 0.05,
      lucroPercentual: 0.2,
    };
    expect(
      resolverFichaTecnica(
        { usoPorLote: null, perdaPercentual: null, lucroPercentual: null },
        salva,
      ),
    ).toEqual({ ...salva, lucroPercentual: null });
  });
});

describe('validarFichaTecnica', () => {
  const valida = {
    usoPorLote: 1,
    embalagemPorUnidade: 0,
    perdaPercentual: 0,
    lucroPercentual: null,
  };

  it('aceita os padrões e os limites válidos', () => {
    expect(() => validarFichaTecnica(valida)).not.toThrow();
    expect(() =>
      validarFichaTecnica({
        usoPorLote: 45,
        embalagemPorUnidade: 0.15,
        perdaPercentual: 0.999,
        lucroPercentual: 0,
      }),
    ).not.toThrow();
  });

  it.each([1, 1.5])(
    'perdaPercentual %d → 400 DADOS_INVALIDOS em perda_percentual',
    (perdaPercentual) => {
      expect(() => validarFichaTecnica({ ...valida, perdaPercentual })).toThrow(
        expect.objectContaining({
          code: 'DADOS_INVALIDOS',
          details: [
            {
              field: 'perda_percentual',
              messages: [
                'perda_percentual deve ser uma fração de 0 até menos de 1',
              ],
            },
          ],
        }),
      );
    },
  );

  it('um detalhe por campo inválido', () => {
    expect(() =>
      validarFichaTecnica({
        usoPorLote: 0,
        embalagemPorUnidade: -0.1,
        perdaPercentual: -0.1,
        lucroPercentual: 1,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'DADOS_INVALIDOS',
        details: [
          expect.objectContaining({ field: 'uso_por_lote' }),
          expect.objectContaining({ field: 'embalagem_por_unidade' }),
          expect.objectContaining({ field: 'perda_percentual' }),
          expect.objectContaining({ field: 'lucro_percentual' }),
        ],
      }),
    );
  });
});

describe('compatibilidade com margem_lucro', () => {
  it('lucroDaMargem e margemDoLucro são inversas e dão o mesmo preço', () => {
    expect(lucroDaMargem(0.6)).toBeCloseTo(0.375, P);
    expect(margemDoLucro(0.375)).toBeCloseTo(0.6, P);
    expect(lucroDaMargem(0)).toBe(0);
    expect(margemDoLucro(1)).toBeNull();
    // custo × (1 + margem) = custo ÷ (1 − lucro)
    expect(0.81 / (1 - lucroDaMargem(0.5))).toBeCloseTo(1.215, P);
  });

  it('lucro_percentual tem prioridade sobre margem_lucro', () => {
    expect(
      lucroPercentualInformado({ lucro_percentual: 0.2, margem_lucro: 0.6 }),
    ).toBe(0.2);
  });

  it('só margem_lucro é convertida; null volta ao padrão; omitidos mantêm', () => {
    expect(lucroPercentualInformado({ margem_lucro: 0.6 })).toBeCloseTo(
      0.375,
      P,
    );
    expect(lucroPercentualInformado({ margem_lucro: null })).toBeNull();
    expect(lucroPercentualInformado({ lucro_percentual: null })).toBeNull();
    expect(lucroPercentualInformado({})).toBeUndefined();
  });
});
