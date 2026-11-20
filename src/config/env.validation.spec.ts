import { validate } from './env.validation.js';

describe('validate (env)', () => {
  const DATABASE_URL =
    'postgresql://lucroai:lucroai@localhost:55640/lucroai?schema=public';

  it('aplica os padrões em development', () => {
    expect(validate({ DATABASE_URL })).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3100,
      DATABASE_URL,
    });
  });

  it('lança erro quando DATABASE_URL está ausente', () => {
    expect(() => validate({})).toThrow(
      /DATABASE_URL: variável obrigatória não definida/,
    );
  });

  it('lança erro quando DATABASE_URL não é PostgreSQL', () => {
    expect(() => validate({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('lança erro com JWT_SECRET curto em produção', () => {
    expect(() =>
      validate({ DATABASE_URL, NODE_ENV: 'production', JWT_SECRET: 'curto' }),
    ).toThrow(/JWT_SECRET: deve ter no mínimo 32 caracteres/);
  });

  it('lança erro sem JWT_SECRET em produção', () => {
    expect(() => validate({ DATABASE_URL, NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET: variável obrigatória não definida/,
    );
  });

  it('aceita JWT_SECRET com 32 caracteres em produção', () => {
    const JWT_SECRET = 'x'.repeat(32);
    expect(
      validate({ DATABASE_URL, NODE_ENV: 'production', JWT_SECRET }).JWT_SECRET,
    ).toBe(JWT_SECRET);
  });

  it('dispensa JWT_SECRET em development e test', () => {
    expect(validate({ DATABASE_URL, NODE_ENV: 'test' }).JWT_SECRET).toEqual(
      expect.any(String),
    );
  });

  it('converte PORT para número', () => {
    expect(validate({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });
});
