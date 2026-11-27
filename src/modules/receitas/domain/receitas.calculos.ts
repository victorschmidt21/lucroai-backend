import { round6 } from '../../../shared/domain/arredondamento.js';
import {
  BusinessRuleError,
  ConflictError,
  type DetalheErro,
  InvalidInputError,
} from '../../../shared/domain/errors/domain.error.js';
import {
  type CanalParaTaxa,
  taxaDoCanal,
} from '../../canais/domain/canais.calculos.js';
import {
  calcularGastoNoCusto,
  type GastoParaCusto,
} from '../../gastos-indiretos/domain/gastos-indiretos.calculos.js';

/**
 * Ficha técnica da receita (BE-27), além dos itens e do rendimento (unidades
 * **boas** por lote).
 */
export interface FichaTecnica {
  /** Fornadas ou minutos de forno de 1 lote, conforme a `baseRateio`. */
  usoPorLote: number;
  /** Reais por unidade (caixa, pote ou saquinho do próprio produto). */
  embalagemPorUnidade: number;
  /** Fração das unidades que não são vendidas (sobra, queima). */
  perdaPercentual: number;
  /** Fração do **preço**; `null` usa o `lucroPadrao` da empresa. */
  lucroPercentual: number | null;
  /**
   * Minutos em que a dona fica ocupada com 1 lote (preparar, mexer, montar,
   * embalar), sem o tempo sozinha no forno ou na geladeira (BE-45).
   */
  minutosTrabalhoPorLote: number;
}

/** Padrões de uma receita criada sem os campos da ficha técnica. */
export const FICHA_TECNICA_PADRAO: Readonly<FichaTecnica> = Object.freeze({
  usoPorLote: 1,
  embalagemPorUnidade: 0,
  perdaPercentual: 0,
  lucroPercentual: null,
  minutosTrabalhoPorLote: 0,
});

/**
 * Ficha técnica a gravar: campo omitido (`undefined`) mantém o salvo (no
 * cadastro, o padrão). `null` também mantém, menos em `lucroPercentual`, em
 * que `null` volta a usar o lucro padrão da empresa.
 */
export function resolverFichaTecnica(
  informada: {
    usoPorLote?: number | null;
    embalagemPorUnidade?: number | null;
    perdaPercentual?: number | null;
    lucroPercentual?: number | null;
    minutosTrabalhoPorLote?: number | null;
  },
  salva: FichaTecnica = FICHA_TECNICA_PADRAO,
): FichaTecnica {
  return {
    usoPorLote: informada.usoPorLote ?? salva.usoPorLote,
    embalagemPorUnidade:
      informada.embalagemPorUnidade ?? salva.embalagemPorUnidade,
    perdaPercentual: informada.perdaPercentual ?? salva.perdaPercentual,
    lucroPercentual:
      informada.lucroPercentual === undefined
        ? salva.lucroPercentual
        : informada.lucroPercentual,
    minutosTrabalhoPorLote:
      informada.minutosTrabalhoPorLote ?? salva.minutosTrabalhoPorLote,
  };
}

/**
 * Confere a ficha técnica já mesclada com a salva: uso de forno > 0,
 * embalagem ≥ 0, perda e lucro de 0 até menos de 1, minutos de trabalho ≥ 0. Perda ou lucro de 100%
 * não têm preço possível (divisão por zero). Lança 400 `DADOS_INVALIDOS`, no
 * formato do ValidationPipe, com um detalhe por campo do corpo.
 */
export function validarFichaTecnica(ficha: FichaTecnica): void {
  const details: DetalheErro[] = [];
  if (!Number.isFinite(ficha.usoPorLote) || ficha.usoPorLote <= 0) {
    details.push({
      field: 'uso_por_lote',
      messages: ['uso_por_lote deve ser maior que zero'],
    });
  }
  if (
    !Number.isFinite(ficha.embalagemPorUnidade) ||
    ficha.embalagemPorUnidade < 0
  ) {
    details.push({
      field: 'embalagem_por_unidade',
      messages: ['embalagem_por_unidade não pode ser negativa'],
    });
  }
  if (!fracaoMenorQueUm(ficha.perdaPercentual)) {
    details.push({
      field: 'perda_percentual',
      messages: ['perda_percentual deve ser uma fração de 0 até menos de 1'],
    });
  }
  if (
    ficha.lucroPercentual != null &&
    !fracaoMenorQueUm(ficha.lucroPercentual)
  ) {
    details.push({
      field: 'lucro_percentual',
      messages: ['lucro_percentual deve ser uma fração de 0 até menos de 1'],
    });
  }
  if (
    !Number.isFinite(ficha.minutosTrabalhoPorLote) ||
    ficha.minutosTrabalhoPorLote < 0
  ) {
    details.push({
      field: 'minutos_trabalho_por_lote',
      messages: ['minutos_trabalho_por_lote não pode ser negativo'],
    });
  }
  if (details.length > 0) {
    throw new InvalidInputError(
      'DADOS_INVALIDOS',
      'Os dados enviados são inválidos',
      details,
    );
  }
}

