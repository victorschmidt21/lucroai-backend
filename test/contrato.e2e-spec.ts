import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { jwtPayloadSchema, loginResponseSchema } from './contrato/auth.js';
import { gastoIndiretoSchema, insumoSchema } from './contrato/catalog.js';
import {
  estoqueProdutoSchema,
  estoqueSchema,
  movimentacaoEstoqueSchema,
  producaoSchema,
} from './contrato/operations.js';
import {
  precoVendaSchema,
  receitaCustoSchema,
  receitaSchema,
  simulacaoCenarioSchema,
} from './contrato/recipe.js';
import { vendaSchema } from './contrato/sales.js';

// Teste de contrato com o frontend (BE-15). Percorre o fluxo principal com o
// app em memória e valida cada resposta com os schemas Zod do frontend,
// copiados em test/contrato/. Os dados são criados aqui, com e-mails únicos,
// então o teste roda no banco limpo do CI e no lucroai_test local já usado.

/**
 * Formato padrão de erro (docs/api.md#erros). É mais estrito que o
 * `corpoDeErroSchema` do frontend (`statusCode`, `message` string ou lista e
 * `error` opcionais), então quem passa aqui passa lá.
 */
const erroSchema = z.object({
  statusCode: z.number().int(),
  code: z.string().regex(/^[A-Z][A-Z_]*$/),
  message: z.union([z.string(), z.array(z.string())]),
  path: z.string(),
  timestamp: z.iso.datetime(),
});

/** Resposta de `POST /auth/empresa` (docs/api.md): payload + token. */
const cadastroEmpresaSchema = jwtPayloadSchema
  .omit({ iat: true, exp: true })
  .extend(loginResponseSchema.shape);

// Campos e rotas do épico E7 (BE-24 a BE-32), aditivos e ainda sem schema no
// frontend (FE-41 a FE-47). Quando o frontend os publicar, a cópia de
// test/contrato/ os traz e estes schemas locais saem (docs/api.md).

/** Campos novos do `Insumo` (BE-29, BE-32). */
const insumoNovoSchema = insumoSchema.extend({
  custoMedio: z.number(),
  ultimoCusto: z.number(),
  custoReposicao: z.number(),
  precoMercado: z.number().nullable(),
  precoMercadoData: z.iso.datetime().nullable(),
  estoqueNegativo: z.boolean(),
});

/** `tipo` do `GastoIndireto` (BE-26), ao lado do `metodoRateio` legado. */
const gastoNovoSchema = gastoIndiretoSchema.extend({
  tipo: z.enum(['MENSAL', 'POR_UNIDADE', 'PERCENTUAL_VENDA']),
});

const parteSchema = z.object({ valor: z.number(), fracao: z.number() });

/** Ficha técnica (BE-27), detalhe do custo e preço por canal (BE-28). */
const receitaNovaSchema = receitaSchema.extend({
  usoPorLote: z.number(),
  embalagemPorUnidade: z.number(),
  perdaPercentual: z.number(),
  lucroPercentual: z.number().optional(),
  custo: z.object({
    ingredientesLote: z.number(),
    gastosMensaisLote: z.number(),
    ingredientes: z.number(),
    gastosMensais: z.number(),
    gastosPorUnidade: z.number(),
    embalagem: z.number(),
    perdas: z.number(),
    unitario: z.number(),
  }),
  precos: z.array(
    z.object({
      canalId: z.number().int(),
      canal: z.string(),
      balcao: z.boolean(),
      percentuais: z.number(),
      preco: z.number().nullable(),
      motivo: z.literal('PERCENTUAIS_ACIMA_DE_100').nullable(),
      composicao: z
        .object({
          ingredientes: parteSchema,
          gastosMensais: parteSchema,
          gastosPorUnidade: parteSchema,
          embalagem: parteSchema,
          perdas: parteSchema,
          imposto: parteSchema,
          taxaCanal: parteSchema,
          gastosPercentuais: parteSchema,
          lucro: parteSchema,
        })
        .nullable(),
    }),
  ),
});

/** Receita dentro de receita (BE-39). */
const receitaComReceitasSchema = receitaNovaSchema.extend({
  vendavel: z.boolean(),
  receitas: z.array(
    z.object({
      receitaId: z.number().int(),
      nome: z.string(),
      quantidade: z.number(),
      unidade: z.string(),
    }),
  ),
  usadaEm: z.array(z.object({ receitaId: z.number().int(), nome: z.string() })),
});

/** Canal e lucro real da venda (BE-30), ao lado da `margemRealizada` legada. */
const vendaNovaSchema = vendaSchema.extend({
  canalId: z.number().int().nullable(),
  itens: z.array(
    vendaSchema.shape.itens.element.extend({
      lucroReal: z.number().nullable(),
    }),
  ),
});

/** `GET` e `PUT /configuracao-custos` (BE-24). */
const configuracaoCustosSchema = z.object({
  empresaId: z.number().int(),
  baseRateio: z.enum(['FORNADAS', 'MINUTOS']),
  capacidadeMensal: z.number(),
  lucroPadrao: z.number(),
  impostoPercentual: z.number(),
  taxaMaquininha: z.number(),
});

/** `/canais` (BE-25). */
const canalVendaSchema = z.object({
  id: z.number().int(),
  empresaId: z.number().int(),
  nome: z.string(),
  comissaoPercentual: z.number(),
  ativo: z.boolean(),
  balcao: z.boolean(),
});

/** `CompraInsumo` é novo (BE-29) e não tem schema no frontend. */
const compraInsumoSchema = z.object({
  id: z.number().int(),
  insumoId: z.number().int(),
  quantidade: z.number(),
  valorTotal: z.number(),
  custoUnitario: z.number(),
  observacao: z.string().nullable(),
  dataCompra: z.iso.datetime(),
});

/** Ponto de equilíbrio (BE-31), sem schema no frontend. */
const motivoPontoSchema = z.enum(['SEM_VENDAS', 'MARGEM_NEGATIVA']).nullable();

/** Campos novos da simulação (BE-31), aditivos ao schema do frontend. */
const simulacaoNovaSchema = simulacaoCenarioSchema.extend({
  canalId: z.number().int(),
  canal: z.string(),
  custoSemGastosMensais: z.number(),
  percentuaisSemLucro: z.number(),
  margemContribuicao: z.number(),
  lucroPorUnidade: z.number(),
  lucroReal: z.number(),
  lucroMes: z.number(),
  gastosMensais: z.number(),
  pontoEquilibrio: z.object({
    unidades: z.number().int().nullable(),
    motivo: motivoPontoSchema,
  }),
});

