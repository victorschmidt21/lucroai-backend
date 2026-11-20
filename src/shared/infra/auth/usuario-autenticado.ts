/**
 * Usuário do token JWT, o mesmo payload que o auth-service dos microsserviços
 * emite (sem `iat` e `exp`). `nome`, `cnpj` e `segmento` podem ser `null`.
 */
export interface UsuarioAutenticado {
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
