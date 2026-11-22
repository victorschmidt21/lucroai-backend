import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation.js';
import { AlertasModule } from './modules/alertas/alertas.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CanaisModule } from './modules/canais/canais.module.js';
import { ConfiguracaoCustosModule } from './modules/configuracao-custos/configuracao-custos.module.js';
import { EstoqueModule } from './modules/estoque/estoque.module.js';
import { GastosIndiretosModule } from './modules/gastos-indiretos/gastos-indiretos.module.js';
import { InsumosModule } from './modules/insumos/insumos.module.js';
import { ProducoesModule } from './modules/producoes/producoes.module.js';
import { ReceitasModule } from './modules/receitas/receitas.module.js';
import { VendasModule } from './modules/vendas/vendas.module.js';
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
    ConfiguracaoCustosModule,
    CanaisModule,
    AuthModule,
    EstoqueModule,
    InsumosModule,
    GastosIndiretosModule,
    ReceitasModule,
    ProducoesModule,
    VendasModule,
    AlertasModule,
  ],
})
export class AppModule {}
