/**
 * Seed de demonstração (BE-14): a Padaria Pão Feliz, com login e dados na
 * mesma empresa. Idempotente: apaga e recria os dados da empresa do seed
 * (achada pelo CNPJ) numa transação só. Os custos usam as funções de
 * `domain/` dos módulos, para baterem com os da API.
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
import { calcularCustoUnitario } from '../src/modules/insumos/domain/insumos.calculos.js';
import { calcularProducao } from '../src/modules/producoes/domain/producoes.calculos.js';
import {
  calcularCustoReceita,
  calcularPrecoNoCanal,
  lucroDaMargem,
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

// Tipos da BE-26: os gastos do mês são MENSAL; a embalagem genérica é
// POR_UNIDADE, em reais por unidade (não mais o total do mês).
const GASTOS: {
  descricao: string;
  valor: number;
  tipo: TipoGasto;
}[] = [
  { descricao: 'Energia Elétrica', valor: 450, tipo: 'MENSAL' },
  { descricao: 'Aluguel do Espaço', valor: 1800, tipo: 'MENSAL' },
  { descricao: 'Gás de Cozinha (P45)', valor: 185, tipo: 'MENSAL' },
  { descricao: 'Saquinho de Papel', valor: 0.1, tipo: 'POR_UNIDADE' },
];

// Mesmos itens do recipe-service (quantidade por lote). A margem (markup) de
// lá vira lucro sobre o preço (BE-27) com `lucroDaMargem`, que dá o mesmo
// preço sugerido. Uso de forno, embalagem e perda ficam nos padrões até a
// BE-33 revisar o seed.
const RECEITAS: {
  chave: string;
  nome: string;
  rendimento: number;
  margemLucro: number;
  itens: [string, number][];
}[] = [
  {
    chave: 'PAO',
    nome: 'Pão Francês',
    rendimento: 50,
    margemLucro: 0.6,
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
    margemLucro: 0.5,
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
    margemLucro: 0.6,
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
    margemLucro: 0.55,
    itens: [
      ['ACUCAR', 0.3],
      ['OVOS', 6],
      ['COCO', 100],
      ['MANTEIGA', 20],
    ],
  },
];

// Mesmas 4 produções do operations-service, cerca de 6 meses atrás.
const PRODUCOES: { receita: string; lotes: number; diasAtras: number }[] = [
  { receita: 'PAO', lotes: 3, diasAtras: 178 },
  { receita: 'BOLO', lotes: 2, diasAtras: 177 },
  { receita: 'BRIGADEIRO', lotes: 1, diasAtras: 176 },
  { receita: 'QUINDIM', lotes: 1, diasAtras: 175 },
];

// As 5 vendas do sales-service mais 3 concluídas, para cada um dos 6 meses do
// painel ter faturamento (inclusive o mês atual). `mesesAtras` 0 = mês atual
// (aí `dia` conta dias para trás, ver `dataNoMes`).
// O preço cobrado é o preço sugerido da receita: com os custos de hoje (lacuna
// 18), os preços fixos de lá (R$ 0,50 o pão) dariam margens muito negativas.
const VENDAS: {
  status: StatusVenda;
  mesesAtras: number;
  dia: number;
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
  { status: 'CONCLUIDA', mesesAtras: 3, dia: 8, itens: [['BRIGADEIRO', 10]] },
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
      ['BOLO', 4],
    ],
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

function idPor(mapa: Map<string, number>, chave: string): number {
  const id = mapa.get(chave);
  if (id === undefined) throw new Error(`Chave desconhecida no seed: ${chave}`);
  return id;
}

/** Apaga os dados da empresa, na ordem das FKs; mantém a empresa e os usuários. */
async function limparEmpresa(tx: Tx, empresaId: number): Promise<void> {
  await tx.venda.deleteMany({ where: { empresaId } }); // itens em CASCADE
  await tx.movimentacaoProdutoAcabado.deleteMany({ where: { empresaId } });
  await tx.estoqueProdutoAcabado.deleteMany({ where: { empresaId } });
  await tx.producao.deleteMany({ where: { empresaId } }); // rateios em CASCADE
  await tx.receita.deleteMany({ where: { empresaId } }); // itens em CASCADE
  await tx.movimentacaoEstoque.deleteMany({ where: { empresaId } });
  await tx.estoque.deleteMany({ where: { empresaId } });
  await tx.insumo.deleteMany({ where: { empresaId } });
  await tx.gastoIndireto.deleteMany({ where: { empresaId } });
  await tx.canalVenda.deleteMany({ where: { empresaId } });
}

