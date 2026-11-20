import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { transformarEmail } from './create-empresa.dto.js';

/** Corpo de `POST /auth/login`, como o `LoginDto` do auth-service. */
export class LoginDto {
  /** Aparado e em minúsculas antes de validar. @example 'ana@padaria.com' */
  @Transform(transformarEmail)
  @IsEmail()
  email: string;

  /** @example 'senha123' */
  @IsString()
  @IsNotEmpty()
  senha: string;
}
