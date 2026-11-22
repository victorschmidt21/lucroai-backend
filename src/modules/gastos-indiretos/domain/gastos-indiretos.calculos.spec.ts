import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../../../shared/domain/errors/domain.error.js';
import {
  calcularGastoNoCusto,
  metodoRateioDoTipo,
  resolverTipoGasto,
  tipoDoMetodoRateio,
  validarGasto,
} from './gastos-indiretos.calculos.js';

const uso = { lotes: 1, totalUnidades: 50, capacidadeMensal: 40 };

describe('calcularGastoNoCusto', () => {
  it('MENSAL de R$ 1.800 não entra inteiro num lote: divide pela capacidade', () => {
    expect(calcularGastoNoCusto({ valor: 1800, tipo: 'MENSAL' }, uso)).toBe(45);
  });

  it('MENSAL multiplica pelos lotes e pelo uso de forno do lote', () => {
    expect(
      calcularGastoNoCusto(
        { valor: 1800, tipo: 'MENSAL' },
        { ...uso, lotes: 3, usoPorLote: 2 },
      ),
    ).toBe(270);
  });

  it('MENSAL não arredonda (BE-23)', () => {
    expect(
      calcularGastoNoCusto(
        { valor: 100, tipo: 'MENSAL' },
        { ...uso, capacidadeMensal: 3 },
      ),
    ).toBeCloseTo(33.333333333333, 10);
  });

  it('POR_UNIDADE é valor por unidade: multiplica pelo total de unidades', () => {
    expect(
      calcularGastoNoCusto(
        { valor: 0.08, tipo: 'POR_UNIDADE' },
        { ...uso, lotes: 2, totalUnidades: 100 },
      ),
    ).toBeCloseTo(8, 12);
  });

  it('POR_UNIDADE não depende da capacidade', () => {
    expect(
      calcularGastoNoCusto(
        { valor: 0.25, tipo: 'POR_UNIDADE' },
        { ...uso, capacidadeMensal: 1 },
      ),
    ).toBe(12.5);
  });

  it('PERCENTUAL_VENDA não entra no custo', () => {
    expect(
      calcularGastoNoCusto({ valor: 0.12, tipo: 'PERCENTUAL_VENDA' }, uso),
    ).toBe(0);
  });
});

describe('validarGasto', () => {
  it('MENSAL e POR_UNIDADE aceitam qualquer valor ≥ 0', () => {
    expect(() => validarGasto({ valor: 1800, tipo: 'MENSAL' })).not.toThrow();
    expect(() => validarGasto({ valor: 0, tipo: 'MENSAL' })).not.toThrow();
    expect(() =>
      validarGasto({ valor: 2.5, tipo: 'POR_UNIDADE' }),
    ).not.toThrow();
  });

  it('PERCENTUAL_VENDA aceita fração de 0 até menos de 1', () => {
    expect(() =>
      validarGasto({ valor: 0, tipo: 'PERCENTUAL_VENDA' }),
    ).not.toThrow();
    expect(() =>
      validarGasto({ valor: 0.12, tipo: 'PERCENTUAL_VENDA' }),
    ).not.toThrow();
    expect(() =>
      validarGasto({ valor: 0.9999, tipo: 'PERCENTUAL_VENDA' }),
    ).not.toThrow();
  });

  it.each([1, 12, -0.1, Number.NaN])(
    'PERCENTUAL_VENDA com %s → 400 DADOS_INVALIDOS no campo valor',
    (valor) => {
      try {
        validarGasto({ valor, tipo: 'PERCENTUAL_VENDA' });
        expect.unreachable();
      } catch (erro) {
        expect(erro).toBeInstanceOf(InvalidInputError);
        const e = erro as InvalidInputError;
        expect(e.code).toBe('DADOS_INVALIDOS');
        expect(e.details?.map((d) => d.field)).toEqual(['valor']);
      }
    },
  );
});

describe('compatibilidade com o metodo_rateio', () => {
  it('FIXO e PROPORCIONAL viram MENSAL; POR_UNIDADE continua', () => {
    expect(tipoDoMetodoRateio('FIXO')).toBe('MENSAL');
    expect(tipoDoMetodoRateio('PROPORCIONAL')).toBe('MENSAL');
    expect(tipoDoMetodoRateio('POR_UNIDADE')).toBe('POR_UNIDADE');
  });

  it('a resposta mostra FIXO para MENSAL e PERCENTUAL_VENDA', () => {
    expect(metodoRateioDoTipo('MENSAL')).toBe('FIXO');
    expect(metodoRateioDoTipo('PERCENTUAL_VENDA')).toBe('FIXO');
    expect(metodoRateioDoTipo('POR_UNIDADE')).toBe('POR_UNIDADE');
  });
});

describe('resolverTipoGasto', () => {
  it('tipo prevalece sobre metodo_rateio', () => {
    expect(
      resolverTipoGasto({ tipo: 'PERCENTUAL_VENDA', metodo_rateio: 'FIXO' }),
    ).toBe('PERCENTUAL_VENDA');
  });

  it('só metodo_rateio converte', () => {
    expect(resolverTipoGasto({ metodo_rateio: 'PROPORCIONAL' })).toBe('MENSAL');
  });

  it('metodo_rateio igual ao mostrado mantém o tipo salvo', () => {
    expect(
      resolverTipoGasto({ metodo_rateio: 'FIXO' }, 'PERCENTUAL_VENDA'),
    ).toBe('PERCENTUAL_VENDA');
  });

  it('metodo_rateio diferente do mostrado troca o tipo salvo', () => {
    expect(
      resolverTipoGasto({ metodo_rateio: 'POR_UNIDADE' }, 'PERCENTUAL_VENDA'),
    ).toBe('POR_UNIDADE');
  });

  it('sem tipo nem metodo_rateio mantém o salvo', () => {
    expect(resolverTipoGasto({}, 'POR_UNIDADE')).toBe('POR_UNIDADE');
  });

  it('sem tipo, metodo_rateio nem salvo → 400', () => {
    expect(() => resolverTipoGasto({})).toThrow(InvalidInputError);
  });
});
