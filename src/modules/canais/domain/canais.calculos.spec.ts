import { describe, expect, it } from 'vitest';
import { BusinessRuleError } from '../../../shared/domain/errors/domain.error.js';
import {
  CANAIS_PADRAO,
  garantirCanalExcluivel,
  taxaDoCanal,
} from './canais.calculos.js';

describe('CANAIS_PADRAO', () => {
  it('tem os 3 canais da BE-25, só o Balcão ativo e marcado como balcão', () => {
    expect(CANAIS_PADRAO).toEqual([
      { nome: 'Balcão', comissaoPercentual: 0, ativo: true, balcao: true },
      { nome: 'iFood', comissaoPercentual: 0.152, ativo: false, balcao: false },
      {
        nome: 'iFood com entrega',
        comissaoPercentual: 0.262,
        ativo: false,
        balcao: false,
      },
    ]);
  });
});

describe('garantirCanalExcluivel', () => {
  it('recusa excluir o Balcão com 422 CANAL_BALCAO_NAO_EXCLUIVEL', () => {
    let erro: unknown;
    try {
      garantirCanalExcluivel({ balcao: true });
    } catch (error) {
      erro = error;
    }
    expect(erro).toBeInstanceOf(BusinessRuleError);
    expect((erro as BusinessRuleError).code).toBe('CANAL_BALCAO_NAO_EXCLUIVEL');
  });

  it('deixa excluir os outros canais', () => {
    expect(() => garantirCanalExcluivel({ balcao: false })).not.toThrow();
  });
});

describe('taxaDoCanal', () => {
  it('Balcão usa a taxa da maquininha e ignora a comissão', () => {
    expect(taxaDoCanal({ balcao: true, comissaoPercentual: 0.3 }, 0.0136)).toBe(
      0.0136,
    );
  });

  it('os outros canais usam a comissão', () => {
    expect(
      taxaDoCanal({ balcao: false, comissaoPercentual: 0.152 }, 0.0136),
    ).toBe(0.152);
  });
});
