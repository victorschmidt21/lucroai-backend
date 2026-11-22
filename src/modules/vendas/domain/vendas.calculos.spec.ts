import { describe, expect, it } from 'vitest';
import {
  calcularPontoEquilibrioEmpresa,
  percentuaisSemLucroDaVenda,
} from './vendas.calculos.js';

const P = 10;

describe('percentuaisSemLucroDaVenda (BE-31)', () => {
  it('tira os percentuais do lucro real gravado: 1 − custo ÷ preço − lucro', () => {
    // Pão de R$ 0,5822 vendido a R$ 0,70 no Balcão (1,36%): lucro 15,47%
    const lucroReal = 1 - 0.0136 - 0.5822 / 0.7;
    expect(
      percentuaisSemLucroDaVenda({
        precoUnitarioReal: 0.7,
        custoUnitario: 0.5822,
        lucroReal,
      }),
    ).toBeCloseTo(0.0136, P);
  });

  it('venda anterior à BE-30 (sem lucro real) → null', () => {
    expect(
      percentuaisSemLucroDaVenda({
        precoUnitarioReal: 0.7,
        custoUnitario: 0.5822,
        lucroReal: null,
      }),
    ).toBeNull();
    expect(
      percentuaisSemLucroDaVenda({
        precoUnitarioReal: 0.7,
        custoUnitario: null,
        lucroReal: 0.1,
      }),
    ).toBeNull();
  });
});

describe('calcularPontoEquilibrioEmpresa (BE-31)', () => {
  it('gastos mensais ÷ (Σ MC ÷ Σ receita), com o mix das vendas', () => {
    // Pão: 1.000 × R$ 0,70, custo variável 0,07, Balcão 1,36%
    //   receita 700, MC 1000 × (0,70 − 0,07 − 0,00952) = 620,48
    // Bolo: 10 × R$ 40, custo variável 12, iFood 15,2%
    //   receita 400, MC 10 × (40 − 12 − 6,08) = 219,2
    const r = calcularPontoEquilibrioEmpresa(2435, [
      {
        quantidade: 1000,
        precoUnitarioReal: 0.7,
        custoSemGastosMensais: 0.07,
        percentuaisSemLucro: 0.0136,
      },
      {
        quantidade: 10,
        precoUnitarioReal: 40,
        custoSemGastosMensais: 12,
        percentuaisSemLucro: 0.152,
      },
    ]);
    expect(r.receita).toBeCloseTo(1100, P);
    expect(r.margemContribuicao).toBeCloseTo(839.68, P);
    expect(r.indiceMargemContribuicao).toBeCloseTo(839.68 / 1100, P);
    // 2435 ÷ 0,763345… ≈ R$ 3.189,94 por mês
    expect(r.valor).toBeCloseTo(2435 / (839.68 / 1100), 6);
    expect(r.motivo).toBeNull();
    expect(r.gastosMensais).toBe(2435);
  });

  it('sem vendas → null com SEM_VENDAS', () => {
    expect(calcularPontoEquilibrioEmpresa(2435, [])).toEqual({
      receita: 0,
      margemContribuicao: 0,
      indiceMargemContribuicao: null,
      gastosMensais: 2435,
      valor: null,
      motivo: 'SEM_VENDAS',
    });
  });

  it('margem total ≤ 0 → null com MARGEM_NEGATIVA', () => {
    const r = calcularPontoEquilibrioEmpresa(2435, [
      {
        quantidade: 10,
        precoUnitarioReal: 1,
        custoSemGastosMensais: 1.2,
        percentuaisSemLucro: 0,
      },
    ]);
    expect(r.valor).toBeNull();
    expect(r.motivo).toBe('MARGEM_NEGATIVA');
    expect(r.indiceMargemContribuicao).toBeCloseTo(-0.2, P);
  });

  it('sem gastos mensais o ponto é R$ 0', () => {
    const r = calcularPontoEquilibrioEmpresa(0, [
      {
        quantidade: 1,
        precoUnitarioReal: 2,
        custoSemGastosMensais: 1,
        percentuaisSemLucro: 0,
      },
    ]);
    expect(r).toMatchObject({ valor: 0, motivo: null });
  });
});
