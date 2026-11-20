import { z } from 'zod';

// Usado só em development/test quando JWT_SECRET não é definido.
// Fora desses ambientes o segredo é obrigatório (mínimo de 32 caracteres).
const JWT_SECRET_DESENVOLVIMENTO =
  'segredo-ficticio-apenas-para-desenvolvimento-local';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3100),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: (issue) =>
        issue.input === undefined
          ? 'variável obrigatória não definida'
          : 'deve ser uma URL de conexão PostgreSQL (postgresql://...)',
    }),
    JWT_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') return;
    if (env.JWT_SECRET === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: `variável obrigatória não definida em ${env.NODE_ENV}`,
      });
    } else if (env.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: `deve ter no mínimo 32 caracteres em ${env.NODE_ENV}`,
      });
    }
  })
  .transform((env) => ({
    ...env,
    JWT_SECRET: env.JWT_SECRET ?? JWT_SECRET_DESENVOLVIMENTO,
  }));

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }

  return result.data;
}
