/**
 * Erros de negócio lançados pelas camadas domain e application.
 *
 * Não dependem do NestJS: o AllExceptionsFilter traduz cada classe para o
 * status HTTP correspondente. `code` é um identificador estável em
 * UPPER_SNAKE_CASE (ex.: INSUMO_NAO_ENCONTRADO) e `message` é o texto em
 * português que o frontend mostra.
 */
export abstract class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Detalhe de um campo inválido, no mesmo formato dos erros de validação. */
export interface DetalheErro {
  field: string;
  messages: string[];
}

/**
 * Entrada inválida que só o service consegue verificar (ex.: preço zerado).
 * HTTP 400. Para erros de formato de DTO, use o ValidationPipe.
 */
export class InvalidInputError extends DomainError {
  constructor(
    code: string,
    message: string,
    readonly details?: DetalheErro[],
  ) {
    super(code, message);
  }
}

/** Credenciais ausentes ou inválidas, token inválido ou expirado. HTTP 401. */
export class UnauthorizedError extends DomainError {}

/** Usuário autenticado sem permissão para a ação. HTTP 403. */
export class ForbiddenError extends DomainError {}

/** Recurso inexistente ou de outra empresa. HTTP 404. */
export class NotFoundError extends DomainError {}

/** Duplicidade ou registro em uso (ex.: insumo usado em receita). HTTP 409. */
export class ConflictError extends DomainError {}

/** Entrada válida, mas que viola uma regra de negócio. HTTP 422. */
export class BusinessRuleError extends DomainError {}