function fracaoMenorQueUm(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0 && valor < 1;
}

/**
 * Compatibilidade com o formulário atual, que envia `margem_lucro` (markup
 * sobre o custo): vira lucro sobre o preço, `margem ÷ (1 + margem)`, que dá
 * o mesmo preço sugerido (`custo × (1 + margem) = custo ÷ (1 − lucro)`).
 */
export function lucroDaMargem(margem: number): number {
  return margem / (1 + margem);
}

/** O inverso de `lucroDaMargem`: `lucro ÷ (1 − lucro)`; `null` com lucro ≥ 1. */
export function margemDoLucro(lucro: number): number | null {
  if (lucro >= 1) return null;
  return lucro / (1 - lucro);
}

/**
 * `lucroPercentual` informado no corpo: `lucro_percentual` tem prioridade;
 * sem ele, `margem_lucro` (compatibilidade) é convertida. `null` em qualquer
 * dos dois volta ao lucro padrão da empresa. Os dois omitidos → `undefined`
 * (mantém o salvo).
 */
export function lucroPercentualInformado(corpo: {
  lucro_percentual?: number | null;
  margem_lucro?: number | null;
}): number | null | undefined {
  if (corpo.lucro_percentual !== undefined) return corpo.lucro_percentual;
  if (corpo.margem_lucro === undefined) return undefined;
  return corpo.margem_lucro === null ? null : lucroDaMargem(corpo.margem_lucro);
}

/** Receita usada dentro de outra (BE-39), já conferida contra a empresa. */
export interface ReceitaParaUso {
  id: number;
  /** Se ela mesma já usa receitas dentro. */
  temReceitas: boolean;
}

export interface ItensDaReceita {
  /** `null` no cadastro. */
  receitaId: number | null;
  quantidadeInsumos: number;
  /** Ids da lista `receitas` do corpo (ou os salvos), na ordem. */
  receitaUsadaIds: number[];
  /** As receitas da lista, buscadas na empresa. */
  usadas: ReceitaParaUso[];
  /** Se a receita já é usada dentro de outra. */
  usadaEmOutra: boolean;
}

/**
 * Itens da receita (BE-39): ao menos um insumo ou receita; sem receita
 * repetida (400 `DADOS_INVALIDOS`); sem usar a si mesma (422
 * `RECEITA_USA_ELA_MESMA`) e **um nível só** (422
 * `RECEITA_DENTRO_DE_RECEITA_COM_RECEITA`): a receita usada não pode ter
 * receitas dentro, e a que já é usada em outra não pode ganhar receitas.
 */
export function validarItensDaReceita(itens: ItensDaReceita): void {
  const ids = itens.receitaUsadaIds;
  if (itens.quantidadeInsumos + ids.length === 0) {
    throw new InvalidInputError(
      'DADOS_INVALIDOS',
      'Os dados enviados são inválidos',
      [
        {
          field: 'insumos',
          messages: ['a receita precisa de ao menos um insumo ou receita'],
        },
      ],
    );
  }
  if (new Set(ids).size !== ids.length) {
    throw new InvalidInputError(
      'DADOS_INVALIDOS',
      'Os dados enviados são inválidos',
      [{ field: 'receitas', messages: ['receitas não pode repetir receita'] }],
    );
  }
  if (itens.receitaId !== null && ids.includes(itens.receitaId)) {
    throw new BusinessRuleError(
      'RECEITA_USA_ELA_MESMA',
      'A receita não pode ser usada dentro dela mesma',
    );
  }
  if (ids.length > 0 && itens.usadaEmOutra) {
    throw new BusinessRuleError(
      'RECEITA_DENTRO_DE_RECEITA_COM_RECEITA',
      'Esta receita já é usada dentro de outra, então não pode ter receitas dentro',
    );
  }
  if (itens.usadas.some((usada) => usada.temReceitas)) {
    throw new BusinessRuleError(
      'RECEITA_DENTRO_DE_RECEITA_COM_RECEITA',
      'Só dá para usar receitas que levam apenas ingredientes',
    );
  }
}

