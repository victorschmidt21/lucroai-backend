import { describe, expect, it } from 'vitest';
import { montarPayloadJwt, normalizarEmail } from './auth.calculos.js';

describe('normalizarEmail', () => {
  it('apara os espaços e passa para minúsculas', () => {
    expect(normalizarEmail('  Ana.Souza@Padaria.COM.br ')).toBe(
      'ana.souza@padaria.com.br',
    );
  });

  it('mantém o e-mail que já está normalizado', () => {
    expect(normalizarEmail('ana@padaria.com')).toBe('ana@padaria.com');
  });
});

describe('montarPayloadJwt', () => {
  it('monta o payload com os nomes do contrato', () => {
    expect(
      montarPayloadJwt(
        { id: 7, email: 'ana@padaria.com', nome: 'Ana' },
        {
          id: 3,
          nome: 'Padaria da Ana',
          cnpj: '12.345.678/0001-90',
          segmento: 'Padaria',
        },
      ),
    ).toEqual({
      sub: 7,
      email: 'ana@padaria.com',
      nome: 'Ana',
      empresa: {
        id: 3,
        nome: 'Padaria da Ana',
        cnpj: '12.345.678/0001-90',
        segmento: 'Padaria',
      },
    });
  });

  it('mantém null nos campos opcionais e ignora campos extras como a senha', () => {
    const usuario = {
      id: 1,
      email: 'b@c.com',
      nome: null,
      senha: '$argon2id$hash',
    };
    const payload = montarPayloadJwt(usuario, {
      id: 2,
      nome: 'Confeitaria',
      cnpj: null,
      segmento: null,
    });

    expect(payload).toEqual({
      sub: 1,
      email: 'b@c.com',
      nome: null,
      empresa: { id: 2, nome: 'Confeitaria', cnpj: null, segmento: null },
    });
    expect(JSON.stringify(payload)).not.toContain('argon2');
  });
});
