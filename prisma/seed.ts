/**
 * Seed de demonstração (BE-14): a Padaria Pão Feliz, com login e dados na
 * mesma empresa. Idempotente: apaga e recria os dados da empresa do seed
 * (achada pelo CNPJ) numa transação só. Os custos usam as funções de
 * `domain/` dos módulos, para baterem com os da API.
 *
 * Desde a BE-33, com o cálculo novo do épico E7: configuração de custos
 * (100 fornadas, lucro de 15%, maquininha de 1,36%), canais (Balcão e iFood
 * ativos), gastos por tipo, compras de insumo, ficha técnica com uso de
 * forno, embalagem e perda, e vendas por canal com lucro real. O pão francês
 * sai a cerca de R$ 0,46 no Balcão.
 *
 * É a única exceção à regra de "só o repositório acessa o Prisma" e de "um
 * módulo por tabela" (docs/architecture.md).
 *
 * Uso: `npm run db:seed` (compila com tsconfig.seed.json e roda
 * `prisma db seed`). Recusa rodar com NODE_ENV=production.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import {
  PrismaClient,
  type GastoIndireto,
  type StatusVenda,
  type TipoGasto,
  type UnidadeMedida,
} from '../src/generated/prisma/client.js';
import { round2 } from '../src/shared/domain/arredondamento.js';
import {
  calcularQuantidadeBaixa,
  calcularSaidaProdutoAcabado,
  calcularSaldoAposMovimentacao,
} from '../src/modules/estoque/domain/estoque.calculos.js';
import { CANAIS_PADRAO } from '../src/modules/canais/domain/canais.calculos.js';
import { CONFIGURACAO_CUSTOS_PADRAO } from '../src/modules/configuracao-custos/domain/configuracao-custos.calculos.js';
import {
  calcularCustoMedio,
  calcularCustoReposicao,
  calcularCustoUnitario,
} from '../src/modules/insumos/domain/insumos.calculos.js';
import { calcularProducao } from '../src/modules/producoes/domain/producoes.calculos.js';
import {
  calcularCustoReceita,
  calcularPercentuaisSemLucro,
  calcularPrecoNoCanal,
  somarGastosPercentuais,
} from '../src/modules/receitas/domain/receitas.calculos.js';
import { Venda } from '../src/modules/vendas/domain/venda.entity.js';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const SENHA_DEMO = '123456';

const EMPRESA = {
  nome: 'Padaria Pão Feliz Ltda',
  cnpj: '45.678.901/0001-23',
  segmento: 'Panificação e Confeitaria',
};

const USUARIOS = [
  { nome: 'João da Silva', email: 'joao@padariapaofeliz.com.br' },
  { nome: 'Maria Oliveira', email: 'maria@padariapaofeliz.com.br' },
];

// Mesmos números do catalog-service. O estoque inicial de Leite, Chocolate e
// Coco é menor que o de lá para o saldo, depois das produções, ficar abaixo do
// mínimo (status Crítico/"Baixo" no frontend).
const INSUMOS: {
  chave: string;
  nome: string;
  quantidadeBaseCusto: number;
  unidade: UnidadeMedida;
  valorPago: number;
  estoqueInicial: number;
  estoqueMinimo: number;
}[] = [
  {
    chave: 'FARINHA',
    nome: 'Farinha de Trigo',
    quantidadeBaseCusto: 5,
    unidade: 'KG',
    valorPago: 15,
    estoqueInicial: 10,
    estoqueMinimo: 2,
  },
  {
    chave: 'ACUCAR',
    nome: 'Açúcar Cristal',
    quantidadeBaseCusto: 2,
    unidade: 'KG',
    valorPago: 8.8,
    estoqueInicial: 4,
    estoqueMinimo: 1,
  },
  {
    chave: 'MANTEIGA',
    nome: 'Manteiga sem Sal',
    quantidadeBaseCusto: 500,
    unidade: 'G',
    valorPago: 12,
    estoqueInicial: 1000,
    estoqueMinimo: 250,
  },
  {
    chave: 'OVOS',
    nome: 'Ovos',
    quantidadeBaseCusto: 12,
    unidade: 'UN',
    valorPago: 9,
    estoqueInicial: 60,
    estoqueMinimo: 12,
  },
  {
    chave: 'LEITE',
    nome: 'Leite Integral',
    quantidadeBaseCusto: 1,
    unidade: 'L',
    valorPago: 5,
    estoqueInicial: 0.8,
    estoqueMinimo: 0.5,
  },
  {
    chave: 'FERMENTO',
    nome: 'Fermento Biológico Seco',
    quantidadeBaseCusto: 500,
    unidade: 'G',
    valorPago: 8.5,
    estoqueInicial: 1000,
    estoqueMinimo: 100,
  },
  {
    chave: 'CACAU',
    nome: 'Cacau em Pó 100%',
    quantidadeBaseCusto: 200,
    unidade: 'G',
    valorPago: 9,
    estoqueInicial: 500,
    estoqueMinimo: 100,
  },
  {
    chave: 'SAL',
    nome: 'Sal',
    quantidadeBaseCusto: 1,
    unidade: 'KG',
    valorPago: 2.5,
    estoqueInicial: 2,
    estoqueMinimo: 0.25,
  },
  {
    chave: 'CREME_LEITE',
    nome: 'Creme de Leite',
    quantidadeBaseCusto: 200,
    unidade: 'ML',
    valorPago: 5.5,
    estoqueInicial: 600,
    estoqueMinimo: 200,
  },
  {
    chave: 'CHOC_GOTAS',
    nome: 'Chocolate ao Leite Gotas',
    quantidadeBaseCusto: 1,
    unidade: 'KG',
    valorPago: 35,
    estoqueInicial: 0.6,
    estoqueMinimo: 0.5,
  },
  {
    chave: 'COCO',
    nome: 'Coco Ralado',
    quantidadeBaseCusto: 100,
    unidade: 'G',
    valorPago: 4.5,
    estoqueInicial: 120,
    estoqueMinimo: 50,
  },
  {
    chave: 'GRANULADO',
    nome: 'Granulado de Chocolate',
    quantidadeBaseCusto: 100,
    unidade: 'G',
    valorPago: 3.5,
    estoqueInicial: 300,
    estoqueMinimo: 50,
  },
];

// Configuração do seed (BE-33): rateio por fornadas, 100 fornadas por mês,
// lucro padrão de 15%, sem imposto (o DAS do MEI é gasto mensal) e
// maquininha de 1,36% no balcão.
const CONFIGURACAO = {
  ...CONFIGURACAO_CUSTOS_PADRAO,
  baseRateio: 'FORNADAS',
  capacidadeMensal: 100,
  lucroPadrao: 0.15,
  impostoPercentual: 0,
  taxaMaquininha: 0.0136,
} as const;

// Canais padrão (BE-25), com o iFood ativo: a padaria do seed vende por lá,
// e a receita mostra o preço nos dois canais ativos.
const CANAIS = CANAIS_PADRAO.map((canal) =>
  canal.nome === 'iFood' ? { ...canal, ativo: true } : { ...canal },
);

// Tipos da BE-26: os gastos do mês são MENSAL (somam R$ 2.515); o saquinho
// genérico é POR_UNIDADE, em reais por unidade vendida. O DAS é o valor
// aproximado do MEI de comércio e indústria.
const GASTOS: {
  descricao: string;
  valor: number;
  tipo: TipoGasto;
}[] = [
  { descricao: 'Energia Elétrica', valor: 450, tipo: 'MENSAL' },
  { descricao: 'Aluguel do Espaço', valor: 1800, tipo: 'MENSAL' },
  { descricao: 'Gás de Cozinha (P45)', valor: 185, tipo: 'MENSAL' },
  { descricao: 'DAS do MEI', valor: 80, tipo: 'MENSAL' },
  { descricao: 'Saquinho de Papel', valor: 0.05, tipo: 'POR_UNIDADE' },
];

// Mesmos itens do recipe-service (quantidade por lote), com a ficha técnica
// da BE-27 (BE-33): uso de forno em fornadas, embalagem própria e perda.
// `lucroPercentual` null usa o lucro padrão (15%). O pão francês rende 28
// pães de 50 g por kg de farinha (eram 50) e ocupa 1/5 de uma fornada.
const RECEITAS: {
  chave: string;
  nome: string;
  rendimento: number;
  usoPorLote: number;
  embalagemPorUnidade: number;
  perdaPercentual: number;
  lucroPercentual: number | null;
  itens: [string, number][];
}[] = [
  {
    chave: 'PAO',
    nome: 'Pão Francês',
    rendimento: 28,
    usoPorLote: 0.2,
    embalagemPorUnidade: 0,
    perdaPercentual: 0.05,
    lucroPercentual: null,
    itens: [
      ['FARINHA', 1],
      ['SAL', 0.02],
      ['FERMENTO', 15],
    ],
  },
  {
    chave: 'BOLO',
    nome: 'Bolo de Chocolate',
    rendimento: 12,
    usoPorLote: 0.5,
    embalagemPorUnidade: 0.3,
    perdaPercentual: 0.05,
    lucroPercentual: 0.2,
    itens: [
      ['FARINHA', 0.25],
      ['ACUCAR', 0.2],
      ['MANTEIGA', 100],
      ['OVOS', 3],
      ['LEITE', 0.2],
      ['CACAU', 50],
      ['FERMENTO', 10],
    ],
  },
  {
    chave: 'BRIGADEIRO',
    nome: 'Brigadeiro Gourmet',
    rendimento: 40,
    usoPorLote: 0.1,
    embalagemPorUnidade: 0.08,
    perdaPercentual: 0.02,
    lucroPercentual: 0.25,
    itens: [
      ['CHOC_GOTAS', 0.3],
      ['CREME_LEITE', 100],
      ['MANTEIGA', 20],
      ['GRANULADO', 50],
    ],
  },
  {
    chave: 'QUINDIM',
    nome: 'Quindim',
    rendimento: 12,
    usoPorLote: 0.5,
    embalagemPorUnidade: 0.15,
    perdaPercentual: 0.05,
    lucroPercentual: 0.2,
    itens: [
      ['ACUCAR', 0.3],
      ['OVOS', 6],
      ['COCO', 100],
      ['MANTEIGA', 20],
    ],
  },
];

// As 4 produções do operations-service, cerca de 6 meses atrás, com mais
// pão (6 lotes = 168 pães) para cobrir as vendas concluídas.
const PRODUCOES: { receita: string; lotes: number; diasAtras: number }[] = [
  { receita: 'PAO', lotes: 6, diasAtras: 178 },
  { receita: 'BOLO', lotes: 2, diasAtras: 177 },
  { receita: 'BRIGADEIRO', lotes: 1, diasAtras: 176 },
  { receita: 'QUINDIM', lotes: 1, diasAtras: 175 },
];

// Compras depois das produções (BE-29): a farinha subiu de R$ 3,00 para
// R$ 3,50 o kg (o médio fica entre os dois) e o açúcar de R$ 4,40 para R$ 4,60.
const COMPRAS: {
  insumo: string;
  quantidade: number;
  valorTotal: number;
  diasAtras: number;
  observacao: string;
}[] = [
  {
    insumo: 'FARINHA',
    quantidade: 10,
    valorTotal: 35,
    diasAtras: 170,
    observacao: 'Atacadão, nota 1532',
  },
  {
    insumo: 'ACUCAR',
    quantidade: 5,
    valorTotal: 23,
    diasAtras: 170,
    observacao: 'Atacadão, nota 1532',
  },
];

// Preço de mercado informado sem compra (BE-29): a manteiga foi de R$ 12 para
// R$ 15 os 500 g. A reposição fica 25% acima do médio, e GET /alertas mostra
// o preço defasado (BE-32).
const PRECOS_MERCADO: {
  insumo: string;
  precoMercado: number;
  diasAtras: number;
}[] = [{ insumo: 'MANTEIGA', precoMercado: 0.03, diasAtras: 3 }];

// As 5 vendas do sales-service mais 4, para cada um dos 6 meses do painel ter
// faturamento (inclusive o mês atual). `mesesAtras` 0 = mês atual (aí `dia`
// conta dias para trás, ver `dataNoMes`). Sem `canal`, Balcão.
// O preço cobrado é o preço sugerido da receita no canal, em centavos.
const VENDAS: {
  status: StatusVenda;
  mesesAtras: number;
  dia: number;
  canal?: string;
  itens: [string, number][];
}[] = [
  {
    status: 'CONCLUIDA',
    mesesAtras: 5,
    dia: 10,
    itens: [
      ['PAO', 50],
      ['BRIGADEIRO', 20],
    ],
  },
  {
    status: 'CONCLUIDA',
    mesesAtras: 4,
    dia: 12,
    itens: [
      ['BOLO', 12],
      ['QUINDIM', 12],
    ],
  },
  {
    status: 'CONCLUIDA',
    mesesAtras: 3,
    dia: 8,
    canal: 'iFood',
    itens: [['BRIGADEIRO', 10]],
  },
  { status: 'CANCELADA', mesesAtras: 2, dia: 15, itens: [['BOLO', 24]] },
  {
    status: 'CONCLUIDA',
    mesesAtras: 2,
    dia: 20,
    itens: [
      ['PAO', 30],
      ['BOLO', 6],
    ],
  },
  {
    status: 'CONCLUIDA',
    mesesAtras: 1,
    dia: 14,
    itens: [
      ['PAO', 40],
      ['BRIGADEIRO', 5],
    ],
  },
  {
    status: 'CONCLUIDA',
    mesesAtras: 0,
    dia: 1,
    itens: [
      ['PAO', 20],
      ['BOLO', 2],
    ],
  },
  {
    status: 'CONCLUIDA',
    mesesAtras: 0,
    dia: 2,
    canal: 'iFood',
    itens: [['BOLO', 2]],
  },
  {
    status: 'PENDENTE',
    mesesAtras: 0,
    dia: 0,
    itens: [
      ['PAO', 100],
      ['BRIGADEIRO', 40],
    ],
  },
];

const agora = new Date();

function diasAtras(dias: number): Date {
  return new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
}

/**
 * Dia `dia` de `mesesAtras` meses atrás, às 10h. No mês atual, `dia` é
 * quantos dias atrás (para cair nos "últimos 7 dias" do painel), uma hora antes
 * de agora e nunca antes do dia 1 do mês.
 */