/**
 * Receita usada dentro de outras não pode ser excluída (BE-39): 409
 * `RECEITA_EM_USO` com os nomes de quem a usa.
 */
export function validarExclusaoDaReceita(usadaEm: string[]): void {
  if (usadaEm.length > 0) {
    throw new ConflictError(
      'RECEITA_EM_USO',
      `Receita usada em outras receitas não pode ser excluída: ${usadaEm.join(', ')}`,
    );
  }
}

/**
 * A unidade do rendimento de uma receita usada em outras não muda (BE-39):
 * as quantidades delas estão nessa unidade. 409 `RECEITA_EM_USO`.
 */
export function validarMudancaDeUnidade(
  atual: string,
  nova: string | undefined,
  usadaEm: string[],
): void {
  if (nova !== undefined && nova !== atual && usadaEm.length > 0) {
    throw new ConflictError(
      'RECEITA_EM_USO',
      `A unidade do rendimento não pode mudar enquanto a receita é usada em: ${usadaEm.join(', ')}`,
    );
  }
}

export interface ItemParaCusto {
  insumoId: number;
  quantidade: number;
  /** Custo unitário atual do insumo, sem arredondamento. */
  custoUnitario: number;
}

export interface ItemCalculado {
  insumoId: number;
  quantidade: number;
  custoCalculado: number;
}

/**
 * Soma dos gastos `MENSAL` que cabem em 1 lote (BE-28):
 * `Σ valor × usoPorLote ÷ capacidadeMensal`.
 */
export function somarGastosMensaisLote(
  gastos: GastoParaCusto[],
  usoPorLote: number,
  capacidadeMensal: number,
): number {
  return gastos
    .filter((gasto) => gasto.tipo === 'MENSAL')
    .reduce(
      (total, gasto) =>
        total +
        calcularGastoNoCusto(gasto, {
          lotes: 1,
          totalUnidades: 0,
          capacidadeMensal,
          usoPorLote,
        }),
      0,
    );
}

/** Soma dos gastos `MENSAL`: os gastos do mês inteiro (BE-31). */
export function somarGastosMensais(gastos: GastoParaCusto[]): number {
  return gastos
    .filter((gasto) => gasto.tipo === 'MENSAL')
    .reduce((total, gasto) => total + gasto.valor, 0);
}

/** Soma dos gastos `POR_UNIDADE` (reais por unidade, BE-28). */
export function somarGastosPorUnidade(gastos: GastoParaCusto[]): number {
  return gastos
    .filter((gasto) => gasto.tipo === 'POR_UNIDADE')
    .reduce((total, gasto) => total + gasto.valor, 0);
}

/** Soma dos gastos `PERCENTUAL_VENDA` (fração do preço, BE-28). */
export function somarGastosPercentuais(gastos: GastoParaCusto[]): number {
  return gastos
    .filter((gasto) => gasto.tipo === 'PERCENTUAL_VENDA')
    .reduce((total, gasto) => total + gasto.valor, 0);
}

/**
 * Seu trabalho em 1 lote (BE-46): `minutosTrabalhoPorLote ÷ 60 × valorHora`.
 * Sem arredondar (BE-23).
 */
export function calcularTrabalhoLote(
  minutosTrabalhoPorLote: number,
  valorHora: number,
): number {
  return (minutosTrabalhoPorLote / 60) * valorHora;
}

export interface CustoUnitarioInput {
  /** `Σ quantidade × custo do insumo` de 1 lote. */
  ingredientesLote: number;
  /** `somarGastosMensaisLote`. */
  gastosMensaisLote: number;
  /** `calcularTrabalhoLote` (BE-46); 0 se omitido. */
  trabalhoLote?: number;
  /** Unidades boas por lote, > 0. */
  rendimento: number;
  embalagemPorUnidade: number;
  /** `somarGastosPorUnidade`. */
  gastosPorUnidade: number;
  /** De 0 até menos de 1 (`validarFichaTecnica`). */
  perdaPercentual: number;
}

/**
 * Custo de 1 unidade e de onde ele vem (BE-28). As partes por unidade
 * (`ingredientes`, `gastosMensais`, `trabalho`, `gastosPorUnidade`,
 * `embalagem` e `perdas`) somam o `custoUnitario`.
 */
