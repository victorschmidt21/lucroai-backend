import { defineConfig } from 'vitest/config';

// Os e2e usam um banco próprio (lucroai_test), criado pelo
// docker/postgres/init.sql no primeiro `docker compose up postgres`.
// Valores fictícios; no CI, as variáveis do ambiente têm precedência.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Os arquivos compartilham o mesmo banco.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env['E2E_DATABASE_URL'] ??
        'postgresql://lucroai:lucroai@localhost:55640/lucroai_test?schema=public',
      JWT_SECRET: 'segredo-ficticio-exclusivo-dos-testes-e2e-32+',
    },
  },
});