function dataNoMes(mesesAtras: number, dia: number): Date {
  if (mesesAtras > 0) {
    return new Date(
      agora.getFullYear(),
      agora.getMonth() - mesesAtras,
      dia,
      10,
    );
  }
  const data = new Date(agora.getTime() - (dia * 24 + 1) * 60 * 60 * 1000);
  const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  return data < inicioDoMes ? inicioDoMes : data;
}

/** Apaga os dados da empresa, na ordem das FKs; mantém a empresa e os usuários. */
async function limparEmpresa(tx: Tx, empresaId: number): Promise<void> {
  await tx.venda.deleteMany({ where: { empresaId } }); // itens em CASCADE
  await tx.movimentacaoProdutoAcabado.deleteMany({ where: { empresaId } });
  await tx.estoqueProdutoAcabado.deleteMany({ where: { empresaId } });
  await tx.producao.deleteMany({ where: { empresaId } }); // rateios em CASCADE
  // As receitas usadas dentro de outras são RESTRICT (BE-39): saem antes.
  await tx.itemReceitaReceita.deleteMany({ where: { receita: { empresaId } } });
  await tx.receita.deleteMany({ where: { empresaId } }); // itens em CASCADE
  await tx.movimentacaoEstoque.deleteMany({ where: { empresaId } });
  await tx.estoque.deleteMany({ where: { empresaId } });
  await tx.compraInsumo.deleteMany({ where: { empresaId } });
  await tx.insumo.deleteMany({ where: { empresaId } });
  await tx.gastoIndireto.deleteMany({ where: { empresaId } });
  await tx.canalVenda.deleteMany({ where: { empresaId } });
}

