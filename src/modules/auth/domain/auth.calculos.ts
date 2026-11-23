import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Payload do JWT, o mesmo que o auth-service dos microsserviços emite
 * (`auth.service.ts`, `buildToken`). O frontend lê esses nomes: não mude.
 * `nome`, `cnpj` e `segmento` são `null` quando não informados.
 */
export interface PayloadJwt {
  sub: number;
  email: string;
  nome: string | null;
  empresa: {
    id: number;
    nome: string;
    cnpj: string | null;
    segmento: string | null;
  };
}

export interface UsuarioParaToken {
  id: number;
  email: string;
  nome: string | null;
}

export interface EmpresaParaToken {
  id: number;
  nome: string;
  cnpj: string | null;
  segmento: string | null;
}

/**
 * E-mail aparado e em minúsculas, no cadastro e no login (BE-06). Os
 * microsserviços comparavam o e-mail como veio, então "Ana@x.com" e
 * "ana@x.com" viravam contas diferentes.
 */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Monta o payload do JWT só com os campos do contrato (nunca a senha). */
export function montarPayloadJwt(
  usuario: UsuarioParaToken,
  empresa: EmpresaParaToken,
): PayloadJwt {
  return {
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    empresa: {
      id: empresa.id,
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      segmento: empresa.segmento,
    },
  };
}

/**
 * Confere o token de cadastro de empresa (BE-36) em tempo constante: compara
 * o SHA-256 dos dois valores com `timingSafeEqual`, para os tamanhos ficarem
 * iguais e o tempo não revelar nem o tamanho nem o conteúdo do token certo.
 * Token esperado ausente ou vazio desativa o cadastro (sempre `false`).
 */
export function tokenCadastroValido(
  recebido: string | undefined,
  esperado: string | undefined,
): boolean {
  if (!esperado) return false;
  const hashRecebido = createHash('sha256')
    .update(recebido ?? '')
    .digest();
  const hashEsperado = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(hashRecebido, hashEsperado);
}
