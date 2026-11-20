import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizarEmail } from '../../domain/auth.calculos.js';

// Apara o texto; vazio vira `undefined`, para o campo opcional ficar sem valor.
const aparar = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const texto = value.trim();
  return texto === '' ? undefined : texto;
};

export const transformarEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizarEmail(value) : value;

/**
 * Corpo de `POST /auth/empresa`, como o `CreateEmpresaDto` do auth-service.
 * `cnpj` e `nome_usuario` passam a ser opcionais (BE-06, aditivo).
 */
export class CreateEmpresaDto {
  /** @example 'Padaria da Ana' */
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome_empresa: string;

  /** @example '12.345.678/0001-90' */
  @Transform(aparar)
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  /** @example 'Padaria' */
  @Transform(aparar)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  segmento?: string;

  /** @example 'Ana Souza' */
  @Transform(aparar)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nome_usuario?: string;

  /** Aparado e em minúsculas antes de validar. @example 'ana@padaria.com' */
  @Transform(transformarEmail)
  @IsEmail()
  @MaxLength(80)
  email: string;

  /** Mínimo de 6 caracteres. @example 'senha123' */
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  senha: string;
}