/** Estado de um insumo enquanto o seed avança no tempo. */
interface InsumoSeed {
  id: number;
  estoqueId: number;
  saldo: number;
  valorPago: number;
  quantidadeBaseCusto: number;
  custoMedio: number;
  ultimoCusto: number;
  precoMercado: number | null;
  precoMercadoData: Date | null;
}

async function semear(tx: Tx, senhaHash: string): Promise<number> {
  const empresa = await tx.empresa.upsert({
    where: { cnpj: EMPRESA.cnpj },
    create: EMPRESA,
    update: EMPRESA,
  });
  const empresaId = empresa.id;
  await limparEmpresa(tx, empresaId);

  // Configuração de custos do seed (BE-33), regravada a cada seed.
  await tx.configuracaoCustos.upsert({
    where: { empresaId },
    create: { ...CONFIGURACAO, empresaId },
    update: { ...CONFIGURACAO },
  });

  // Canais de venda (BE-25), recriados a cada seed.
  const canais = new Map<
    string,
    { id: number; balcao: boolean; comissaoPercentual: number }
  >();
  for (const def of CANAIS) {
    canais.set(
      def.nome,
      await tx.canalVenda.create({ data: { ...def, empresaId } }),
    );
  }
  const canal = (nome: string) => {
    const c = canais.get(nome);
    if (!c) throw new Error(`Canal desconhecido no seed: ${nome}`);
    return c;
  };

  for (const usuario of USUARIOS) {
    const dados = { ...usuario, empresaId, senha: senhaHash };
    await tx.usuario.upsert({
      where: { email: usuario.email },
      create: dados,
      update: dados,
    });
  }

  // Insumos com a compra inicial, como POST /insumos com saldo inicial
  // (BE-29): estoque e entrada ENTRADA/COMPRA ligada à compra.
  const insumos = new Map<string, InsumoSeed>();
  for (const def of INSUMOS) {
    const custo = calcularCustoUnitario(def.valorPago, def.quantidadeBaseCusto);
    const data = diasAtras(180);
    const criado = await tx.insumo.create({
      data: {
        empresaId,
        nome: def.nome,
        quantidadeBaseCusto: def.quantidadeBaseCusto,
        unidade: def.unidade,
        valorPago: def.valorPago,
        custoMedio: custo,
        ultimoCusto: custo,
        dataCriacao: data,
      },
    });
    const compra = await tx.compraInsumo.create({
      data: {
        empresaId,
        insumoId: criado.id,
        quantidade: def.estoqueInicial,
        valorTotal: def.estoqueInicial * custo,
        custoUnitario: custo,
        observacao: 'Cadastro do insumo',
        dataCompra: data,
      },
    });
    const estoque = await tx.estoque.create({
      data: {
        empresaId,
        insumoId: criado.id,
        quantidadeDisponivel: def.estoqueInicial,
        quantidadeMinima: def.estoqueMinimo,
      },
    });
    await tx.movimentacaoEstoque.create({
      data: {
        empresaId,
        insumoId: criado.id,
        tipo: 'ENTRADA',
        origem: 'COMPRA',
        quantidade: def.estoqueInicial,
        referenciaId: compra.id,
        observacao: 'Cadastro do insumo',
        dataMovimentacao: data,
      },
    });
    insumos.set(def.chave, {
      id: criado.id,
      estoqueId: estoque.id,
      saldo: def.estoqueInicial,
      valorPago: def.valorPago,
      quantidadeBaseCusto: def.quantidadeBaseCusto,
      custoMedio: custo,
      ultimoCusto: custo,
      precoMercado: null,
      precoMercadoData: null,
    });
  }
  const insumo = (chave: string) => {
    const i = insumos.get(chave);
    if (!i) throw new Error(`Insumo desconhecido no seed: ${chave}`);
    return i;
  };

  const gastos: GastoIndireto[] = [];
  for (const def of GASTOS) {
    gastos.push(await tx.gastoIndireto.create({ data: { empresaId, ...def } }));
  }
  const gastosPercentuais = somarGastosPercentuais(gastos);

  // Receitas: só a ficha técnica é gravada (BE-27); a API calcula o custo na
  // leitura. `custoDe` repete a conta com os custos do momento: a reposição
  // forma o preço, e o custo médio é o da produção e da venda (BE-30).
  const receitas = new Map<
    string,
    { id: number; def: (typeof RECEITAS)[number] }
  >();
  for (const def of RECEITAS) {
    const criada = await tx.receita.create({
      data: {
        empresaId,
        nome: def.nome,
        rendimento: def.rendimento,
        unidadeRendimento: 'UN',
        usoPorLote: def.usoPorLote,
        embalagemPorUnidade: def.embalagemPorUnidade,
        perdaPercentual: def.perdaPercentual,
        lucroPercentual: def.lucroPercentual,
        dataCriacao: diasAtras(179),
        itens: {
          create: def.itens.map(([chave, quantidade]) => ({
            insumoId: insumo(chave).id,
            quantidade,
          })),
        },
      },
    });
    receitas.set(def.chave, { id: criada.id, def });
  }
  const receita = (chave: string) => {
    const r = receitas.get(chave);
    if (!r) throw new Error(`Receita desconhecida no seed: ${chave}`);
    return r;
  };
  const custoDe = (chave: string, base: 'medio' | 'reposicao') => {
    const { def } = receita(chave);
    return calcularCustoReceita({
      itens: def.itens.map(([c, quantidade]) => {
        const i = insumo(c);
        return {
          insumoId: i.id,
          quantidade,
          custoUnitario:
            base === 'medio' ? i.custoMedio : calcularCustoReposicao(i),
        };
      }),
      rendimento: def.rendimento,
      usoPorLote: def.usoPorLote,
      embalagemPorUnidade: def.embalagemPorUnidade,
      perdaPercentual: def.perdaPercentual,
      gastos,
      capacidadeMensal: CONFIGURACAO.capacidadeMensal,
    });
  };

  // Produções com todos os gastos, como POST /producoes sem
  // gasto_indireto_ids (BE-30): ingredientes ao custo médio e os gastos
  // mensais do forno; baixa dos insumos (SAIDA/PRODUCAO) e entrada no
  // produto acabado.
  const saldoProduto = new Map<number, number>();
  for (const def of PRODUCOES) {
    const r = receita(def.receita);
    const data = diasAtras(def.diasAtras);
    const calculo = calcularProducao(
      {
        rendimento: r.def.rendimento,
        ingredientesLote: custoDe(def.receita, 'medio').detalhe
          .ingredientesLote,
        usoPorLote: r.def.usoPorLote,
      },
      def.lotes,
      gastos,
      CONFIGURACAO.capacidadeMensal,
    );
    const producao = await tx.producao.create({
      data: {
        empresaId,
        receitaId: r.id,
        quantidade: def.lotes,
        totalUnidades: calculo.totalUnidades,
        custoTotal: calculo.custoTotal,
        custoUnitario: calculo.custoUnitario,
        dataProducao: data,
        rateios: { create: calculo.rateios },
      },
    });
    for (const [chave, porLote] of r.def.itens) {
      const i = insumo(chave);
      const quantidade = calcularQuantidadeBaixa(porLote, def.lotes);
      i.saldo = calcularSaldoAposMovimentacao(i.saldo, 'SAIDA', quantidade);
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId,
          insumoId: i.id,
          tipo: 'SAIDA',
          origem: 'PRODUCAO',
          quantidade,
          referenciaId: producao.id,
          dataMovimentacao: data,
        },
      });
    }
    saldoProduto.set(
      r.id,
      calcularSaldoAposMovimentacao(
        saldoProduto.get(r.id) ?? 0,
        'ENTRADA',
        calculo.totalUnidades,
      ),
    );
    await tx.movimentacaoProdutoAcabado.create({
      data: {
        empresaId,
        receitaId: r.id,
        tipo: 'ENTRADA',
        origem: 'PRODUCAO',
        quantidade: calculo.totalUnidades,
        referenciaId: producao.id,
        dataMovimentacao: data,
      },
    });
  }

  // Compras, como POST /insumos/:id/compras (BE-29): entrada no estoque,
  // custo médio ponderado pelo saldo de antes, e a compra vira o último custo
  // e o preço de referência, sem preço de mercado.
  for (const def of COMPRAS) {
    const i = insumo(def.insumo);
    const data = diasAtras(def.diasAtras);
    const custoCompra = calcularCustoUnitario(def.valorTotal, def.quantidade);
    const compra = await tx.compraInsumo.create({
      data: {
        empresaId,
        insumoId: i.id,
        quantidade: def.quantidade,
        valorTotal: def.valorTotal,
        custoUnitario: custoCompra,
        observacao: def.observacao,
        dataCompra: data,
      },
    });
    await tx.movimentacaoEstoque.create({
      data: {
        empresaId,
        insumoId: i.id,
        tipo: 'ENTRADA',
        origem: 'COMPRA',
        quantidade: def.quantidade,
        referenciaId: compra.id,
        observacao: def.observacao,
        dataMovimentacao: data,
      },
    });
    i.custoMedio = calcularCustoMedio(
      i.saldo,
      i.custoMedio,
      def.quantidade,
      custoCompra,
    );
    i.saldo = calcularSaldoAposMovimentacao(i.saldo, 'ENTRADA', def.quantidade);
    i.ultimoCusto = custoCompra;
    i.valorPago = def.valorTotal;
    i.quantidadeBaseCusto = def.quantidade;
    i.precoMercado = null;
    i.precoMercadoData = null;
  }
  for (const def of PRECOS_MERCADO) {
    const i = insumo(def.insumo);
    i.precoMercado = def.precoMercado;
    i.precoMercadoData = diasAtras(def.diasAtras);
  }

  // Vendas, como POST /vendas (BE-30): o preço sugerido no canal (com a
  // reposição) em centavos, o custo com o custo médio e o lucro real pelos
  // percentuais do canal. A concluída dá baixa no produto acabado
  // (SAIDA/VENDA), como PATCH /vendas/:id/status.
  for (const def of VENDAS) {
    const data = dataNoMes(def.mesesAtras, def.dia);
    const c = canal(def.canal ?? 'Balcão');
    const nova = Venda.nova(
      empresaId,
      def.itens.map(([chave, quantidade]) => {
        const r = receita(chave);
        const { preco } = calcularPrecoNoCanal(
          custoDe(chave, 'reposicao').detalhe,
          c,
          {
            impostoPercentual: CONFIGURACAO.impostoPercentual,
            taxaMaquininha: CONFIGURACAO.taxaMaquininha,
            gastosPercentuais,
            lucro: r.def.lucroPercentual ?? CONFIGURACAO.lucroPadrao,
          },
        );
        if (preco === null) {
          throw new Error(`Receita sem preço no seed: ${chave}`);
        }
        return {
          receitaId: r.id,
          quantidade,
          precoUnitarioReal: round2(preco),
          custoUnitario: custoDe(chave, 'medio').custoUnitario,
        };
      }),
      {
        canalId: c.id,
        percentuaisSemLucro: calcularPercentuaisSemLucro(c, {
          impostoPercentual: CONFIGURACAO.impostoPercentual,
          taxaMaquininha: CONFIGURACAO.taxaMaquininha,
          gastosPercentuais,
        }),
      },
    );
    const venda = await tx.venda.create({
      data: {
        empresaId,
        canalId: nova.canalId,
        total: nova.total,
        status: def.status,
        dataVenda: data,
        itens: { create: nova.itens },
      },
    });
    if (def.status !== 'CONCLUIDA') continue;
    for (const item of nova.itens) {
      saldoProduto.set(
        item.receitaId,
        calcularSaidaProdutoAcabado(
          item.receitaId,
          saldoProduto.get(item.receitaId) ?? 0,
          item.quantidade,
        ),
      );
      await tx.movimentacaoProdutoAcabado.create({
        data: {
          empresaId,
          receitaId: item.receitaId,
          tipo: 'SAIDA',
          origem: 'VENDA',
          quantidade: item.quantidade,
          referenciaId: venda.id,
          dataMovimentacao: data,
        },
      });
    }
  }

  // Custos e saldos finais.
  for (const i of insumos.values()) {
    await tx.insumo.update({
      where: { id: i.id },
      data: {
        valorPago: i.valorPago,
        quantidadeBaseCusto: i.quantidadeBaseCusto,
        custoMedio: i.custoMedio,
        ultimoCusto: i.ultimoCusto,
        precoMercado: i.precoMercado,
        precoMercadoData: i.precoMercadoData,
      },
    });
    await tx.estoque.update({
      where: { id: i.estoqueId },
      data: { quantidadeDisponivel: i.saldo },
    });
  }
  await tx.estoqueProdutoAcabado.createMany({
    data: [...saldoProduto].map(([receitaId, quantidadeDisponivel]) => ({
      empresaId,
      receitaId,
      quantidadeDisponivel,
    })),
  });

  return empresaId;
}

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('O seed de demonstração não roda com NODE_ENV=production.');
  }
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL não definida.');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const senhaHash = await argon2.hash(SENHA_DEMO);
    const empresaId = await prisma.$transaction((tx) => semear(tx, senhaHash), {
      timeout: 60_000,
    });
    console.log(`Seed concluído: ${EMPRESA.nome} (id=${empresaId}).`);
    console.log(`Login de demonstração: ${USUARIOS[0]?.email} / ${SENHA_DEMO}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  console.error(erro);
  process.exit(1);
});
