import { Module } from '@nestjs/common';
import { GastoIndiretoService } from './application/services/gasto-indireto.service.js';
import { GastosIndiretosController } from './infra/controllers/gastos-indiretos.controller.js';
import { GastoIndiretoRepository } from './infra/repositories/gasto-indireto.repository.js';

@Module({
  controllers: [GastosIndiretosController],
  providers: [GastoIndiretoService, GastoIndiretoRepository],
  exports: [GastoIndiretoService],
})
export class GastosIndiretosModule {}
