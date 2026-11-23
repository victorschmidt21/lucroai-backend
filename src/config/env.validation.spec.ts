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

  const JWT_SECRET = 'x'.repeat(32);
  const CADASTRO_EMPRESA_TOKEN = 'f'.repeat(64);

  it('lança erro com JWT_SECRET curto em produção', () => {
    expect(() =>
      validate({
        DATABASE_URL,
        NODE_ENV: 'production',
        JWT_SECRET: 'curto',
        CADASTRO_EMPRESA_TOKEN,
      }),
    ).toThrow(/JWT_SECRET: deve ter no mínimo 32 caracteres/);
  });

  it('lança erro sem JWT_SECRET em produção', () => {
    expect(() =>
      validate({
        DATABASE_URL,
        NODE_ENV: 'production',
        CADASTRO_EMPRESA_TOKEN,
      }),
    ).toThrow(/JWT_SECRET: variável obrigatória não definida/);
  });

  it('aceita JWT_SECRET com 32 caracteres em produção', () => {
    expect(
      validate({
        DATABASE_URL,
        NODE_ENV: 'production',
        JWT_SECRET,
        CADASTRO_EMPRESA_TOKEN,
      }).JWT_SECRET,
    ).toBe(JWT_SECRET);
  });

  it('lança erro sem CADASTRO_EMPRESA_TOKEN em produção', () => {
    expect(() =>
      validate({ DATABASE_URL, NODE_ENV: 'production', JWT_SECRET }),
    ).toThrow(/CADASTRO_EMPRESA_TOKEN: variável obrigatória não definida/);
  });

  it('lança erro com CADASTRO_EMPRESA_TOKEN curto em produção', () => {
    expect(() =>
      validate({
        DATABASE_URL,
        NODE_ENV: 'production',
        JWT_SECRET,
        CADASTRO_EMPRESA_TOKEN: 'f'.repeat(63),
      }),
    ).toThrow(/CADASTRO_EMPRESA_TOKEN: deve ter no mínimo 64 caracteres/);
  });

  it('aceita CADASTRO_EMPRESA_TOKEN com 64 caracteres em produção', () => {
    expect(
      validate({
        DATABASE_URL,
        NODE_ENV: 'production',
        JWT_SECRET,
        CADASTRO_EMPRESA_TOKEN,
      }).CADASTRO_EMPRESA_TOKEN,
    ).toBe(CADASTRO_EMPRESA_TOKEN);
  });

  it('dispensa CADASTRO_EMPRESA_TOKEN em development e test', () => {
    expect(
      validate({ DATABASE_URL, NODE_ENV: 'test' }).CADASTRO_EMPRESA_TOKEN,
    ).toBeUndefined();
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
