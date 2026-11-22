import { BusinessRuleError } from '../../../shared/domain/errors/domain.error.js';

export interface CanalVendaValores {
  nome: string;
  comissaoPercentual: number;
  ativo: boolean;
  balcao: boolean;
}

/**
 * Canais de uma empresa nova (BE-25), editáveis depois. A comissão é fração
 * do preço de venda. O Balcão não tem comissão (a taxa da maquininha vem da
 * configuração de custos, BE-24). iFood: 12% do plano básico + 3,2% do
 * pagamento online; com entrega: 23% + 3,2%. Os dois nascem inativos.
 */
export const CANAIS_PADRAO: readonly Readonly<CanalVendaValores>[] =
  Object.freeze([
    Object.freeze({
      nome: 'Balcão',
      comissaoPercentual: 0,
      ativo: true,
      balcao: true,
    }),
    Object.freeze({
      nome: 'iFood',
      comissaoPercentual: 0.152,
      ativo: false,
      balcao: false,
    }),
    Object.freeze({
      nome: 'iFood com entrega',
      comissaoPercentual: 0.262,
      ativo: false,
      balcao: false,
    }),
  ]);

export interface CanalParaTaxa {
  balcao: boolean;
  comissaoPercentual: number;
}

/**
 * Taxa do canal sobre o preço (BE-28): no Balcão, a `taxaMaquininha` da
 * configuração de custos (a comissão dele é ignorada); nos outros canais, a
 * `comissaoPercentual`.
 */
export function taxaDoCanal(
  canal: CanalParaTaxa,
  taxaMaquininha: number,
): number {
  return canal.balcao ? taxaMaquininha : canal.comissaoPercentual;
}

/** O Balcão é o canal padrão da empresa e não pode ser excluído (422). */
export function garantirCanalExcluivel(canal: { balcao: boolean }): void {
  if (canal.balcao) {
    throw new BusinessRuleError(
      'CANAL_BALCAO_NAO_EXCLUIVEL',
      'O canal Balcão não pode ser excluído',
    );
  }
}