async function semear(tx: Tx, senhaHash: string): Promise<number> {
  const empresa = await tx.empresa.upsert({
    where: { cnpj: EMPRESA.cnpj },
    create: EMPRESA,
    update: EMPRESA,
  });
  const empresaId = empresa.id;
  await limparEmpresa(tx, empresaId);

  // Configuração de custos com os padrões (BE-24); volta a eles a cada seed.
  await tx.configuracaoCustos.upsert({
    where: { empresaId },
    create: { ...CONFIGURACAO_CUSTOS_PADRAO, empresaId },
    update: { ...CONFIGURACAO_CUSTOS_PADRAO },
  });

  // Canais de venda padrão (BE-25), recriados a cada seed.
  for (const canal of CANAIS_PADRAO) {
    await tx.canalVenda.create({ data: { ...canal, empresaId } });
  }

  for (const usuario of USUARIOS) {
    const dados = { ...usuario, empresaId, senha: senhaHash };
    await tx.usuario.upsert({
      where: { email: usuario.email },
      create: dados,
      update: dados,
    });
  }

  // Insumos, saldo e a entrada inicial (ENTRADA/COMPRA).
  const insumoIds = new Map<string, number>();
  const custoInsumo = new Map<number, number>();
  const saldoInsumo = new Map<number, { estoqueId: number; saldo: number }>();
  for (const def of INSUMOS) {
    const custoUnitario = calcularCustoUnitario(
      def.valorPago,
      def.quantidadeBaseCusto,
    );
    const insumo = await tx.insumo.create({
      data: {
        empresaId,
        nome: def.nome,
        quantidadeBaseCusto: def.quantidadeBaseCusto,
        unidade: def.unidade,
        valorPago: def.valorPago,
        custoMedio: custoUnitario,
        ultimoCusto: custoUnitario,
        dataCriacao: diasAtras(180),
      },
    });
    const estoque = await tx.estoque.create({
      data: {
        empresaId,
        insumoId: insumo.id,
        quantidadeDisponivel: def.estoqueInicial,
        quantidadeMinima: def.estoqueMinimo,
      },
    });
    await tx.movimentacaoEstoque.create({
      data: {
        empresaId,
        insumoId: insumo.id,
        tipo: 'ENTRADA',
        origem: 'COMPRA',
        quantidade: def.estoqueInicial,
        observacao: 'Estoque inicial',
        dataMovimentacao: diasAtras(180),
      },
    });
    insumoIds.set(def.chave, insumo.id);
    custoInsumo.set(insumo.id, custoUnitario);
    saldoInsumo.set(insumo.id, {
      estoqueId: estoque.id,
      saldo: def.estoqueInicial,
    });
  }

  const gastos = [];
  for (const def of GASTOS) {
    gastos.push(await tx.gastoIndireto.create({ data: { empresaId, ...def } }));
  }

  // Receitas e o custo de 1 lote com todos os gastos, que não é gravado:
  // a API o calcula na leitura (BE-27).
  const receitas = new Map<
    string,
    {
      id: number;
      rendimento: number;
      custoProducao: number;
      custoUnitario: number;
      precoSugerido: number;
      itens: { insumoId: number; quantidade: number }[];
    }
  >();
  for (const def of RECEITAS) {
    const itens = def.itens.map(([chave, quantidade]) => {
      const insumoId = idPor(insumoIds, chave);
      return {
        insumoId,
        quantidade,
        custoUnitario: custoInsumo.get(insumoId) ?? 0,
      };
    });
    const lucroPercentual = lucroDaMargem(def.margemLucro);
    const custo = calcularCustoReceita({
      itens,
      rendimento: def.rendimento,
      gastos,
      capacidadeMensal: CONFIGURACAO_CUSTOS_PADRAO.capacidadeMensal,
    });
    // Preço sugerido do Balcão (BE-28), o que a API mostra em `precoSugerido`.
    const precoBalcao = calcularPrecoNoCanal(
      custo.detalhe,
      { balcao: true, comissaoPercentual: 0 },
      {
        impostoPercentual: CONFIGURACAO_CUSTOS_PADRAO.impostoPercentual,
        taxaMaquininha: CONFIGURACAO_CUSTOS_PADRAO.taxaMaquininha,
        gastosPercentuais: somarGastosPercentuais(gastos),
        lucro: lucroPercentual,
      },
    );
    const receita = await tx.receita.create({
      data: {
        empresaId,
        nome: def.nome,
        rendimento: def.rendimento,
        unidadeRendimento: 'UN',
        lucroPercentual,
        dataCriacao: diasAtras(179),
        itens: {
          create: custo.itens.map(({ insumoId, quantidade }) => ({
            insumoId,
            quantidade,
          })),
        },
      },
    });
    receitas.set(def.chave, {
      id: receita.id,
      rendimento: def.rendimento,
      custoProducao: custo.custoProducao,
      custoUnitario: custo.custoUnitario,
      precoSugerido: precoBalcao.preco ?? 0,
      itens: custo.itens,
    });
  }
  const receita = (chave: string) => {
    const r = receitas.get(chave);
    if (!r) throw new Error(`Receita desconhecida no seed: ${chave}`);
    return r;
  };

  // Produções com todos os gastos (como POST /producoes sem gasto_indireto_ids):
  // baixa dos insumos (SAIDA/PRODUCAO) e entrada no produto acabado.
  const saldoProduto = new Map<number, number>();
  for (const def of PRODUCOES) {
    const r = receita(def.receita);
    const data = diasAtras(def.diasAtras);
    const calculo = calcularProducao(
      r,
      def.lotes,
      gastos,
      CONFIGURACAO_CUSTOS_PADRAO.capacidadeMensal,
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
    for (const item of r.itens) {
      const quantidade = calcularQuantidadeBaixa(item.quantidade, def.lotes);
      const estoque = saldoInsumo.get(item.insumoId);
      if (!estoque) throw new Error('Insumo sem estoque no seed');
      estoque.saldo = calcularSaldoAposMovimentacao(
        estoque.saldo,
        'SAIDA',
        quantidade,
      );
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId,
          insumoId: item.insumoId,
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

  // Vendas: total e margem pela entidade Venda; a concluída dá baixa no
  // produto acabado (SAIDA/VENDA), como PATCH /vendas/:id/status.
  for (const def of VENDAS) {
    const data = dataNoMes(def.mesesAtras, def.dia);
    const nova = Venda.nova(
      empresaId,
      def.itens.map(([chave, quantidade]) => {
        const r = receita(chave);
        return {
          receitaId: r.id,
          quantidade,
          // O preço cobrado tem centavos, como o digitado na tela; o preço
          // sugerido é guardado sem arredondar (BE-23).
          precoUnitarioReal: round2(r.precoSugerido),
          custoUnitario: r.custoUnitario,
        };
      }),
    );
    const venda = await tx.venda.create({
      data: {
        empresaId,
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

  // Saldos finais.
  for (const { estoqueId, saldo } of saldoInsumo.values()) {
    await tx.estoque.update({
      where: { id: estoqueId },
      data: { quantidadeDisponivel: saldo },
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
