import { round6 } from '../../../shared/domain/arredondamento.js';
import {
  type DetalheErro,
  InvalidInputError,
} from '../../../shared/domain/errors/domain.error.js';
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
}

/** Padrões de uma receita criada sem os campos da ficha técnica. */
export const FICHA_TECNICA_PADRAO: Readonly<FichaTecnica> = Object.freeze({
  usoPorLote: 1,
  embalagemPorUnidade: 0,
  perdaPercentual: 0,
  lucroPercentual: null,
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
  };
}

/**
 * Confere a ficha técnica já mesclada com a salva: uso de forno > 0,
 * embalagem ≥ 0, perda e lucro de 0 até menos de 1. Perda ou lucro de 100%
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

export interface CustoReceitaInput {
  itens: ItemParaCusto[];
  rendimento: number;
  /** Fornadas ou minutos de 1 lote (BE-27); 1 se omitido. */
  usoPorLote?: number;
  /**
   * Lucro sobre o preço já resolvido (o da receita ou o `lucroPadrao` da
   * empresa); `null` não tem preço sugerido.
   */
  lucroPercentual: number | null;
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
  lotes: number;
  /** `rendimento × lotes`. */
  totalUnidades: number;
  /** Soma dos itens (custo dos ingredientes). */
  custoIngredientes: number;
  custoInvisivel: number;
  custoProducao: number;
  custoUnitario: number;
  /** `null` sem lucro ou com lucro ≥ 1. */
  precoSugerido: number | null;
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
 * **Muda (BE-27):** o lucro é fração do **preço**, `custo ÷ (1 − lucro)`, no
 * lugar do markup `custo × (1 + margem)` do `custo.service.ts`. Sem lucro ou
 * com lucro ≥ 1 não há preço (`null`). O preço por canal, com imposto e
 * taxas, é da BE-28.
 */
export function calcularPrecoSugerido(
  custoUnitario: number,
  lucroPercentual: number | null,
): number | null {
  if (lucroPercentual == null || lucroPercentual >= 1) return null;
  return custoUnitario / (1 - lucroPercentual);
}

/**
 * Custo de `lotes` lotes da receita (1 se omitido). Origem: `calcularReceita`
 * do `custo.service.ts` (recipe-service): a quantidade do item é multiplicada
 * pelos lotes antes do custo do item. Sem arredondamento intermediário
 * (BE-23): quem arredonda são os DTOs de resposta. Desde a BE-27 nada disso
 * é gravado: o custo é calculado na leitura, com os custos atuais.
 */
export function calcularCustoReceita(input: CustoReceitaInput): CustoReceita {
  if (input.rendimento <= 0) {
    throw new InvalidInputError(
      'RENDIMENTO_INVALIDO',
      'Rendimento da receita deve ser maior que zero',
    );
  }
  const lotes = input.lotes ?? 1;
  const itens = input.itens.map((item) => {
    const quantidade = item.quantidade * lotes;
    return {
      insumoId: item.insumoId,
      quantidade,
      custoCalculado: calcularCustoItem(quantidade, item.custoUnitario),
    };
  });
  const custoIngredientes = itens.reduce(
    (total, item) => total + item.custoCalculado,
    0,
  );
  const totalUnidades = input.rendimento * lotes;
  const custoInvisivel = calcularCustoInvisivel(
    input.gastos,
    input.rendimento,
    input.capacidadeMensal,
    lotes,
    input.usoPorLote,
  );
  const custoProducao = custoIngredientes + custoInvisivel;
  const custoUnitario = custoProducao / totalUnidades;
  return {
    itens,
    lotes,
    totalUnidades,
    custoIngredientes,
    custoInvisivel,
    custoProducao,
    custoUnitario,
    precoSugerido: calcularPrecoSugerido(custoUnitario, input.lucroPercentual),
  };
}

export interface SimulacaoEntrada {
  novoCusto?: number;
  novoPreco?: number;
  volume?: number;
}

/** Valores da receita (calculados na leitura) usados quando a simulação não os informa. */
export interface ReceitaParaSimulacao {
  custoUnitario: number | null;
  precoSugerido: number | null;
  rendimento: number;
}

export interface SimulacaoCenario {
  custoUnitario: number;
  precoVenda: number;
  volume: number;
  lucroEstimado: number;
  /** Fração (pode ser negativa). */
  margemProjetada: number;
  /** Unidades para cobrir o custo do volume. */
  breakEven: number;
}

/**
 * Simulação de cenário. Origem: `simular` do `simulacao.service.ts`
 * (recipe-service), com as mesmas mensagens. Preço 0 → 400 `PRECO_INVALIDO`
 * em vez de `NaN` (lacuna 27). Sem arredondar (BE-23), menos o break-even.
 */
export function simularCenario(
  entrada: SimulacaoEntrada,
  receita: ReceitaParaSimulacao,
): SimulacaoCenario {
  const custo = entrada.novoCusto ?? receita.custoUnitario;
  if (custo == null) {
    throw new InvalidInputError(
      'RECEITA_SEM_CUSTO',
      'Receita sem custo calculado. Informe novoCusto para simular.',
    );
  }
  const preco = entrada.novoPreco ?? receita.precoSugerido;
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
  const volume = entrada.volume ?? receita.rendimento;
  const margemPorUnidade = preco - custo;
  return {
    custoUnitario: custo,
    precoVenda: preco,
    volume,
    lucroEstimado: margemPorUnidade * volume,
    margemProjetada: margemPorUnidade / preco,
    // O break-even já é a saída (unidades inteiras). O round6 tira o ruído do
    // ponto flutuante antes do teto: 60.00000000000001 não pode virar 61.
    breakEven: Math.ceil(round6((custo * volume) / preco)),
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
