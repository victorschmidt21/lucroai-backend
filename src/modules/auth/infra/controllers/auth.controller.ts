import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/infra/auth/public.decorator.js';
import { CreateEmpresaDto } from '../../application/dto/create-empresa.dto.js';
import { LoginDto } from '../../application/dto/login.dto.js';
import type {
  EmpresaCriadaDto,
  LoginResponseDto,
} from '../../application/dto/token.dto.js';
import { AuthService } from '../../application/services/auth.service.js';
import { AuthThrottlerGuard } from '../guards/auth-throttler.guard.js';

@ApiTags('auth')
@Public()
@UseGuards(AuthThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  /** Cadastra a empresa e o primeiro usuário e devolve o token */
  @Post('empresa')
  criarEmpresa(@Body() dto: CreateEmpresaDto): Promise<EmpresaCriadaDto> {
    return this.service.criarEmpresa(dto);
  }

  /** Autentica o usuário e devolve o JWT (4 h) */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.service.login(dto);
  }
}
