import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../../../config/env.validation.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

/**
 * Registra o JwtService (HS256, 4 h, segredo JWT_SECRET) para toda a
 * aplicação e o JwtAuthGuard como guard global. O módulo `auth` (BE-06) só
 * injeta o JwtService para assinar o token.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256', expiresIn: '4h' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [JwtModule],
})
export class JwtAuthModule {}
