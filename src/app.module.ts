import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthModule } from './shared/infra/auth/jwt-auth.module.js';
import { PrismaModule } from './shared/infra/database/prisma.module.js';
import { HealthModule } from './shared/infra/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate }),
    PrismaModule,
    JwtAuthModule,
    HealthModule,
    // Módulos de domínio (src/modules/<modulo>/<modulo>.module.ts).
    AuthModule,
  ],
})
export class AppModule {}