/** `GET /vendas/resumo` é novo (BE-31) e não tem schema no frontend. */
const resumoVendasSchema = z.object({
  dias: z.number().int(),
  dataInicio: z.iso.datetime(),
  vendas: z.number().int(),
  receita: z.number(),
  margemContribuicao: z.number(),
  indiceMargemContribuicao: z.number().nullable(),
  gastosMensais: z.number(),
  pontoEquilibrio: z.object({
    valor: z.number().nullable(),
    motivo: motivoPontoSchema,
  }),
});

/** `GET /alertas` é novo (BE-32) e não tem schema no frontend. */
const alertasSchema = z.object({
  estoqueNegativo: z.array(
    z.object({
      id: z.number().int(),
      nome: z.string(),
      saldo: z.number(),
      unidade: z.string(),
    }),
  ),
  precoDefasado: z.array(
    z.object({
      id: z.number().int(),
      nome: z.string(),
      unidade: z.string(),
      custoMedio: z.number(),
      custoReposicao: z.number(),
      aumentoPercentual: z.number(),
      receitas: z.array(
        z.object({
          id: z.number().int(),
          nome: z.string(),
          precoSugerido: z.number().nullable(),
          precoComCustoMedio: z.number().nullable(),
        }),
      ),
    }),
  ),
});

const healthSchema = z.object({
  status: z.literal('ok'),
  database: z.string(),
});

function validar<S extends z.ZodType>(schema: S, corpo: unknown): z.output<S> {
  const resultado = schema.safeParse(corpo);
  if (!resultado.success) {
    throw new Error(
      `Resposta fora do contrato: ${z.prettifyError(resultado.error)}\n` +
        JSON.stringify(corpo, null, 2),
    );
  }
  return resultado.data;
}

function decodificarJwt(token: string): unknown {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8'));
}

type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Rota = [Metodo, string];

