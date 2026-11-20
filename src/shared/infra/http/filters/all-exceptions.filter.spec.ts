import {
  type ArgumentsHost,
  Logger,
  NotFoundException,
  ParseIntPipe,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
  UnauthorizedError,
} from '../../../domain/errors/domain.error.js';
import { validationExceptionFactory } from '../validation-exception.factory.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  const reply = vi.fn();
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter({
    httpAdapter: { reply, getRequestUrl: () => '/insumos/1' },
  } as unknown as HttpAdapterHost);

  function catchAndGetBody(exception: unknown) {
    reply.mockClear();
    filter.catch(exception, host);
    const [, body, status] = reply.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
      number,
    ];
    return { body, status };
  }

  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [new InvalidInputError('PRECO_INVALIDO', 'Preço inválido'), 400],
    [
      new UnauthorizedError('CREDENCIAIS_INVALIDAS', 'Credenciais inválidas'),
      401,
    ],
    [new ForbiddenError('ACESSO_NEGADO', 'Acesso negado'), 403],
    [new NotFoundError('INSUMO_NAO_ENCONTRADO', 'Insumo não encontrado'), 404],
    [new ConflictError('INSUMO_EM_USO', 'Insumo em uso'), 409],
    [
      new BusinessRuleError(
        'VENDA_FINALIZADA',
        'Venda já finalizada não pode ser alterada',
      ),
      422,
    ],
  ])('mapeia %s para HTTP %i mantendo code e message', (error, status) => {
    const { body, status: replied } = catchAndGetBody(error);

    expect(replied).toBe(status);
    expect(body).toEqual({
      statusCode: status,
      code: error.code,
      message: error.message,
      path: '/insumos/1',
      timestamp: expect.any(String),
    });
  });

  it('repassa os detalhes de InvalidInputError', () => {
    const details = [{ field: 'itens', messages: ['lista vazia'] }];
    const { body } = catchAndGetBody(
      new InvalidInputError('ITENS_INVALIDOS', 'Itens inválidos', details),
    );
    expect(body).toMatchObject({ statusCode: 400, details });
  });

  it('responde a validação com DADOS_INVALIDOS e details por campo, inclusive aninhado', () => {
    const { body, status } = catchAndGetBody(
      validationExceptionFactory([
        { property: 'nome', constraints: { isString: 'nome inválido' } },
        {
          property: 'itens',
          children: [
            {
              property: '0',
              children: [
                {
                  property: 'quantidade',
                  constraints: { min: 'quantidade mínima é 0' },
                },
              ],
            },
          ],
        },
      ]),
    );
    expect(status).toBe(400);
    expect(body).toEqual({
      statusCode: 400,
      code: 'DADOS_INVALIDOS',
      message: 'Os dados enviados são inválidos',
      details: [
        { field: 'nome', messages: ['nome inválido'] },
        { field: 'itens.0.quantidade', messages: ['quantidade mínima é 0'] },
      ],
      path: '/insumos/1',
      timestamp: expect.any(String),
    });
  });

  it('traduz a exceção em inglês do ParseIntPipe para DADOS_INVALIDOS', async () => {
    const erro: unknown = await new ParseIntPipe()
      .transform('abc', { type: 'param' })
      .catch((e: unknown) => e);
    const { body } = catchAndGetBody(erro);
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'DADOS_INVALIDOS',
      message: 'Os dados enviados são inválidos',
    });
  });

  it('traduz a rota inexistente do Nest sem repetir o texto em inglês', () => {
    const { body } = catchAndGetBody(new NotFoundException('Cannot GET /x'));
    expect(body).toMatchObject({
      statusCode: 404,
      code: 'RECURSO_NAO_ENCONTRADO',
      message: 'Recurso não encontrado',
    });
  });

  it('não repassa o corpo de uma HttpException 5xx', () => {
    const { body } = catchAndGetBody(
      new ServiceUnavailableException({ status: 'error', database: 'down' }),
    );
    expect(body).toEqual({
      statusCode: 503,
      code: 'SERVICO_INDISPONIVEL',
      message: 'Serviço indisponível',
      path: '/insumos/1',
      timestamp: expect.any(String),
    });
  });

  it('converte violação de unicidade do Prisma (P2002) em 409', () => {
    const error = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: '7.10.1',
    });
    expect(catchAndGetBody(error).body).toMatchObject({
      statusCode: 409,
      code: 'REGISTRO_DUPLICADO',
    });
  });

  it('responde erro inesperado com 500 genérico, sem stack nem mensagem interna', () => {
    const { body, status } = catchAndGetBody(new Error('senha do banco: 123'));
    expect(status).toBe(500);
    expect(body).toEqual({
      statusCode: 500,
      code: 'ERRO_INTERNO',
      message: 'Erro interno do servidor',
      path: '/insumos/1',
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toContain('senha');
  });
});
