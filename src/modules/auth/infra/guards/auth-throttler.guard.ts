import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { normalizarEmail } from '../../domain/auth.calculos.js';

/**
 * Limite de tentativas do `AuthController`, contado por IP **e** e-mail.
 *
 * Só o servidor do frontend (BFF) chama esta API, então todas as pessoas
 * chegam com o mesmo IP: contar só por IP bloquearia o login de todo mundo
 * depois de algumas tentativas de uma pessoa só.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req['body'] as { email?: unknown } | undefined;
    const email =
      typeof body?.email === 'string' ? normalizarEmail(body.email) : '';
    const ip = typeof req['ip'] === 'string' ? req['ip'] : '';
    return Promise.resolve(`${ip}|${email}`);
  }
}
