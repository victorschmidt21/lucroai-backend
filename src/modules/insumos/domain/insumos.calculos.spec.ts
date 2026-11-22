import { describe, expect, it } from 'vitest';
import {
  calcularAumentoReposicao,
  calcularCustoMedio,
  calcularCustoReposicao,
  calcularCustoUnitario,
  precoDefasado,
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

describe('calcularAumentoReposicao', () => {
  it('é a reposição sobre o médio menos 1, em fração', () => {
    // Farinha: médio R$ 0,004/g, reposição (última compra) R$ 0,005/g → 25%
    expect(
      calcularAumentoReposicao({
        custoMedio: 0.004,
        precoMercado: null,
        ultimoCusto: 0.005,
      }),
    ).toBeCloseTo(0.25, 10);
  });

  it('usa o preço de mercado quando informado', () => {
    expect(
      calcularAumentoReposicao({
        custoMedio: 4,
        precoMercado: 6,
        ultimoCusto: 4,
      }),
    ).toBe(0.5);
  });

  it('é negativo quando a reposição caiu', () => {
    expect(
      calcularAumentoReposicao({
        custoMedio: 5,
        precoMercado: null,
        ultimoCusto: 4,
      }),
    ).toBeCloseTo(-0.2, 10);
  });

  it('custo médio ≤ 0 dá null', () => {
    expect(
      calcularAumentoReposicao({
        custoMedio: 0,
        precoMercado: null,
        ultimoCusto: 1,
      }),
    ).toBeNull();
  });
});

describe('precoDefasado', () => {
  const insumo = (custoMedio: number, ultimoCusto: number) => ({
    custoMedio,
    precoMercado: null,
    ultimoCusto,
  });

  it('reposição 25% acima do médio está defasada', () => {
    expect(precoDefasado(insumo(0.004, 0.005))).toBe(true);
  });

  it('10% exatos não estão defasados, mesmo com o erro de ponto flutuante', () => {
    // 0.0055 / 0.005 - 1 = 0.10000000000000009
    expect(precoDefasado(insumo(0.005, 0.0055))).toBe(false);
  });

  it('pouco acima de 10% está defasado', () => {
    expect(precoDefasado(insumo(1, 1.1001))).toBe(true);
  });

  it('reposição igual ou abaixo do médio não está defasada', () => {
    expect(precoDefasado(insumo(5, 5))).toBe(false);
    expect(precoDefasado(insumo(5, 4))).toBe(false);
  });

  it('custo médio 0 não está defasado', () => {
    expect(precoDefasado(insumo(0, 5))).toBe(false);
  });
});
