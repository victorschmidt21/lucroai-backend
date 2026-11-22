import { InvalidInputError } from '../../../shared/domain/errors/domain.error.js';

/**
 * Como o gasto entra no custo (BE-26). Substitui o `MetodoRateio`, que cobrava
 * os gastos mensais inteiros em cada lote de cada receita.
 */
export type TipoGasto = 'MENSAL' | 'POR_UNIDADE' | 'PERCENTUAL_VENDA';

/**
 * Valores do antigo `metodo_rateio`, que o frontend ainda envia e valida
 * (`metodoRateioSchema`). Ficam só por compatibilidade de contrato.
 */
export const METODOS_RATEIO = ['FIXO', 'PROPORCIONAL', 'POR_UNIDADE'] as const;
export type MetodoRateio = (typeof METODOS_RATEIO)[number];

export interface GastoParaCusto {
  valor: number;
  tipo: TipoGasto;
}

export interface UsoDoGasto {
  lotes: number;
  /** `rendimento × lotes`. */
  totalUnidades: number;
  /** Da configuração de custos da empresa (BE-24), sempre > 0. */
  capacidadeMensal: number;
  /**
   * Fornadas (ou minutos de forno) que um lote ocupa: o `usoPorLote` da
   * receita (BE-27). Omitido, 1.
   */
  usoPorLote?: number;
}

/**
 * Parte de um gasto no custo de `lotes` lotes (BE-26), sem arredondar (BE-23):
 * - `MENSAL`: `valor × usoPorLote × lotes ÷ capacidadeMensal`. O gasto do mês
 *   é dividido pela capacidade, então nunca entra inteiro num lote (salvo se
 *   o lote ocupar a capacidade do mês inteira);
 * - `POR_UNIDADE`: `valor × totalUnidades`, porque o valor é por unidade;
 * - `PERCENTUAL_VENDA`: 0. É fração do preço, não custo: entra nos
 *   percentuais do preço (BE-28).
 */
export function calcularGastoNoCusto(
  gasto: GastoParaCusto,
  uso: UsoDoGasto,
): number {
  switch (gasto.tipo) {
    case 'MENSAL':
      return (
        (gasto.valor * (uso.usoPorLote ?? 1) * uso.lotes) / uso.capacidadeMensal
      );
    case 'POR_UNIDADE':
      return gasto.valor * uso.totalUnidades;
    case 'PERCENTUAL_VENDA':
      return 0;
  }
}

/**
 * Confere o valor conforme o tipo, depois de mesclar o `PUT` com o salvo:
 * `PERCENTUAL_VENDA` é fração do preço, de 0 a 1 exclusive (um gasto de
 * 100% do preço não deixa preço possível). `MENSAL` e `POR_UNIDADE` aceitam
 * qualquer valor ≥ 0, que o DTO já garante.
 */
export function validarGasto(gasto: GastoParaCusto): void {
  if (
    gasto.tipo === 'PERCENTUAL_VENDA' &&
    (!Number.isFinite(gasto.valor) || gasto.valor < 0 || gasto.valor >= 1)
  ) {
    throw new InvalidInputError(
      'DADOS_INVALIDOS',
      'Os dados enviados são inválidos',
      [
        {
          field: 'valor',
          messages: [
            'valor de um gasto PERCENTUAL_VENDA deve ser uma fração do preço, maior ou igual a 0 e menor que 1 (ex.: 0.12 para 12%)',
          ],
        },
      ],
    );
  }
}

/**
 * Tipo a partir do `metodo_rateio` antigo: `POR_UNIDADE` já era valor por
 * unidade; `FIXO` e `PROPORCIONAL` eram valores do mês e viram `MENSAL`.
 */
export function tipoDoMetodoRateio(metodo: MetodoRateio): TipoGasto {
  return metodo === 'POR_UNIDADE' ? 'POR_UNIDADE' : 'MENSAL';
}

/**
 * `metodoRateio` da resposta, para o schema do frontend continuar válido.
 * `PERCENTUAL_VENDA` não tem equivalente e sai como `FIXO`, o método que o
 * frontend trata como um valor só (o de menor efeito no cálculo dele).
 */
export function metodoRateioDoTipo(tipo: TipoGasto): MetodoRateio {
  return tipo === 'POR_UNIDADE' ? 'POR_UNIDADE' : 'FIXO';
}

/**
 * Tipo a gravar: `tipo` prevalece sobre o `metodo_rateio` antigo. Na edição,
 * um `metodo_rateio` igual ao que a resposta mostra para o tipo salvo mantém
 * o tipo (o formulário atual reenvia o método que recebeu, e um
 * `PERCENTUAL_VENDA` não pode virar `MENSAL` só por isso). Sem nenhum dos
 * dois, mantém o salvo; no cadastro, sem salvo, é 400.
 */
export function resolverTipoGasto(
  informado: { tipo?: TipoGasto; metodo_rateio?: MetodoRateio },
  salvo?: TipoGasto,
): TipoGasto {
  if (informado.tipo !== undefined) return informado.tipo;
  if (informado.metodo_rateio !== undefined) {
    if (
      salvo !== undefined &&
      metodoRateioDoTipo(salvo) === informado.metodo_rateio
    ) {
      return salvo;
    }
    return tipoDoMetodoRateio(informado.metodo_rateio);
  }
  if (salvo !== undefined) return salvo;
  throw new InvalidInputError(
    'DADOS_INVALIDOS',
    'Os dados enviados são inválidos',
    [{ field: 'tipo', messages: ['tipo é obrigatório'] }],
  );
}
