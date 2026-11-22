import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { TipoGasto } from '../../../../generated/prisma/client.js';
import {
  METODOS_RATEIO,
  type MetodoRateio,
} from '../../domain/gastos-indiretos.calculos.js';

/**
 * Corpo de `POST /gastos-indiretos`, como o `CreateGastoIndiretoDto` do
 * catalog-service (`metodo_rateio` em snake_case). A descrição passa a ser
 * obrigatória e aparada (BE-08). **Muda (BE-26):** o `tipo` substitui o
 * `metodo_rateio`, que continua aceito enquanto o frontend o envia; um dos
 * dois é obrigatório, e o `tipo` prevalece.
 */
export class CreateGastoIndiretoDto {
  /** @example 'Aluguel' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  descricao: string;

  /**
   * `MENSAL`: valor do mês. `POR_UNIDADE`: reais por unidade vendida.
   * `PERCENTUAL_VENDA`: fração do preço, de 0 a menos de 1 (0.12 = 12%).
   * @example 1800
   */
  @IsNumber()
  @Min(0)
  valor: number;

  /**
   * Como o gasto entra no custo (BE-26). Obrigatório se `metodo_rateio` não
   * vier.
   * @example 'MENSAL'
   */
  @ValidateIf((dto: CreateGastoIndiretoDto) => dto.metodo_rateio === undefined)
  @IsEnum(TipoGasto)
  tipo?: TipoGasto;

  /**
   * Legado, mantido para o frontend atual: `FIXO` e `PROPORCIONAL` viram
   * `MENSAL`, `POR_UNIDADE` continua `POR_UNIDADE`. Ignorado se `tipo` vier.
   * @deprecated Use `tipo`.
   * @example 'FIXO'
   */
  @IsOptional()
  @IsIn(METODOS_RATEIO)
  metodo_rateio?: MetodoRateio;
}
