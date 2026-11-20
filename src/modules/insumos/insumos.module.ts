import { Module } from '@nestjs/common';
import { EstoqueModule } from '../estoque/estoque.module.js';
import { InsumoService } from './application/services/insumo.service.js';
import { InsumosController } from './infra/controllers/insumos.controller.js';
import { InsumoRepository } from './infra/repositories/insumo.repository.js';

@Module({
  imports: [EstoqueModule],
  controllers: [InsumosController],
  providers: [InsumoService, InsumoRepository],
  exports: [InsumoService],
})
export class InsumosModule {}
