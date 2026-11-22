import { Module } from '@nestjs/common';
import { CanaisModule } from '../canais/canais.module.js';
import { ConfiguracaoCustosModule } from '../configuracao-custos/configuracao-custos.module.js';
import { GastosIndiretosModule } from '../gastos-indiretos/gastos-indiretos.module.js';
import { InsumosModule } from '../insumos/insumos.module.js';
import { ReceitaService } from './application/services/receita.service.js';
import { ReceitasController } from './infra/controllers/receitas.controller.js';
import { ReceitaRepository } from './infra/repositories/receita.repository.js';

@Module({
  imports: [
    InsumosModule,
    GastosIndiretosModule,
    ConfiguracaoCustosModule,
    CanaisModule,
  ],
  controllers: [ReceitasController],
  providers: [ReceitaService, ReceitaRepository],
  exports: [ReceitaService],
})
export class ReceitasModule {}
