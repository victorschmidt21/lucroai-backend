import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedError } from '../../domain/errors/domain.error.js';
import { IS_PUBLIC } from './public.decorator.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

/**
 * Guard global: exige `Authorization: Bearer <jwt>` (HS256) em toda rota,
 * menos nas marcadas com `@Public()`, e põe o payload em `request.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [context.getHandler(), context.getClass()],
    );
    if (publica) return true;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: UsuarioAutenticado;
    }>();
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match) {
      throw new UnauthorizedError('NAO_AUTENTICADO', 'Autenticação necessária');
    }

    const payload = await this.jwtService
      .verifyAsync<Partial<UsuarioAutenticado>>(match[1])
      .catch(() => null);
    if (
      typeof payload?.sub !== 'number' ||
      typeof payload.email !== 'string' ||
      typeof payload.empresa?.id !== 'number'
    ) {
      throw new UnauthorizedError(
        'TOKEN_INVALIDO',
        'Token inválido ou expirado',
      );
    }

    req.user = {
      sub: payload.sub,
      email: payload.email,
      nome: payload.nome ?? null,
      empresa: {
        id: payload.empresa.id,
        nome: payload.empresa.nome,
        cnpj: payload.empresa.cnpj ?? null,
        segmento: payload.empresa.segmento ?? null,
      },
    };
    return true;
  }
}