export interface CustoUnitarioDetalhado {
  ingredientesLote: number;
  gastosMensaisLote: number;
  /** Seu trabalho em 1 lote (BE-46). */
  trabalhoLote: number;
  ingredientes: number;
  gastosMensais: number;
  /** `trabalhoLote ÷ rendimento` (BE-46), antes da perda. */
  trabalho: number;
  gastosPorUnidade: number;
  embalagem: number;
  /** O que a perda acrescenta: `custoUnitario − custo sem perda`. */
  perdas: number;
  custoUnitario: number;
  /**
   * O custo variável (BE-31): `custoUnitario` sem a parte dos gastos
   * `MENSAL`, `(ingredientes + trabalho + embalagem + gastosPorUnidade) ÷
   * (1 − perda)`. É o que a margem de contribuição desconta. O trabalho
   * entra porque não depende da capacidade do mês (BE-46).
   */
  custoSemGastosMensais: number;
}

/**
 * **Muda (BE-28):**
 * `((ingredientesLote + gastosMensaisLote + trabalhoLote) ÷ rendimento +
 * embalagem + gastosPorUnidade) ÷ (1 − perda)`. **Muda (BE-46):** o
 * trabalho entra antes da perda, porque a unidade perdida também levou
 * trabalho. Sem arredondar (BE-23).
 */
export function calcularCustoUnitario(
  input: CustoUnitarioInput,
): CustoUnitarioDetalhado {
  const trabalhoLote = input.trabalhoLote ?? 0;
  const ingredientes = input.ingredientesLote / input.rendimento;
  const gastosMensais = input.gastosMensaisLote / input.rendimento;
  const trabalho = trabalhoLote / input.rendimento;
  const semPerda =
    ingredientes +
    gastosMensais +
    trabalho +
    input.embalagemPorUnidade +
    input.gastosPorUnidade;
  const custoUnitario = semPerda / (1 - input.perdaPercentual);
  const custoSemGastosMensais =
    (ingredientes +
      trabalho +
      input.embalagemPorUnidade +
      input.gastosPorUnidade) /
    (1 - input.perdaPercentual);
  return {
    ingredientesLote: input.ingredientesLote,
    gastosMensaisLote: input.gastosMensaisLote,
    trabalhoLote,
    ingredientes,
    gastosMensais,
    trabalho,
    gastosPorUnidade: input.gastosPorUnidade,
    embalagem: input.embalagemPorUnidade,
    perdas: custoUnitario - semPerda,
    custoUnitario,
    custoSemGastosMensais,
  };
}

/** Frações do **preço** que o preço de um canal precisa cobrir (BE-28). */
export interface PercentuaisPreco {
  imposto: number;
  /** Do Balcão: `taxaMaquininha`; dos outros: `comissaoPercentual`. */
  taxaCanal: number;
  /** `somarGastosPercentuais`. */
  gastosPercentuais: number;
  lucro: number;
}

export const MOTIVO_PERCENTUAIS_ACIMA_DE_100 = 'PERCENTUAIS_ACIMA_DE_100';
export type MotivoSemPreco = typeof MOTIVO_PERCENTUAIS_ACIMA_DE_100;

/** Uma parte do preço, em reais e em fração do preço. */
export interface ParteDoPreco {
  valor: number;
  fracao: number;
}

/** "Para onde vai cada R$ 1" do preço: as partes somam o preço (e 1). */
export interface ComposicaoPreco {
  ingredientes: ParteDoPreco;
  gastosMensais: ParteDoPreco;
  /** Seu trabalho (BE-46). */
  trabalho: ParteDoPreco;
  gastosPorUnidade: ParteDoPreco;
  embalagem: ParteDoPreco;
  perdas: ParteDoPreco;
  imposto: ParteDoPreco;
  taxaCanal: ParteDoPreco;
  gastosPercentuais: ParteDoPreco;
  lucro: ParteDoPreco;
}

export type PrecoCalculado =
  | {
      /** Soma das frações. */
      percentuais: number;
      preco: number;
      motivo: null;
      composicao: ComposicaoPreco;
    }
  | {
      percentuais: number;
      preco: null;
      motivo: MotivoSemPreco;
      composicao: null;
    };

/**
 * **Muda (BE-28):** `preço = custoUnitario ÷ (1 − percentuais)`, com
 * `percentuais = imposto + taxaCanal + gastosPercentuais + lucro`, todos
 * frações do preço: o lucro dividido pelo preço é exatamente o lucro
 * configurado. Com percentuais ≥ 100% não há preço possível. Sem arredondar
 * (BE-23); o `round6` só decide o "≥ 1" sem o ruído do ponto flutuante.
 */
