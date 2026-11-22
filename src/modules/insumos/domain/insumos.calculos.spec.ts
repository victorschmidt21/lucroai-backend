import { describe, expect, it } from 'vitest';
import {
  calcularCustoMedio,
  calcularCustoReposicao,
  calcularCustoUnitario,
  resolverPrecoMercado,
} from './insumos.calculos.js';

describe('calcularCustoUnitario', () => {
  it('divide o valor pago pela quantidade base', () => {
    // Farinha: R$ 5,00 por 1000 g
    expect(calcularCustoUnitario(5, 1000)).toBe(0.005);
  });

  it('não arredonda o resultado', () => {
    expect(calcularCustoUnitario(10, 3)).toBe(10 / 3);
  });

  it('valor pago 0 dá custo 0', () => {
    expect(calcularCustoUnitario(0, 500)).toBe(0);
  });

  it('quantidade base ≤ 0 dá custo 0', () => {
    expect(calcularCustoUnitario(10, 0)).toBe(0);
    expect(calcularCustoUnitario(10, -1)).toBe(0);
  });
});

describe('calcularCustoMedio', () => {
  it('pondera o saldo pelo médio atual e a compra pelo custo dela', () => {
    // Critério da BE-29: 5 kg a R$ 8 + compra de 5 kg por R$ 50 (R$ 10/kg)
    const custoCompra = calcularCustoUnitario(50, 5);
    expect(custoCompra).toBe(10);
    expect(calcularCustoMedio(5, 8, 5, custoCompra)).toBe(9);
  });

  it('não arredonda o resultado', () => {
    // 2 un a R$ 1 + 1 un a R$ 2 = R$ 4 / 3 un
    expect(calcularCustoMedio(2, 1, 1, 2)).toBe(4 / 3);
  });

  it('saldo 0 usa o custo da compra', () => {
    expect(calcularCustoMedio(0, 8, 5, 10)).toBe(10);
  });

  it('saldo negativo usa o custo da compra', () => {
    // -3 kg a R$ 8 + compra de 5 kg a R$ 10: o médio não pondera o negativo
    expect(calcularCustoMedio(-3, 8, 5, 10)).toBe(10);
  });
});

describe('calcularCustoReposicao', () => {
  it('sem preço de mercado, usa o último custo', () => {
    expect(
      calcularCustoReposicao({ precoMercado: null, ultimoCusto: 10 }),
    ).toBe(10);
  });

  it('com preço de mercado, usa o preço de mercado', () => {
    expect(calcularCustoReposicao({ precoMercado: 12, ultimoCusto: 10 })).toBe(
      12,
    );
  });

  it('preço de mercado 0 também vale', () => {
    expect(calcularCustoReposicao({ precoMercado: 0, ultimoCusto: 10 })).toBe(
      0,
    );
  });
});

describe('resolverPrecoMercado', () => {
  const atual = { valorPago: 5, quantidadeBaseCusto: 1000 };

  it('precoMercado no corpo vale como veio', () => {
    expect(resolverPrecoMercado(atual, { precoMercado: 0.006 })).toBe(0.006);
    expect(
      resolverPrecoMercado(atual, { precoMercado: 0.006, valorPago: 9 }),
    ).toBe(0.006);
  });

  it('precoMercado null limpa o preço de mercado', () => {
    expect(resolverPrecoMercado(atual, { precoMercado: null })).toBeNull();
  });

  it('mudar valorPago ou quantidadeBaseCusto informa o preço novo', () => {
    expect(resolverPrecoMercado(atual, { valorPago: 6 })).toBe(0.006);
    expect(resolverPrecoMercado(atual, { quantidadeBaseCusto: 500 })).toBe(
      0.01,
    );
  });

  it('sem mudança de preço, mantém o salvo', () => {
    expect(resolverPrecoMercado(atual, {})).toBeUndefined();
    expect(
      resolverPrecoMercado(atual, { valorPago: 5, quantidadeBaseCusto: 1000 }),
    ).toBeUndefined();
  });
});