describe('Contrato com o frontend (e2e)', () => {
  let app: INestApplication<App>;
  const sufixo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const senha = 'senha-do-contrato';
  const emailA = `contrato-a-${sufixo}@example.com`;
  const emailB = `contrato-b-${sufixo}@example.com`;
  // Token fictício do ambiente de teste (vitest.config.e2e.ts e CI, BE-36).
  const tokenCadastro = process.env['CADASTRO_EMPRESA_TOKEN'] ?? '';

  let tokenA = '';
  let tokenB = '';
  let empresaA = 0;

  // Recursos da empresa A
  let farinhaId = 0;
  let acucarId = 0;
  let gastoId = 0;
  let receitaId = 0;
  let producaoId = 0;
  let vendaConcluidaId = 0;
  let vendaSemSaldoId = 0;

  const chamar = (metodo: Metodo, url: string, token?: string) => {
    const req = request(app.getHttpServer())[metodo](url);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const comA = (metodo: Metodo, url: string) => chamar(metodo, url, tokenA);
  const comB = (metodo: Metodo, url: string) => chamar(metodo, url, tokenB);

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde 200', async () => {
    const res = await chamar('get', '/health').expect(200);
    validar(healthSchema, res.body);
  });

  describe('1. cadastro de empresa e login', () => {
    it('POST /auth/empresa cria a empresa e devolve o token', async () => {
      const res = await chamar('post', '/auth/empresa')
        .send({
          nome_empresa: `Padaria Contrato ${sufixo}`,
          cnpj: String(Date.now()).slice(-14),
          segmento: 'Padaria',
          nome_usuario: 'Ana',
          email: emailA,
          senha,
          token_cadastro: tokenCadastro,
        })
        .expect(201);
      const corpo = validar(cadastroEmpresaSchema, res.body);
      empresaA = corpo.empresa.id;

      const resB = await chamar('post', '/auth/empresa')
        .send({
          nome_empresa: `Outra ${sufixo}`,
          email: emailB,
          senha,
          token_cadastro: tokenCadastro,
        })
        .expect(201);
      const corpoB = validar(cadastroEmpresaSchema, resB.body);
      expect(corpoB.empresa.cnpj).toBeNull();
      expect(corpoB.nome).toBeNull();
    });

    it('POST /auth/empresa sem token, com token errado ou com um prefixo responde 403', async () => {
      expect(tokenCadastro.length).toBeGreaterThanOrEqual(64);
      const emailNovo = `contrato-sem-token-${sufixo}@example.com`;
      const corpo = { nome_empresa: `Sem token ${sufixo}`, senha };
      const tentativas = [
        { email: emailNovo },
        { email: emailNovo, token_cadastro: '' },
        { email: emailNovo, token_cadastro: 'token-errado' },
        { email: emailNovo, token_cadastro: tokenCadastro.slice(0, -1) },
        // Token errado com e-mail já cadastrado: 403, não 409 (BE-36).
        { email: emailA, token_cadastro: 'token-errado' },
      ];
      for (const tentativa of tentativas) {
        const res = await chamar('post', '/auth/empresa')
          .send({ ...corpo, ...tentativa })
          .expect(403);
        const erro = validar(erroSchema, res.body);
        expect(erro.code).toBe('TOKEN_CADASTRO_INVALIDO');
        expect(JSON.stringify(erro)).not.toContain(tokenCadastro);
      }

      // Nada foi criado: o e-mail novo continua sem conta.
      await chamar('post', '/auth/login')
        .send({ email: emailNovo, senha })
        .expect(401);
    });

    it('POST /auth/login devolve só o token, com o payload do contrato', async () => {
      const res = await chamar('post', '/auth/login')
        .send({ email: emailA, senha })
        .expect(200);
      tokenA = validar(loginResponseSchema, res.body).access_token;
      const payload = validar(jwtPayloadSchema, decodificarJwt(tokenA));
      expect(payload.empresa.id).toBe(empresaA);
      expect(payload.email).toBe(emailA);

      const resB = await chamar('post', '/auth/login')
        .send({ email: emailB, senha })
        .expect(200);
      tokenB = validar(loginResponseSchema, resB.body).access_token;
    });

    it('POST /auth/login com senha errada responde 401 no formato padrão', async () => {
      const res = await chamar('post', '/auth/login')
        .send({ email: emailA, senha: 'senha-errada' })
        .expect(401);
      expect(validar(erroSchema, res.body).code).toBe('CREDENCIAIS_INVALIDAS');
    });
  });

  describe('2. insumo com estoque, gasto e receita', () => {
    it('insumos: POST, GET, GET :id, PATCH e DELETE', async () => {
      const farinha = await comA('post', '/insumos')
        .send({
          nome: 'Farinha',
          quantidadeBaseCusto: 5,
          unidade: 'KG',
          valorPago: 25,
          quantidadeDisponivelInicial: 10,
        })
        .expect(201);
      const insumo = validar(insumoSchema, farinha.body);
      validar(insumoNovoSchema, farinha.body);
      farinhaId = insumo.id;
      expect(insumo.empresaId).toBe(empresaA);
      expect(insumo.quantidadeDisponivel).toBe(10);
      expect(insumo.custoUnitario).toBe(5);

      const acucar = await comA('post', '/insumos')
        .send({
          nome: 'Açúcar',
          quantidadeBaseCusto: 1,
          unidade: 'KG',
          valorPago: 6,
        })
        .expect(201);
      acucarId = validar(insumoSchema, acucar.body).id;

      const lixo = await comA('post', '/insumos')
        .send({
          nome: 'Descartável',
          quantidadeBaseCusto: 1,
          unidade: 'UN',
          valorPago: 1,
        })
        .expect(201);
      const lixoId = validar(insumoSchema, lixo.body).id;

      const lista = await comA('get', '/insumos').expect(200);
      const insumos = validar(z.array(insumoSchema), lista.body);
      expect(insumos.map((i) => i.id).sort()).toEqual(
        [farinhaId, acucarId, lixoId].sort(),
      );

      const um = await comA('get', `/insumos/${farinhaId}`).expect(200);
      expect(validar(insumoSchema, um.body).nome).toBe('Farinha');

      const editado = await comA('patch', `/insumos/${acucarId}`)
        .send({ valorPago: 8 })
        .expect(200);
      expect(validar(insumoSchema, editado.body).valorPago).toBe(8);

      // Compras (BE-29): rota nova, validada contra o schema local.
      const compra = await comA('post', `/insumos/${acucarId}/compras`)
        .send({ quantidade: 2, valorTotal: 20, observacao: 'Nota 1' })
        .expect(201);
      expect(validar(compraInsumoSchema, compra.body)).toMatchObject({
        insumoId: acucarId,
        quantidade: 2,
        valorTotal: 20,
        custoUnitario: 10,
      });
      const compras = await comA('get', `/insumos/${acucarId}/compras`).expect(
        200,
      );
      const historico = validar(z.array(compraInsumoSchema), compras.body);
      expect(historico.map((c) => c.id)).toContain(compra.body.id);
      const comprado = await comA('get', `/insumos/${acucarId}`).expect(200);
      expect(validar(insumoSchema, comprado.body)).toMatchObject({
        quantidadeDisponivel: 2,
        custoUnitario: 10,
      });

      await comA('delete', `/insumos/${lixoId}`).expect(204);
      const sumiu = await comA('get', `/insumos/${lixoId}`).expect(404);
      expect(validar(erroSchema, sumiu.body).code).toBe(
        'INSUMO_NAO_ENCONTRADO',
      );
    });

    it('gastos indiretos: POST, GET, GET :id, PUT e DELETE', async () => {
      const criado = await comA('post', '/gastos-indiretos')
        .send({
          descricao: 'Energia',
          valor: 0.5,
          metodo_rateio: 'PROPORCIONAL',
        })
        .expect(201);
      const gasto = validar(gastoIndiretoSchema, criado.body);
      gastoId = gasto.id;
      // BE-26: o metodo_rateio antigo vira tipo; a resposta mantém um
      // metodoRateio válido para o schema e traz o tipo (campo aditivo).
      expect(gasto.metodoRateio).toBe('FIXO');
      expect(validar(gastoNovoSchema, criado.body).tipo).toBe('MENSAL');

      const outro = await comA('post', '/gastos-indiretos')
        .send({
          descricao: 'Temporário',
          valor: 0.12,
          tipo: 'PERCENTUAL_VENDA',
        })
        .expect(201);
      expect(outro.body).toMatchObject({ tipo: 'PERCENTUAL_VENDA' });
      const outroId = validar(gastoIndiretoSchema, outro.body).id;

      const lista = await comA('get', '/gastos-indiretos').expect(200);
      expect(validar(z.array(gastoIndiretoSchema), lista.body)).toHaveLength(2);

      const um = await comA('get', `/gastos-indiretos/${gastoId}`).expect(200);
      validar(gastoIndiretoSchema, um.body);

      const editado = await comA('put', `/gastos-indiretos/${gastoId}`)
        .send({ valor: 1 })
        .expect(200);
      expect(validar(gastoIndiretoSchema, editado.body).valor).toBe(1);

      await comA('delete', `/gastos-indiretos/${outroId}`).expect(204);
      await comA('get', `/gastos-indiretos/${outroId}`).expect(404);
    });

    it('receitas: POST, GET, GET :id, PUT e DELETE', async () => {
      const criada = await comA('post', '/receitas')
        .send({
          nome: 'Pão doce',
          rendimento: 10,
          unidadeRendimento: 'UN',
          margem_lucro: 0.6,
          insumos: [
            { insumo_id: farinhaId, quantidade: 1 },
            { insumo_id: acucarId, quantidade: 0.5 },
          ],
        })
        .expect(201);
      const receita = validar(receitaSchema, criada.body);
      receitaId = receita.id;
      expect(receita.itens).toHaveLength(2);
      expect(receita.precoSugerido).toBeGreaterThan(0);

      // BE-27: sem os campos da ficha técnica, a receita assume os padrões;
      // sem lucro próprio, `lucroPercentual` é omitido (não `null`) e o
      // preço sugerido usa o lucro padrão da empresa.
      const temporaria = await comA('post', '/receitas')
        .send({
          nome: 'Temporária',
          rendimento: 1,
          unidadeRendimento: 'UN',
          insumos: [{ insumo_id: acucarId, quantidade: 1 }],
        })
        .expect(201);
      const semMargem = validar(receitaSchema, temporaria.body);
      expect(temporaria.body).toMatchObject({
        usoPorLote: 1,
        embalagemPorUnidade: 0,
        perdaPercentual: 0,
      });
      expect(temporaria.body).not.toHaveProperty('lucroPercentual');
      expect(semMargem.precoSugerido).toBeGreaterThan(0);

      const perdaTotal = await comA('post', '/receitas')
        .send({
          nome: 'Perda total',
          rendimento: 1,
          unidadeRendimento: 'UN',
          perda_percentual: 1,
          insumos: [{ insumo_id: acucarId, quantidade: 1 }],
        })
        .expect(400);
      expect(validar(erroSchema, perdaTotal.body).code).toBe('DADOS_INVALIDOS');

      const lista = await comA('get', '/receitas').expect(200);
      expect(validar(z.array(receitaSchema), lista.body)).toHaveLength(2);

      const uma = await comA('get', `/receitas/${receitaId}`).expect(200);
      const lida = validar(receitaSchema, uma.body);
      // BE-28 (aditivos): detalhamento do custo e um preço por canal ativo;
      // o `precoSugerido` é o do Balcão. Canal com percentuais ≥ 100% vem
      // sem preço e com o motivo.
      const caro = await comA('post', '/canais')
        .send({ nome: 'Caro', comissaoPercentual: 0.9 })
        .expect(201);
      const comCanais = await comA('get', `/receitas/${receitaId}`).expect(200);
      validar(receitaNovaSchema, comCanais.body);
      expect(comCanais.body).toMatchObject({
        custo: { unitario: lida.custoUnitario },
        precos: [
          { balcao: true, preco: lida.precoSugerido, motivo: null },
          {
            canal: 'Caro',
            balcao: false,
            preco: null,
            motivo: 'PERCENTUAIS_ACIMA_DE_100',
            composicao: null,
          },
        ],
      });
      await comA('delete', `/canais/${caro.body.id}`).expect(204);

      const editada = await comA('put', `/receitas/${receitaId}`)
        .send({ margem_lucro: 0.5 })
        .expect(200);
      expect(validar(receitaSchema, editada.body).margemLucro).toBe(0.5);

      await comA('delete', `/receitas/${semMargem.id}`).expect(204);
      await comA('get', `/receitas/${semMargem.id}`).expect(404);
    });
  });

  describe('3. custo, simulação e preço de venda', () => {
    it('GET /receitas/:id/custo', async () => {
      const res = await comA('get', `/receitas/${receitaId}/custo`).expect(200);
      const custo = validar(receitaCustoSchema, res.body);
      expect(custo.quantidade_lotes).toBe(1);
      expect(custo.total_unidades).toBe(10);
    });

    it('POST /receitas/:id/custo/simular', async () => {
      const res = await comA('post', `/receitas/${receitaId}/custo/simular`)
        .send({ quantidadeLotes: 3 })
        .expect(201);
      expect(validar(receitaCustoSchema, res.body).total_unidades).toBe(30);
    });

    it('POST /receitas/:id/simular', async () => {
      const res = await comA('post', `/receitas/${receitaId}/simular`)
        .send({ novoPreco: 2, volume: 100 })
        .expect(201);
      const cenario = validar(simulacaoCenarioSchema, res.body);
      expect(cenario.precoVenda).toBe(2);
      expect(cenario.volume).toBe(100);
      expect(validar(simulacaoNovaSchema, res.body).canal).toBe('Balcão');
    });

    it('POST /receitas/:id/simular pelo preço sugerido dá o lucro configurado', async () => {
      const receita = await comA('get', `/receitas/${receitaId}`).expect(200);
      const config = await comA('get', '/configuracao-custos').expect(200);
      const lucro =
        validar(
          z.object({ lucroPercentual: z.number().optional() }),
          receita.body,
        ).lucroPercentual ??
        validar(z.object({ lucroPadrao: z.number() }), config.body).lucroPadrao;
      const res = await comA('post', `/receitas/${receitaId}/simular`)
        .send({})
        .expect(201);
      expect(validar(simulacaoNovaSchema, res.body).lucroReal).toBeCloseTo(
        lucro,
        3,
      );
    });

    it('POST /receitas/:id/preco-venda', async () => {
      const res = await comA('post', `/receitas/${receitaId}/preco-venda`)
        .send({ margem_lucro: 1 })
        .expect(201);
      const preco = validar(precoVendaSchema, res.body);
      expect(preco.preco_sugerido).toBeCloseTo(preco.custo_total_unitario * 2);
    });
  });

  describe('4. entrada de estoque e produção', () => {
    it('estoque de insumos: lista, saldo, entrada, mínimo e movimentações', async () => {
      const lista = await comA('get', '/estoque/insumos').expect(200);
      const estoques = validar(z.array(estoqueSchema), lista.body);
      expect(estoques.map((e) => e.insumoId).sort()).toEqual(
        [farinhaId, acucarId].sort(),
      );

      const saldo = await comA('get', `/estoque/insumos/${farinhaId}`).expect(
        200,
      );
      expect(validar(estoqueSchema, saldo.body).quantidadeDisponivel).toBe(10);

      const entrada = await comA(
        'post',
        `/estoque/insumos/${farinhaId}/entrada`,
      )
        .send({ quantidade: 5 })
        .expect(201);
      expect(validar(estoqueSchema, entrada.body).quantidadeDisponivel).toBe(
        15,
      );

      const minimo = await comA('patch', `/estoque/insumos/${farinhaId}/minimo`)
        .send({ quantidadeMinima: 2 })
        .expect(200);
      expect(validar(estoqueSchema, minimo.body).quantidadeMinima).toBe(2);

      const movs = await comA(
        'get',
        `/estoque/insumos/${farinhaId}/movimentacoes`,
      ).expect(200);
      const movimentacoes = validar(
        z.array(movimentacaoEstoqueSchema),
        movs.body,
      );
      expect(movimentacoes[0]).toMatchObject({
        tipo: 'ENTRADA',
        origem: 'COMPRA',
        quantidade: 5,
      });
    });

    it('produções: POST, GET ?receitaId= e GET :id, com entrada de produto acabado', async () => {
      const criada = await comA('post', '/producoes')
        .send({
          receita_id: receitaId,
          quantidade: 2,
          gasto_indireto_ids: [gastoId],
        })
        .expect(201);
      const producao = validar(producaoSchema, criada.body);
      producaoId = producao.id;
      expect(producao.rateios).toHaveLength(1);
      expect(producao.custoTotal).not.toBeNull();

      const lista = await comA(
        'get',
        `/producoes?receitaId=${receitaId}`,
      ).expect(200);
      const producoes = validar(z.array(producaoSchema), lista.body);
      expect(producoes.map((p) => p.id)).toEqual([producaoId]);

      const todas = await comA('get', '/producoes').expect(200);
      validar(z.array(producaoSchema), todas.body);

      const uma = await comA('get', `/producoes/${producaoId}`).expect(200);
      validar(producaoSchema, uma.body);

      // Baixa dos insumos: 15 - 2 lotes × 1 kg.
      const saldo = await comA('get', `/estoque/insumos/${farinhaId}`).expect(
        200,
      );
      expect(validar(estoqueSchema, saldo.body).quantidadeDisponivel).toBe(13);

      const produtos = await comA('get', '/estoque/produtos').expect(200);
      expect(validar(z.array(estoqueProdutoSchema), produtos.body)).toEqual([
        expect.objectContaining({ receitaId, quantidadeDisponivel: 20 }),
      ]);
    });
  });

  describe('5. venda e conclusão', () => {
    it('POST /vendas e PATCH /vendas/:id/status concluem com saldo', async () => {
      const criada = await comA('post', '/vendas')
        .send({
          itens: [
            { receita_id: receitaId, quantidade: 5, preco_unitario_real: 2.5 },
          ],
        })
        .expect(201);
      const venda = validar(vendaSchema, criada.body);
      vendaConcluidaId = venda.id;
      expect(validar(vendaNovaSchema, criada.body).itens[0]?.lucroReal).toEqual(
        expect.any(Number),
      );
      expect(venda.status).toBe('PENDENTE');
      expect(venda.total).toBe(12.5);

      const concluida = await comA(
        'patch',
        `/vendas/${vendaConcluidaId}/status`,
      )
        .send({ status: 'CONCLUIDA' })
        .expect(200);
      expect(validar(vendaSchema, concluida.body).status).toBe('CONCLUIDA');

      const produtos = await comA('get', '/estoque/produtos').expect(200);
      expect(
        validar(z.array(estoqueProdutoSchema), produtos.body)[0],
      ).toMatchObject({ quantidadeDisponivel: 15 });
    });

    it('a conclusão sem saldo é recusada com 422 e a venda continua pendente', async () => {
      const criada = await comA('post', '/vendas')
        .send({
          itens: [
            { receita_id: receitaId, quantidade: 1000, preco_unitario_real: 2 },
          ],
        })
        .expect(201);
      vendaSemSaldoId = validar(vendaSchema, criada.body).id;

      const recusada = await comA('patch', `/vendas/${vendaSemSaldoId}/status`)
        .send({ status: 'CONCLUIDA' })
        .expect(422);
      const erro = validar(erroSchema, recusada.body);
      expect(erro.code).toBe('ESTOQUE_INSUFICIENTE');
      // O frontend reconhece o erro pelo começo do texto (`isEstoqueInsuficiente`).
      expect(erro.message).toMatch(/^Estoque insuficiente/);

      const venda = await comA('get', `/vendas/${vendaSemSaldoId}`).expect(200);
      expect(validar(vendaSchema, venda.body).status).toBe('PENDENTE');

      const produtos = await comA('get', '/estoque/produtos').expect(200);
      expect(
        validar(z.array(estoqueProdutoSchema), produtos.body)[0],
      ).toMatchObject({ quantidadeDisponivel: 15 });

      const cancelada = await comA('patch', `/vendas/${vendaSemSaldoId}/status`)
        .send({ status: 'CANCELADA' })
        .expect(200);
      expect(validar(vendaSchema, cancelada.body).status).toBe('CANCELADA');

      const finalizada = await comA(
        'patch',
        `/vendas/${vendaSemSaldoId}/status`,
      )
        .send({ status: 'CONCLUIDA' })
        .expect(422);
      expect(validar(erroSchema, finalizada.body).code).toBe(
        'VENDA_FINALIZADA',
      );
    });

    it('GET /vendas com status e período, e GET /vendas/:id', async () => {
      const agora = Date.now();
      const query = new URLSearchParams({
        status: 'CONCLUIDA',
        dataInicio: new Date(agora - 60 * 60 * 1000).toISOString(),
        dataFim: new Date(agora + 60 * 60 * 1000).toISOString(),
      });
      const filtrada = await comA('get', `/vendas?${query.toString()}`).expect(
        200,
      );
      expect(
        validar(z.array(vendaSchema), filtrada.body).map((v) => v.id),
      ).toEqual([vendaConcluidaId]);

      const todas = await comA('get', '/vendas').expect(200);
      expect(validar(z.array(vendaSchema), todas.body)).toHaveLength(2);

      const uma = await comA('get', `/vendas/${vendaConcluidaId}`).expect(200);
      validar(vendaSchema, uma.body);

      const invalida = await comA('get', '/vendas?status=XYZ').expect(400);
      expect(validar(erroSchema, invalida.body).code).toBe('DADOS_INVALIDOS');
    });

    it('GET /vendas/resumo traz o ponto de equilíbrio da empresa', async () => {
      const res = await comA('get', '/vendas/resumo').expect(200);
      const resumo = validar(resumoVendasSchema, res.body);
      expect(resumo.dias).toBe(30);
      expect(resumo.vendas).toBe(1);

      const semVendas = await comB('get', '/vendas/resumo').expect(200);
      expect(
        validar(resumoVendasSchema, semVendas.body).pontoEquilibrio,
      ).toEqual({ valor: null, motivo: 'SEM_VENDAS' });
    });
  });

  describe('isolamento por empresa', () => {
    it('a outra empresa não vê nada da primeira nas listas', async () => {
      for (const url of [
        '/insumos',
        '/gastos-indiretos',
        '/receitas',
        '/estoque/insumos',
        '/estoque/produtos',
        '/producoes',
        `/producoes?receitaId=${receitaId}`,
        '/vendas',
      ]) {
        const res = await comB('get', url).expect(200);
        expect(res.body, url).toEqual([]);
      }
    });

    it('GET, PUT, PATCH e DELETE dos recursos da primeira respondem 404', async () => {
      const casos: [Metodo, string, object?][] = [
        ['get', `/insumos/${farinhaId}`],
        ['patch', `/insumos/${farinhaId}`, { valorPago: 1 }],
        ['delete', `/insumos/${farinhaId}`],
        ['get', `/insumos/${farinhaId}/compras`],
        [
          'post',
          `/insumos/${farinhaId}/compras`,
          { quantidade: 1, valorTotal: 1 },
        ],
        ['get', `/gastos-indiretos/${gastoId}`],
        ['put', `/gastos-indiretos/${gastoId}`, { valor: 99 }],
        ['delete', `/gastos-indiretos/${gastoId}`],
        ['get', `/receitas/${receitaId}`],
        ['put', `/receitas/${receitaId}`, { nome: 'Invadida' }],
        ['delete', `/receitas/${receitaId}`],
        ['get', `/receitas/${receitaId}/custo`],
        [
          'post',
          `/receitas/${receitaId}/custo/simular`,
          { quantidadeLotes: 1 },
        ],
        ['post', `/receitas/${receitaId}/simular`, { volume: 1 }],
        ['post', `/receitas/${receitaId}/preco-venda`, { margem_lucro: 0.5 }],
        ['get', `/estoque/insumos/${farinhaId}`],
        ['post', `/estoque/insumos/${farinhaId}/entrada`, { quantidade: 1 }],
        [
          'patch',
          `/estoque/insumos/${farinhaId}/minimo`,
          { quantidadeMinima: 9 },
        ],
        ['get', `/estoque/insumos/${farinhaId}/movimentacoes`],
        ['get', `/producoes/${producaoId}`],
        ['get', `/vendas/${vendaConcluidaId}`],
        [
          'patch',
          `/vendas/${vendaConcluidaId}/status`,
          { status: 'CANCELADA' },
        ],
      ];

      for (const [metodo, url, corpo] of casos) {
        const req = comB(metodo, url);
        const res = await (corpo ? req.send(corpo) : req);
        expect(res.status, `${metodo.toUpperCase()} ${url}`).toBe(404);
        validar(erroSchema, res.body);
      }
    });

    it('não usa insumos, receitas e gastos da primeira em receitas, produções e vendas', async () => {
      const receitaComInsumoAlheio = await comB('post', '/receitas')
        .send({
          nome: 'Roubada',
          rendimento: 1,
          unidadeRendimento: 'UN',
          insumos: [{ insumo_id: farinhaId, quantidade: 1 }],
        })
        .expect(404);
      expect(validar(erroSchema, receitaComInsumoAlheio.body).code).toBe(
        'INSUMO_NAO_ENCONTRADO',
      );

      const producaoAlheia = await comB('post', '/producoes')
        .send({ receita_id: receitaId, quantidade: 1 })
        .expect(404);
      expect(validar(erroSchema, producaoAlheia.body).code).toBe(
        'RECEITA_NAO_ENCONTRADA',
      );

      const vendaAlheia = await comB('post', '/vendas')
        .send({
          itens: [
            { receita_id: receitaId, quantidade: 1, preco_unitario_real: 1 },
          ],
        })
        .expect(404);
      expect(validar(erroSchema, vendaAlheia.body).code).toBe(
        'RECEITA_NAO_ENCONTRADA',
      );

      // Gasto alheio numa produção de receita própria.
      const insumoB = await comB('post', '/insumos')
        .send({
          nome: 'Sal',
          quantidadeBaseCusto: 1,
          unidade: 'KG',
          valorPago: 2,
        })
        .expect(201);
      const receitaB = await comB('post', '/receitas')
        .send({
          nome: 'Própria',
          rendimento: 1,
          unidadeRendimento: 'UN',
          insumos: [
            {
              insumo_id: validar(insumoSchema, insumoB.body).id,
              quantidade: 1,
            },
          ],
        })
        .expect(201);
      const gastoAlheio = await comB('post', '/producoes')
        .send({
          receita_id: validar(receitaSchema, receitaB.body).id,
          quantidade: 1,
          gasto_indireto_ids: [gastoId],
        })
        .expect(404);
      expect(validar(erroSchema, gastoAlheio.body).code).toBe(
        'GASTO_INDIRETO_NAO_ENCONTRADO',
      );

      // Nada da primeira empresa mudou.
      const insumo = await comA('get', `/insumos/${farinhaId}`).expect(200);
      expect(validar(insumoSchema, insumo.body).valorPago).toBe(25);
      const saldo = await comA('get', `/estoque/insumos/${farinhaId}`).expect(
        200,
      );
      expect(validar(estoqueSchema, saldo.body)).toMatchObject({
        quantidadeDisponivel: 13,
        quantidadeMinima: 2,
      });
      const venda = await comA('get', `/vendas/${vendaConcluidaId}`).expect(
        200,
      );
      expect(validar(vendaSchema, venda.body).status).toBe('CONCLUIDA');
      await comA('get', `/receitas/${receitaId}`).expect(200);
      await comA('get', `/gastos-indiretos/${gastoId}`).expect(200);
    });
  });

  describe('6. alertas', () => {
    // Na empresa B, depois do isolamento, para não mexer nos saldos da A.
    it('GET /alertas traz o estoque negativo e o preço defasado', async () => {
      const vazio = await comA('get', '/alertas').expect(200);
      expect(validar(alertasSchema, vazio.body)).toEqual({
        estoqueNegativo: [],
        precoDefasado: [],
      });

      // Farinha a R$ 4/kg com 1 kg; o pão usa 2 kg por lote.
      const criada = await comB('post', '/insumos')
        .send({
          nome: 'Farinha B',
          quantidadeBaseCusto: 1,
          unidade: 'KG',
          valorPago: 4,
          quantidadeDisponivelInicial: 1,
        })
        .expect(201);
      const farinhaB = validar(insumoSchema, criada.body).id;
      expect(criada.body).toMatchObject({ estoqueNegativo: false });
      const pao = await comB('post', '/receitas')
        .send({
          nome: 'Pão B',
          rendimento: 40,
          unidadeRendimento: 'UN',
          insumos: [{ insumo_id: farinhaB, quantidade: 2 }],
        })
        .expect(201);
      const paoId = validar(receitaSchema, pao.body).id;

      // Produzir sem saldo é permitido e deixa o insumo negativo.
      await comB('post', '/producoes')
        .send({ receita_id: paoId, quantidade: 1 })
        .expect(201);
      const insumo = await comB('get', `/insumos/${farinhaB}`).expect(200);
      expect(validar(insumoSchema, insumo.body)).toMatchObject({
        quantidadeDisponivel: -1,
      });
      expect(insumo.body).toMatchObject({ estoqueNegativo: true });
      const saldo = await comB('get', `/estoque/insumos/${farinhaB}`).expect(
        200,
      );
      expect(validar(estoqueSchema, saldo.body)).toMatchObject({
        quantidadeDisponivel: -1,
      });
      expect(saldo.body).toMatchObject({ estoqueNegativo: true });

      // Reposição 25% acima do médio: R$ 5/kg informado no PATCH.
      await comB('patch', `/insumos/${farinhaB}`)
        .send({ valorPago: 5 })
        .expect(200);
      const novo = await comB('get', `/receitas/${paoId}`).expect(200);
      const precoNovo = validar(receitaSchema, novo.body).precoSugerido;

      const res = await comB('get', '/alertas').expect(200);
      const alertas = validar(alertasSchema, res.body);
      expect(alertas.estoqueNegativo).toEqual([
        { id: farinhaB, nome: 'Farinha B', saldo: -1, unidade: 'KG' },
      ]);
      expect(alertas.precoDefasado).toEqual([
        {
          id: farinhaB,
          nome: 'Farinha B',
          unidade: 'KG',
          custoMedio: 4,
          custoReposicao: 5,
          aumentoPercentual: 0.25,
          receitas: [
            {
              id: paoId,
              nome: 'Pão B',
              precoSugerido: precoNovo,
              precoComCustoMedio: expect.any(Number),
            },
          ],
        },
      ]);
      expect(
        alertas.precoDefasado[0]?.receitas[0]?.precoComCustoMedio,
      ).toBeLessThan(precoNovo ?? 0);

      // A empresa A não vê os alertas da B.
      const daA = await comA('get', '/alertas').expect(200);
      expect(validar(alertasSchema, daA.body).estoqueNegativo).toEqual([]);
    });
  });

  describe('7. configuração de custos e canais', () => {
    it('GET e PUT /configuracao-custos', async () => {
      const padrao = await comA('get', '/configuracao-custos').expect(200);
      expect(validar(configuracaoCustosSchema, padrao.body)).toEqual({
        empresaId: empresaA,
        baseRateio: 'FORNADAS',
        capacidadeMensal: 40,
        lucroPadrao: 0.15,
        impostoPercentual: 0,
        taxaMaquininha: 0,
      });

      // Campo omitido mantém o valor salvo.
      const alterada = await comA('put', '/configuracao-custos')
        .send({ baseRateio: 'MINUTOS', capacidadeMensal: 1200 })
        .expect(200);
      expect(validar(configuracaoCustosSchema, alterada.body)).toMatchObject({
        baseRateio: 'MINUTOS',
        capacidadeMensal: 1200,
        lucroPadrao: 0.15,
      });
      const lida = await comA('get', '/configuracao-custos').expect(200);
      expect(lida.body).toEqual(alterada.body);

      const invalida = await comA('put', '/configuracao-custos')
        .send({ capacidadeMensal: 0 })
        .expect(400);
      expect(validar(erroSchema, invalida.body).code).toBe('DADOS_INVALIDOS');
      expect(invalida.body).toMatchObject({
        details: [{ field: 'capacidadeMensal' }],
      });

      // A configuração é sempre a da empresa do token.
      const daB = await comB('get', '/configuracao-custos').expect(200);
      expect(validar(configuracaoCustosSchema, daB.body).capacidadeMensal).toBe(
        40,
      );
    });

    it('canais: GET, POST, PUT e DELETE, com o Balcão protegido', async () => {
      const lista = await comA('get', '/canais').expect(200);
      const canais = validar(z.array(canalVendaSchema), lista.body);
      expect(canais.map((c) => [c.nome, c.ativo, c.balcao])).toEqual([
        ['Balcão', true, true],
        ['iFood', false, false],
        ['iFood com entrega', false, false],
      ]);
      const balcaoId = canais[0]?.id ?? 0;

      const criado = await comA('post', '/canais')
        .send({ nome: 'Revenda', comissaoPercentual: 0.1 })
        .expect(201);
      const canal = validar(canalVendaSchema, criado.body);
      expect(canal).toMatchObject({ ativo: true, balcao: false });

      const editado = await comA('put', `/canais/${canal.id}`)
        .send({ ativo: false })
        .expect(200);
      expect(validar(canalVendaSchema, editado.body)).toMatchObject({
        nome: 'Revenda',
        ativo: false,
      });

      const recusado = await comA('delete', `/canais/${balcaoId}`).expect(422);
      expect(validar(erroSchema, recusado.body).code).toBe(
        'CANAL_BALCAO_NAO_EXCLUIVEL',
      );

      const alheioPut = await comB('put', `/canais/${canal.id}`)
        .send({ ativo: true })
        .expect(404);
      expect(validar(erroSchema, alheioPut.body).code).toBe(
        'CANAL_VENDA_NAO_ENCONTRADO',
      );
      const alheioDelete = await comB('delete', `/canais/${canal.id}`).expect(
        404,
      );
      expect(validar(erroSchema, alheioDelete.body).code).toBe(
        'CANAL_VENDA_NAO_ENCONTRADO',
      );

      await comA('delete', `/canais/${canal.id}`).expect(204);
    });
  });

  describe('8. receita dentro de receita (BE-39)', () => {
    it('cria o Brownie Dois Amores e barra exclusão, um nível e ela mesma', async () => {
      const criar = (corpo: object) => comA('post', '/receitas').send(corpo);
      const brigadeiro = (nome: string) =>
        criar({
          nome,
          rendimento: 1000,
          unidadeRendimento: 'G',
          vendavel: false,
          insumos: [{ insumo_id: acucarId, quantidade: 0.4 }],
        }).expect(201);
      const preto = validar(
        receitaComReceitasSchema,
        (await brigadeiro('Brigadeiro preto')).body,
      );
      const branco = validar(
        receitaComReceitasSchema,
        (await brigadeiro('Brigadeiro branco')).body,
      );
      expect(preto.vendavel).toBe(false);
      const brownieRes = await criar({
        nome: 'Brownie',
        rendimento: 20,
        unidadeRendimento: 'UN',
        insumos: [{ insumo_id: farinhaId, quantidade: 0.3 }],
      }).expect(201);
      const brownie = validar(receitaComReceitasSchema, brownieRes.body);
      expect(brownie).toMatchObject({ vendavel: true, receitas: [] });

      const doisAmoresRes = await criar({
        nome: 'Brownie Dois Amores',
        rendimento: 1,
        unidadeRendimento: 'UN',
        insumos: [{ insumo_id: acucarId, quantidade: 0.03 }],
        receitas: [
          { receita_id: brownie.id, quantidade: 1 },
          { receita_id: preto.id, quantidade: 150 },
          { receita_id: branco.id, quantidade: 150 },
        ],
      }).expect(201);
      const doisAmores = validar(receitaComReceitasSchema, doisAmoresRes.body);
      expect(doisAmores.itens).toHaveLength(1);
      expect(doisAmores.receitas).toEqual([
        {
          receitaId: brownie.id,
          nome: 'Brownie',
          quantidade: 1,
          unidade: 'UN',
        },
        {
          receitaId: preto.id,
          nome: 'Brigadeiro preto',
          quantidade: 150,
          unidade: 'G',
        },
        {
          receitaId: branco.id,
          nome: 'Brigadeiro branco',
          quantidade: 150,
          unidade: 'G',
        },
      ]);
      const lido = await comA('get', `/receitas/${branco.id}`).expect(200);
      expect(validar(receitaComReceitasSchema, lido.body).usadaEm).toEqual([
        { receitaId: doisAmores.id, nome: 'Brownie Dois Amores' },
      ]);

      // Excluir a receita usada → 409 com o nome de quem usa.
      const emUso = await comA('delete', `/receitas/${branco.id}`).expect(409);
      const erro = validar(erroSchema, emUso.body);
      expect(erro.code).toBe('RECEITA_EM_USO');
      expect(erro.message).toContain('Brownie Dois Amores');
      await comA('get', `/receitas/${branco.id}`).expect(200);

      // Um nível só: usar quem tem receitas, ou dar receitas a quem é usada.
      const umNivel = await criar({
        nome: 'Caixa de brownies',
        rendimento: 1,
        unidadeRendimento: 'UN',
        receitas: [{ receita_id: doisAmores.id, quantidade: 2 }],
      }).expect(422);
      expect(validar(erroSchema, umNivel.body).code).toBe(
        'RECEITA_DENTRO_DE_RECEITA_COM_RECEITA',
      );
      await comA('put', `/receitas/${preto.id}`)
        .send({ receitas: [{ receita_id: brownie.id, quantidade: 1 }] })
        .expect(422);
      const elaMesma = await comA('put', `/receitas/${doisAmores.id}`)
        .send({ receitas: [{ receita_id: doisAmores.id, quantidade: 1 }] })
        .expect(422);
      expect(validar(erroSchema, elaMesma.body).code).toBe(
        'RECEITA_USA_ELA_MESMA',
      );
      await comA('put', `/receitas/${doisAmores.id}`)
        .send({
          receitas: [
            { receita_id: preto.id, quantidade: 1 },
            { receita_id: preto.id, quantidade: 2 },
          ],
        })
        .expect(400);
      const unidade = await comA('put', `/receitas/${preto.id}`)
        .send({ unidadeRendimento: 'KG' })
        .expect(409);
      expect(validar(erroSchema, unidade.body).code).toBe('RECEITA_EM_USO');

      // Receita de outra empresa → 404; sem item nenhum → 400.
      const alheia = await comB('post', '/receitas')
        .send({
          nome: 'Alheia',
          rendimento: 1,
          unidadeRendimento: 'UN',
          receitas: [{ receita_id: preto.id, quantidade: 1 }],
        })
        .expect(404);
      expect(validar(erroSchema, alheia.body).code).toBe(
        'RECEITA_NAO_ENCONTRADA',
      );
      await criar({
        nome: 'Vazia',
        rendimento: 1,
        unidadeRendimento: 'UN',
      }).expect(400);

      // PUT sem `receitas` mantém as salvas; sem uso, a exclusão volta a valer.
      const editado = await comA('put', `/receitas/${doisAmores.id}`)
        .send({ nome: 'Brownie Dois Amores especial' })
        .expect(200);
      expect(editado.body.receitas).toHaveLength(3);
      await comA('delete', `/receitas/${doisAmores.id}`).expect(204);
      await comA('delete', `/receitas/${branco.id}`).expect(204);
    });
  });

  describe('autenticação', () => {
    const protegidas: Rota[] = [
      ['get', '/insumos'],
      ['get', '/insumos/1'],
      ['post', '/insumos'],
      ['patch', '/insumos/1'],
      ['delete', '/insumos/1'],
      ['get', '/gastos-indiretos'],
      ['get', '/gastos-indiretos/1'],
      ['post', '/gastos-indiretos'],
      ['put', '/gastos-indiretos/1'],
      ['delete', '/gastos-indiretos/1'],
      ['get', '/receitas'],
      ['get', '/receitas/1'],
      ['post', '/receitas'],
      ['put', '/receitas/1'],
      ['delete', '/receitas/1'],
      ['get', '/receitas/1/custo'],
      ['post', '/receitas/1/custo/simular'],
      ['post', '/receitas/1/simular'],
      ['post', '/receitas/1/preco-venda'],
      ['get', '/estoque/insumos'],
      ['get', '/estoque/insumos/1'],
      ['post', '/estoque/insumos/1/entrada'],
      ['patch', '/estoque/insumos/1/minimo'],
      ['get', '/estoque/insumos/1/movimentacoes'],
      ['get', '/estoque/produtos'],
      ['get', '/producoes'],
      ['get', '/producoes/1'],
      ['post', '/producoes'],
      ['get', '/vendas'],
      ['get', '/vendas/resumo'],
      ['get', '/vendas/1'],
      ['post', '/vendas'],
      ['patch', '/vendas/1/status'],
      ['get', '/alertas'],
      ['get', '/configuracao-custos'],
      ['put', '/configuracao-custos'],
      ['get', '/canais'],
      ['post', '/canais'],
      ['put', '/canais/1'],
      ['delete', '/canais/1'],
    ];

    it('rotas sem token respondem 401 NAO_AUTENTICADO', async () => {
      for (const [metodo, url] of protegidas) {
        const res = await chamar(metodo, url);
        expect(res.status, `${metodo.toUpperCase()} ${url}`).toBe(401);
        expect(validar(erroSchema, res.body).code).toBe('NAO_AUTENTICADO');
      }
    });

    it('token inválido responde 401 TOKEN_INVALIDO', async () => {
      const res = await chamar('get', '/insumos', 'token.invalido.x').expect(
        401,
      );
      expect(validar(erroSchema, res.body).code).toBe('TOKEN_INVALIDO');
    });
  });
});