export function calcularPreco(
  custo: CustoUnitarioDetalhado,
  p: PercentuaisPreco,
): PrecoCalculado {
  const percentuais = p.imposto + p.taxaCanal + p.gastosPercentuais + p.lucro;
  if (round6(percentuais) >= 1) {
    return {
      percentuais,
      preco: null,
      motivo: MOTIVO_PERCENTUAIS_ACIMA_DE_100,
      composicao: null,
    };
  }
  const preco = custo.custoUnitario / (1 - percentuais);
  const emReais = (valor: number): ParteDoPreco => ({
    valor,
    fracao: preco > 0 ? valor / preco : 0,
  });
  const doPreco = (fracao: number): ParteDoPreco => ({
    valor: fracao * preco,
    fracao,
  });
  return {
    percentuais,
    preco,
    motivo: null,
    composicao: {
      ingredientes: emReais(custo.ingredientes),
      gastosMensais: emReais(custo.gastosMensais),
      trabalho: emReais(custo.trabalho),
      gastosPorUnidade: emReais(custo.gastosPorUnidade),
      embalagem: emReais(custo.embalagem),
      perdas: emReais(custo.perdas),
      imposto: doPreco(p.imposto),
      taxaCanal: doPreco(p.taxaCanal),
      gastosPercentuais: doPreco(p.gastosPercentuais),
      lucro: doPreco(p.lucro),
    },
  };
}

/** O que o preço de qualquer canal usa da empresa e da receita. */
export interface BasePreco {
  impostoPercentual: number;
  taxaMaquininha: number;
  /** `somarGastosPercentuais` dos gastos da empresa. */
  gastosPercentuais: number;
  /** O da receita ou o `lucroPadrao` da empresa. */
  lucro: number;
}

/** Preço da receita num canal (BE-28): a taxa vem de `taxaDoCanal`. */
export function calcularPrecoNoCanal(
  custo: CustoUnitarioDetalhado,
  canal: CanalParaTaxa,
  base: BasePreco,
): PrecoCalculado {
  return calcularPreco(custo, {
    imposto: base.impostoPercentual,
    taxaCanal: taxaDoCanal(canal, base.taxaMaquininha),
    gastosPercentuais: base.gastosPercentuais,
    lucro: base.lucro,
  });
}

/**
 * Fração do preço que fica com o imposto, a taxa do canal e os gastos
 * `PERCENTUAL_VENDA`: os percentuais do preço sem o lucro (BE-30). É o que
 * a venda desconta no lucro real.
 */
export function calcularPercentuaisSemLucro(
  canal: CanalParaTaxa,
  base: Omit<BasePreco, 'lucro'>,
): number {
  return (
    base.impostoPercentual +
    taxaDoCanal(canal, base.taxaMaquininha) +
    base.gastosPercentuais
  );
}

/** Receita usada dentro de outra (BE-40), com o custo de 1 unidade dela. */
export interface ReceitaUsadaParaCusto {
  receitaId: number;
  /** Por lote, na unidade do rendimento da receita usada. */
  quantidade: number;
  /** `calcularCustoParaUsoEmReceita` da receita usada, sem arredondar. */
  custoUnitario: number;
}

export interface ReceitaUsadaCalculada {
  receitaId: number;
  quantidade: number;
  custoUnitario: number;
  /** `quantidade × custoUnitario`, sem arredondar. */
  custoCalculado: number;
}

export interface CustoReceitaInput {
  itens: ItemParaCusto[];
  /** Receitas usadas dentro desta (BE-40); `[]` se omitido. */
  receitas?: ReceitaUsadaParaCusto[];
  rendimento: number;
  /** Fornadas ou minutos de 1 lote (BE-27); 1 se omitido. */
  usoPorLote?: number;
  /** Reais por unidade (BE-27); 0 se omitido. */
  embalagemPorUnidade?: number;
  /** Fração das unidades perdidas (BE-27); 0 se omitido. */
  perdaPercentual?: number;
  /** Minutos de trabalho de 1 lote (BE-45); 0 se omitido. */
  minutosTrabalhoPorLote?: number;
  /** Da configuração de custos (BE-45), reais por hora; 0 se omitido. */
  valorHora?: number;
  /** Todos os gastos indiretos da empresa (lacuna 18). */
  gastos: GastoParaCusto[];
  /** Da configuração de custos da empresa (BE-24): divide os gastos `MENSAL`. */
  capacidadeMensal: number;
  /** Lotes produzidos; 1 se omitido. */
  lotes?: number;
}

