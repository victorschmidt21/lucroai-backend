/** Empresa do token. `cnpj` e `segmento` vêm `null` sem valor. */
export class EmpresaTokenDto {
  /** @example 1 */
  id: number;
  /** @example 'Padaria da Ana' */
  nome: string;
  /** @example '12.345.678/0001-90' */
  cnpj: string | null;
  /** @example 'Padaria' */
  segmento: string | null;
}

/** Resposta de `POST /auth/login`. */
export class LoginResponseDto {
  /** JWT HS256 com validade de 4 h. */
  access_token: string;
}

/** Resposta de `POST /auth/empresa`: o payload do token mais o token. */
export class EmpresaCriadaDto {
  /** Id do usuário. @example 1 */
  sub: number;
  /** @example 'ana@padaria.com' */
  email: string;
  /** @example 'Ana Souza' */
  nome: string | null;
  empresa: EmpresaTokenDto;
  /** JWT HS256 com validade de 4 h. */
  access_token: string;
}
