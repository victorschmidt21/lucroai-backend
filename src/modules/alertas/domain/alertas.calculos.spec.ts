import { describe, expect, it } from 'vitest';
import {
  alertasDeEstoqueNegativo,
  alertasDePrecoDefasado,
  alertasDeProdutoNegativo,
  type InsumoParaAlerta,
  type ReceitaParaAlerta,
} from './alertas.calculos.js';

function insumo(
  dados: Partial<InsumoParaAlerta> & Pick<InsumoParaAlerta, 'id' | 'nome'>,
): InsumoParaAlerta {
  return {
    unidade: 'G',
    quantidadeDisponivel: 1000,
    custoMedio: 0.005,
    ultimoCusto: 0.005,
    precoMercado: null,
    ...dados,
  };
}

describe('alertasDeEstoqueNegativo', () => {
  it('traz só os insumos com saldo abaixo de zero, com id, nome, saldo e unidade', () => {
    const alertas = alertasDeEstoqueNegativo([
      insumo({ id: 1, nome: 'Farinha', quantidadeDisponivel: -250 }),
      insumo({ id: 2, nome: 'Açúcar', quantidadeDisponivel: 0 }),
      insumo({ id: 3, nome: 'Ovo', quantidadeDisponivel: -2, unidade: 'UN' }),
      insumo({ id: 4, nome: 'Sal', quantidadeDisponivel: 10 }),
    ]);
    expect(alertas).toEqual([
      { id: 1, nome: 'Farinha', saldo: -250, unidade: 'G' },
      { id: 3, nome: 'Ovo', saldo: -2, unidade: 'UN' },
    ]);
  });

  it('sem saldo negativo não há alerta', () => {
    expect(alertasDeEstoqueNegativo([insumo({ id: 1, nome: 'Sal' })])).toEqual(
      [],
    );
  });
});

describe('alertasDePrecoDefasado', () => {
  const pao: ReceitaParaAlerta = {
    id: 10,
    nome: 'Pão francês',
    insumoIds: [1, 2],
    precoSugerido: 0.75,
    precoComCustoMedio: 0.68,
  };
  const bolo: ReceitaParaAlerta = {
    id: 11,
    nome: 'Bolo',
    insumoIds: [2],
    precoSugerido: 30,
    precoComCustoMedio: 30,
  };

  it('farinha com reposição 25% acima do médio traz o pão e o novo preço', () => {
    const alertas = alertasDePrecoDefasado(
      [
        insumo({
          id: 1,
          nome: 'Farinha',
          custoMedio: 0.004,
          ultimoCusto: 0.005,
        }),
        insumo({ id: 2, nome: 'Sal' }),
      ],
      [pao, bolo],
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      id: 1,
      nome: 'Farinha',
      unidade: 'G',
      custoMedio: 0.004,
      custoReposicao: 0.005,
      receitas: [
        {
          id: 10,
          nome: 'Pão francês',
          precoSugerido: 0.75,
          precoComCustoMedio: 0.68,
        },
      ],
    });
    expect(alertas[0]?.aumentoPercentual).toBeCloseTo(0.25, 10);
  });

  it('usa o preço de mercado como reposição', () => {
    const alertas = alertasDePrecoDefasado(
      [
        insumo({
          id: 2,
          nome: 'Sal',
          custoMedio: 2,
          ultimoCusto: 2,
          precoMercado: 3,
        }),
      ],
      [pao, bolo],
    );
    expect(alertas[0]).toMatchObject({
      custoReposicao: 3,
      aumentoPercentual: 0.5,
      receitas: [{ id: 10 }, { id: 11 }],
    });
  });

  it('até 10% de aumento não é alerta', () => {
    expect(
      alertasDePrecoDefasado(
        [
          insumo({
            id: 1,
            nome: 'Farinha',
            custoMedio: 0.005,
            ultimoCusto: 0.0055,
          }),
        ],
        [pao],
      ),
    ).toEqual([]);
  });

  it('insumo defasado sem receita entra com a lista vazia', () => {
    const alertas = alertasDePrecoDefasado(
      [insumo({ id: 9, nome: 'Fermento', custoMedio: 1, ultimoCusto: 2 })],
      [pao],
    );
    expect(alertas[0]?.receitas).toEqual([]);
  });
});

describe('alertasDeProdutoNegativo', () => {
  const receitas = [
    { id: 1, nome: 'Brigadeiro preto', unidadeRendimento: 'G' },
    { id: 2, nome: 'Brigadeiro branco', unidadeRendimento: 'G' },
    { id: 3, nome: 'Brownie', unidadeRendimento: 'UN' },
  ];

  it('traz só as receitas com estoque pronto abaixo de zero, por nome, com saldo e unidade', () => {
    const alertas = alertasDeProdutoNegativo(
      [
        { receitaId: 1, quantidadeDisponivel: 700 },
        { receitaId: 2, quantidadeDisponivel: -300 },
        { receitaId: 3, quantidadeDisponivel: -4 },
      ],
      receitas,
    );
    expect(alertas).toEqual([
      { receitaId: 2, nome: 'Brigadeiro branco', saldo: -300, unidade: 'G' },
      { receitaId: 3, nome: 'Brownie', saldo: -4, unidade: 'UN' },
    ]);
  });

  it('saldo zero não é negativo', () => {
    expect(
      alertasDeProdutoNegativo(
        [{ receitaId: 2, quantidadeDisponivel: 0 }],
        receitas,
      ),
    ).toEqual([]);
  });

  it('ignora o saldo de receita fora da lista', () => {
    expect(
      alertasDeProdutoNegativo(
        [{ receitaId: 99, quantidadeDisponivel: -10 }],
        receitas,
      ),
    ).toEqual([]);
  });
});