export interface CustoReceita {
  /** Itens com a quantidade e o custo para `lotes` lotes. */
  itens: ItemCalculado[];
  /** Receitas usadas com a quantidade e o custo para `lotes` lotes (BE-40). */
  receitas: ReceitaUsadaCalculada[];
  lotes: number;
  /** `rendimento × lotes`. */
  totalUnidades: number;
  /** Soma dos itens e das receitas usadas (custo dos ingredientes) de `lotes` lotes. */
  custoIngredientes: number;
  /** Gastos `MENSAL` e `POR_UNIDADE` de `lotes` lotes. */
  custoInvisivel: number;
  /** `custoUnitario × totalUnidades` (BE-28: com embalagem e perda). */
  custoProducao: number;
  custoUnitario: number;
  /** De onde vem o custo de 1 unidade (BE-28). */
  detalhe: CustoUnitarioDetalhado;
}

/**
 * `quantidade × custoUnitario`, **sem arredondar** (BE-23): o custo do item
 * entra na soma da receita. Origem: `calcularItens` do `custo.service.ts`,
 * que arredondava cada item com `round2`.
 */
export function calcularCustoItem(
  quantidade: number,
  custoUnitario: number,
): number {
  return quantidade * custoUnitario;
}

/**
 * Custo de 1 unidade (grama, ml ou unidade do rendimento) de uma receita
 * usada dentro de outra (BE-40):
 * `(ingredientesLote + gastosMensaisLote + trabalhoLote) ÷ rendimento ÷
 * (1 − perda)`. Ingredientes, forno, seu trabalho (BE-46) e perda: a
 * embalagem e os gastos `POR_UNIDADE` não entram, porque já entram no
 * produto final. Na receita que usa, os minutos são só os da montagem. A
 * receita usada só tem insumos (um nível, BE-39). Sem arredondar (BE-23).
 */
export function calcularCustoParaUsoEmReceita(
  input: Omit<CustoReceitaInput, 'receitas' | 'lotes'>,
): number {
  return calcularCustoUnitario({
    ingredientesLote: somarItens(input.itens),
    gastosMensaisLote: somarGastosMensaisLote(
      input.gastos,
      input.usoPorLote ?? 1,
      input.capacidadeMensal,
    ),
    trabalhoLote: trabalhoLoteDe(input),
    rendimento: input.rendimento,
    embalagemPorUnidade: 0,
    gastosPorUnidade: 0,
    perdaPercentual: input.perdaPercentual ?? 0,
  }).custoUnitario;
}

function trabalhoLoteDe(input: {
  minutosTrabalhoPorLote?: number;
  valorHora?: number;
}): number {
  return calcularTrabalhoLote(
    input.minutosTrabalhoPorLote ?? 0,
    input.valorHora ?? 0,
  );
}

function somarItens(
  itens: { quantidade: number; custoUnitario: number }[],
): number {
  return itens.reduce(
    (total, item) =>
      total + calcularCustoItem(item.quantidade, item.custoUnitario),
    0,
  );
}

/**
 * Soma de **todos** os gastos da empresa no custo de `lotes` lotes. **Muda
 * (BE-26):** cada gasto entra pelo tipo (`calcularGastoNoCusto`): o mensal
 * dividido pela capacidade mensal, não mais inteiro em cada lote. **Muda
 * (BE-27):** o mensal é multiplicado pelo `usoPorLote` da receita.
 */
export function calcularCustoInvisivel(
  gastos: GastoParaCusto[],
  rendimento: number,
  capacidadeMensal: number,
  lotes = 1,
  usoPorLote = 1,
): number {
  const uso = {
    lotes,
    totalUnidades: rendimento * lotes,
    capacidadeMensal,
    usoPorLote,
  };
  return gastos.reduce(
    (total, gasto) => total + calcularGastoNoCusto(gasto, uso),
    0,
  );
}

/**
 * Custo de `lotes` lotes da receita (1 se omitido). Origem: `calcularReceita`
 * do `custo.service.ts` (recipe-service): a quantidade do item é multiplicada
 * pelos lotes antes do custo do item. Sem arredondamento intermediário
 * (BE-23): quem arredonda são os DTOs de resposta. Desde a BE-27 nada disso
 * é gravado. **Muda (BE-28):** o custo unitário é o de
 * `calcularCustoUnitario` (com embalagem e perda), igual para qualquer número
 * de lotes, e o custo de produção é `custoUnitario × totalUnidades`. O preço
 * sai de `calcularPreco`, por canal. **Muda (BE-40):** os ingredientes
 * somam também `quantidade × custo de 1 unidade` de cada receita usada.
 * **Muda (BE-46):** o custo unitário soma seu trabalho
 * (`minutosTrabalhoPorLote ÷ 60 × valorHora` por lote).
 */
