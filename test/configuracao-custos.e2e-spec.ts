import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';

// Fumaça das rotas GET e PUT /configuracao-custos (BE-24). O contrato do
// cálculo novo entra no teste de contrato na BE-33.
describe('Configuração de custos (e2e)', () => {
  let app: INestApplication<App>;
  let token = '';
  let empresaId = 0;

  const comToken = (metodo: 'get' | 'put') =>
    request(app.getHttpServer())
      [metodo]('/configuracao-custos')
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    const sufixo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const res = await request(app.getHttpServer())
      .post('/auth/empresa')
      .send({
        nome_empresa: `Config ${sufixo}`,
        email: `config-${sufixo}@example.com`,
        senha: 'senha-da-config',
      })
      .expect(201);
    const corpo = res.body as { access_token: string; empresa: { id: number } };
    token = corpo.access_token;
    empresaId = corpo.empresa.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET devolve os padrões da empresa nova', async () => {
    const res = await comToken('get').expect(200);
    expect(res.body).toEqual({
      empresaId,
      baseRateio: 'FORNADAS',
      capacidadeMensal: 40,
      lucroPadrao: 0.15,
      impostoPercentual: 0,
      taxaMaquininha: 0,
    });
  });

  it('PUT altera só os campos enviados', async () => {
    const res = await comToken('put')
      .send({
        baseRateio: 'MINUTOS',
        capacidadeMensal: 1200,
        taxaMaquininha: 0.0199,
      })
      .expect(200);
    expect(res.body).toEqual({
      empresaId,
      baseRateio: 'MINUTOS',
      capacidadeMensal: 1200,
      lucroPadrao: 0.15,
      impostoPercentual: 0,
      taxaMaquininha: 0.0199,
    });
    const get = await comToken('get').expect(200);
    expect(get.body).toEqual(res.body);
  });

  it.each([
    [{ capacidadeMensal: 0 }, 'capacidadeMensal'],
    [{ lucroPadrao: 1.5 }, 'lucroPadrao'],
    [{ impostoPercentual: -0.1 }, 'impostoPercentual'],
  ])('PUT %j responde 400 no formato padrão', async (corpo, campo) => {
    const res = await comToken('put').send(corpo).expect(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      code: 'DADOS_INVALIDOS',
      details: [{ field: campo }],
      path: '/configuracao-custos',
    });
  });

  it('PUT com tipo errado responde 400 pelo ValidationPipe', async () => {
    const res = await comToken('put')
      .send({ baseRateio: 'LOTES', capacidadeMensal: '40' })
      .expect(400);
    expect(res.body).toMatchObject({ code: 'DADOS_INVALIDOS' });
  });
});
