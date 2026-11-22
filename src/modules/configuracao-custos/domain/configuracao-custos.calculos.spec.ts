import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../../../shared/domain/errors/domain.error.js';
import {
  CONFIGURACAO_CUSTOS_PADRAO,
  type ConfiguracaoCustosValores,
  validarConfiguracaoCustos,
} from './configuracao-custos.calculos.js';

function erroDe(config: ConfiguracaoCustosValores): InvalidInputError {
  try {
    validarConfiguracaoCustos(config);
  } catch (error) {
    if (error instanceof InvalidInputError) return error;
    throw error;
  }
  throw new Error('validarConfiguracaoCustos não lançou erro');
}

describe('CONFIGURACAO_CUSTOS_PADRAO', () => {
  it('tem os padrões da BE-24 e é válida', () => {
    expect(CONFIGURACAO_CUSTOS_PADRAO).toEqual({
      baseRateio: 'FORNADAS',
      capacidadeMensal: 40,
      lucroPadrao: 0.15,
      impostoPercentual: 0,
      taxaMaquininha: 0,
    });
    expect(() =>
      validarConfiguracaoCustos(CONFIGURACAO_CUSTOS_PADRAO),
    ).not.toThrow();
  });
});

describe('validarConfiguracaoCustos', () => {
  const base = CONFIGURACAO_CUSTOS_PADRAO;

  it('aceita os limites: frações 0 e 1 e capacidade fracionária positiva', () => {
    expect(() =>
      validarConfiguracaoCustos({
        baseRateio: 'MINUTOS',
        capacidadeMensal: 0.5,
        lucroPadrao: 1,
        impostoPercentual: 0,
        taxaMaquininha: 1,
      }),
    ).not.toThrow();
  });

  it.each([0, -1, Number.NaN])('recusa capacidadeMensal %s', (capacidade) => {
    const erro = erroDe({ ...base, capacidadeMensal: capacidade });
    expect(erro.code).toBe('DADOS_INVALIDOS');
    expect(erro.details?.map((d) => d.field)).toEqual(['capacidadeMensal']);
  });

  it.each(['lucroPadrao', 'impostoPercentual', 'taxaMaquininha'] as const)(
    'recusa %s fora de 0 a 1',
    (campo) => {
      expect(erroDe({ ...base, [campo]: -0.01 }).details).toEqual([
        {
          field: campo,
          messages: [`${campo} deve ser uma fração entre 0 e 1`],
        },
      ]);
      expect(erroDe({ ...base, [campo]: 1.01 }).details?.[0]?.field).toBe(
        campo,
      );
    },
  );

  it('junta um detalhe por campo inválido', () => {
    const erro = erroDe({
      ...base,
      capacidadeMensal: 0,
      lucroPadrao: 2,
      taxaMaquininha: -1,
    });
    expect(erro.details?.map((d) => d.field)).toEqual([
      'capacidadeMensal',
      'lucroPadrao',
      'taxaMaquininha',
    ]);
  });
});