export function calcularCustoReceita(input: CustoReceitaInput): CustoReceita {
  if (input.rendimento <= 0) {
    throw new InvalidInputError(
      'RENDIMENTO_INVALIDO',
      'Rendimento da receita deve ser maior que zero',
    );
  }
  const lotes = input.lotes ?? 1;
  const usoPorLote = input.usoPorLote ?? 1;
  const itens = input.itens.map((item) => {
    const quantidade = item.quantidade * lotes;
    return {
      insumoId: item.insumoId,
      quantidade,
      custoCalculado: calcularCustoItem(quantidade, item.custoUnitario),
    };
  });
  const receitasUsadas = input.receitas ?? [];
  const receitas = receitasUsadas.map((item) => {
    const quantidade = item.quantidade * lotes;
    return {
      receitaId: item.receitaId,
      quantidade,
      custoUnitario: item.custoUnitario,
      custoCalculado: calcularCustoItem(quantidade, item.custoUnitario),
    };
  });
  const custoIngredientes = [...itens, ...receitas].reduce(
    (total, item) => total + item.custoCalculado,
    0,
  );
  const detalhe = calcularCustoUnitario({
    ingredientesLote: somarItens(input.itens) + somarItens(receitasUsadas),
    gastosMensaisLote: somarGastosMensaisLote(
      input.gastos,
      usoPorLote,
      input.capacidadeMensal,
    ),
    trabalhoLote: trabalhoLoteDe(input),
    rendimento: input.rendimento,
    embalagemPorUnidade: input.embalagemPorUnidade ?? 0,
    gastosPorUnidade: somarGastosPorUnidade(input.gastos),
    perdaPercentual: input.perdaPercentual ?? 0,
  });
  const totalUnidades = input.rendimento * lotes;
  return {
    itens,
    receitas,
    lotes,
    totalUnidades,
    custoIngredientes,
    custoInvisivel: calcularCustoInvisivel(
      input.gastos,
      input.rendimento,
      input.capacidadeMensal,
      lotes,
      usoPorLote,
    ),
    custoProducao: detalhe.custoUnitario * totalUnidades,
    custoUnitario: detalhe.custoUnitario,
    detalhe,
  };
}

/**
 * Margem de contribuição por unidade (BE-31), sem os gastos mensais:
 * `preço − custoSemGastosMensais − percentuaisSemLucro × preço`. É o que cada
 * unidade vendida deixa para pagar os gastos do mês. Sem arredondar.
 */
export function calcularMargemContribuicao(
  preco: number,
  custoSemGastosMensais: number,
  percentuaisSemLucro: number,
): number {
  return preco - custoSemGastosMensais - percentuaisSemLucro * preco;
}

export const MOTIVO_MARGEM_NEGATIVA = 'MARGEM_NEGATIVA';
export const MOTIVO_SEM_VENDAS = 'SEM_VENDAS';
export type MotivoSemPontoEquilibrio =
  typeof MOTIVO_MARGEM_NEGATIVA | typeof MOTIVO_SEM_VENDAS;

export type PontoEquilibrioProduto =
  | { unidades: number; motivo: null }
  | { unidades: null; motivo: typeof MOTIVO_MARGEM_NEGATIVA };

/**
 * Ponto de equilíbrio do produto (BE-31): `gastosMensais ÷ MCu`, em unidades
 * inteiras por mês, "se só vendesse este produto". Com `MCu ≤ 0` nenhuma
 * quantidade paga os gastos: `null` com motivo `MARGEM_NEGATIVA`. O `round6`
 * tira o ruído do ponto flutuante antes do teto e da comparação com 0.
 */
export function calcularPontoEquilibrioProduto(
  gastosMensais: number,
  margemContribuicao: number,
): PontoEquilibrioProduto {
  if (round6(margemContribuicao) <= 0) {
    return { unidades: null, motivo: MOTIVO_MARGEM_NEGATIVA };
  }
  return {
    unidades: Math.ceil(round6(gastosMensais / margemContribuicao)),
    motivo: null,
  };
}

export interface SimulacaoEntrada {
  novoCusto?: number;
  /** Preço praticado. */
  novoPreco?: number;
  /** Unidades vendidas no mês. */
  volume?: number;
}

/** O que a simulação usa da receita, do canal e da empresa (calculado na leitura). */
export interface ReceitaParaSimulacao {
  /** Custo de 1 unidade (com o custo de reposição dos insumos). */
  custo: Pick<
    CustoUnitarioDetalhado,
    'custoUnitario' | 'custoSemGastosMensais'
  >;
  /** Preço sugerido no canal simulado; `null` sem preço possível. */
  precoNoCanal: number | null;
  rendimento: number;
  /** `calcularPercentuaisSemLucro` do canal simulado. */
  percentuaisSemLucro: number;
  /** `somarGastosMensais` da empresa. */
  gastosMensais: number;
}

