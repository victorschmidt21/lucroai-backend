import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
  UnauthorizedError,
} from '../../../domain/errors/domain.error.js';
import type {
  ErrorDetailDto,
  ErrorResponseDto,
} from '../dto/error-response.dto.js';

type ResolvedError = Pick<
  ErrorResponseDto,
  'statusCode' | 'code' | 'message' | 'details'
>;

const DOMAIN_ERROR_STATUS = new Map<Function, HttpStatus>([
  [InvalidInputError, HttpStatus.BAD_REQUEST],
  [UnauthorizedError, HttpStatus.UNAUTHORIZED],
  [ForbiddenError, HttpStatus.FORBIDDEN],
  [NotFoundError, HttpStatus.NOT_FOUND],
  [ConflictError, HttpStatus.CONFLICT],
  [BusinessRuleError, HttpStatus.UNPROCESSABLE_ENTITY],
]);

// Code e mensagem em português para as exceções que o próprio Nest lança em
// inglês (rota inexistente, ParseIntPipe, JSON malformado, throttler...). O
// texto original não é repassado: pode citar detalhes internos e vem em inglês.
const HTTP_DEFAULTS: Partial<
  Record<HttpStatus, { code: string; message: string }>
> = {
  [HttpStatus.BAD_REQUEST]: {
    code: 'DADOS_INVALIDOS',
    message: 'Os dados enviados são inválidos',
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: 'NAO_AUTENTICADO',
    message: 'Autenticação necessária',
  },
  [HttpStatus.FORBIDDEN]: { code: 'ACESSO_NEGADO', message: 'Acesso negado' },
  [HttpStatus.NOT_FOUND]: {
    code: 'RECURSO_NAO_ENCONTRADO',
    message: 'Recurso não encontrado',
  },
  [HttpStatus.CONFLICT]: { code: 'CONFLITO', message: 'Conflito de dados' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    code: 'CORPO_MUITO_GRANDE',
    message: 'O corpo da requisição excede o tamanho máximo permitido',
  },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    code: 'REGRA_DE_NEGOCIO_VIOLADA',
    message: 'A operação viola uma regra de negócio',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'MUITAS_REQUISICOES',
    message: 'Muitas tentativas. Tente novamente em instantes',
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: 'SERVICO_INDISPONIVEL',
    message: 'Serviço indisponível',
  },
};

const ERRO_INTERNO: ResolvedError = {
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  code: 'ERRO_INTERNO',
  message: 'Erro interno do servidor',
};

/**
 * Converte qualquer exceção no formato único de erro da API
 * `{ statusCode, code, message, details?, path, timestamp }` (docs/api.md#erros).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const error = this.resolve(exception);

    if (error.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseDto = {
      ...error,
      path: httpAdapter.getRequestUrl(ctx.getRequest()) as string,
      timestamp: new Date().toISOString(),
    };
    httpAdapter.reply(ctx.getResponse(), body, error.statusCode);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof DomainError) {
      return {
        statusCode:
          DOMAIN_ERROR_STATUS.get(exception.constructor) ??
          HttpStatus.UNPROCESSABLE_ENTITY,
        code: exception.code,
        message: exception.message,
        ...(exception instanceof InvalidInputError &&
          exception.details && { details: exception.details }),
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    // Rede de segurança: os repositórios devem traduzir os erros conhecidos do
    // Prisma em erros de domínio com code específico.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'REGISTRO_DUPLICADO',
          message: 'Já existe um registro com esses dados',
        };
      }
      if (exception.code === 'P2025') {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'RECURSO_NAO_ENCONTRADO',
          message: 'Registro não encontrado',
        };
      }
    }

    return ERRO_INTERNO;
  }

  private fromHttpException(exception: HttpException): ResolvedError {
    const statusCode = exception.getStatus();

    // Exceções 4xx da própria infra (ex.: validationExceptionFactory) já
    // trazem code e mensagem em português.
    const response = exception.getResponse();
    if (statusCode < 500 && typeof response === 'object' && response !== null) {
      const { code, message, details } = response as {
        code?: unknown;
        message?: unknown;
        details?: ErrorDetailDto[];
      };
      if (typeof code === 'string' && typeof message === 'string') {
        return { statusCode, code, message, ...(details && { details }) };
      }
    }

    const padrao =
      HTTP_DEFAULTS[statusCode as HttpStatus] ??
      (statusCode >= 500
        ? ERRO_INTERNO
        : {
            code: 'ERRO_HTTP',
            message: 'Não foi possível processar a requisição',
          });
    return { statusCode, code: padrao.code, message: padrao.message };
  }
}
