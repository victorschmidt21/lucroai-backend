import { Module } from '@nestjs/common';
import { InsumosModule } from '../insumos/insumos.module.js';
import { ReceitasModule } from '../receitas/receitas.module.js';
import { AlertaService } from './application/services/alerta.service.js';
import { AlertasController } from './infra/controllers/alertas.controller.js';

@Module({
  imports: [InsumosModule, ReceitasModule],
  controllers: [AlertasController],
  providers: [AlertaService],
})
export class AlertasModule {}