export interface SimulacaoCenario {
  custoUnitario: number;
  custoSemGastosMensais: number;
  precoVenda: number;
  volume: number;
  percentuaisSemLucro: number;
  /** MCu, em reais por unidade. */
  margemContribuicao: number;
  /** `preço − custoUnitario − percentuaisSemLucro × preço`. */
  lucroPorUnidade: number;
  /** `lucroPorUnidade ÷ preço`, fração do preço (pode ser negativa). */
  lucroReal: number;
  /** `lucroPorUnidade × volume`. */
  lucroMes: number;
  gastosMensais: number;
  pontoEquilibrio: PontoEquilibrioProduto;
  /**
   * Legado: `ceil(custo × volume ÷ preço)`, que não diz quanto vender para
   * pagar o mês. Fica só porque o schema atual do frontend o exige; sai
   * quando o frontend usar o `pontoEquilibrio` (docs/api.md).
   */
  breakEven: number;
}

/**
 * **Muda (BE-31):** simulação com o preço praticado, o canal e o volume do
 * mês. O lucro desconta o imposto, a taxa do canal e os gastos
 * `PERCENTUAL_VENDA`: pelo preço sugerido do canal, o `lucroReal` é o lucro
 * configurado. Origem das mensagens: `simulacao.service.ts` (recipe-service).
 * Preço 0 → 400 `PRECO_INVALIDO` (lacuna 27). `novoCusto` troca o custo
 * unitário; o custo variável perde a mesma parte dos gastos mensais da
 * receita (nunca abaixo de 0). Sem arredondar (BE-23), menos as unidades.
 */
export function simularCenario(
  entrada: SimulacaoEntrada,
  receita: ReceitaParaSimulacao,
): SimulacaoCenario {
  const preco = entrada.novoPreco ?? receita.precoNoCanal;
  if (preco == null) {
    throw new InvalidInputError(
      'RECEITA_SEM_PRECO',
      'Receita sem preço sugerido definido. Informe novoPreco para simular.',
    );
  }
  if (preco <= 0) {
    throw new InvalidInputError(
      'PRECO_INVALIDO',
      'Preço de venda deve ser maior que zero. Informe novoPreco para simular.',
    );
  }
  const parteMensal =
    receita.custo.custoUnitario - receita.custo.custoSemGastosMensais;
  const custoUnitario = entrada.novoCusto ?? receita.custo.custoUnitario;
  const custoSemGastosMensais =
    entrada.novoCusto === undefined
      ? receita.custo.custoSemGastosMensais
      : Math.max(0, entrada.novoCusto - parteMensal);
  const volume = entrada.volume ?? receita.rendimento;
  const margemContribuicao = calcularMargemContribuicao(
    preco,
    custoSemGastosMensais,
    receita.percentuaisSemLucro,
  );
  const lucroPorUnidade =
    preco - custoUnitario - receita.percentuaisSemLucro * preco;
  return {
    custoUnitario,
    custoSemGastosMensais,
    precoVenda: preco,
    volume,
    percentuaisSemLucro: receita.percentuaisSemLucro,
    margemContribuicao,
    lucroPorUnidade,
    lucroReal: lucroPorUnidade / preco,
    lucroMes: lucroPorUnidade * volume,
    gastosMensais: receita.gastosMensais,
    pontoEquilibrio: calcularPontoEquilibrioProduto(
      receita.gastosMensais,
      margemContribuicao,
    ),
    // O round6 tira o ruído do ponto flutuante antes do teto.
    breakEven: Math.ceil(round6((custoUnitario * volume) / preco)),
  };
}

export interface PrecoVenda {
  custoUnitario: number;
  precoSugerido: number;
  lucroPorUnidade: number;
}

/**
 * Preço de venda para uma margem, sem gravar. Origem: `calcularPrecoVenda`
 * do `receita.service.ts` (recipe-service). Sem arredondar (BE-23): o DTO
 * arredonda a resposta (lacuna 20). Mantém o markup do corpo
 * (`margem_lucro`) por contrato; o custo é o calculado na leitura (BE-27).
 */
export function calcularPrecoVenda(
  custoUnitario: number | null,
  margemLucro: number,
): PrecoVenda {
  if (custoUnitario == null) {
    throw new InvalidInputError(
      'RECEITA_SEM_CUSTO',
      'Receita sem custo calculado',
    );
  }
  const precoSugerido = custoUnitario * (1 + margemLucro);
  return {
    custoUnitario,
    precoSugerido,
    lucroPorUnidade: precoSugerido - custoUnitario,
  };
}
