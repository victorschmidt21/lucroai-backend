import { Module } from '@nestjs/common';
import { EstoqueModule } from '../estoque/estoque.module.js';
import { CompraInsumoService } from './application/services/compra-insumo.service.js';
import { InsumoService } from './application/services/insumo.service.js';
import { ComprasInsumoController } from './infra/controllers/compras-insumo.controller.js';
import { InsumosController } from './infra/controllers/insumos.controller.js';
import { CompraInsumoRepository } from './infra/repositories/compra-insumo.repository.js';
import { InsumoRepository } from './infra/repositories/insumo.repository.js';

@Module({
  imports: [EstoqueModule],
  controllers: [InsumosController, ComprasInsumoController],
  providers: [
    InsumoService,
    InsumoRepository,
    CompraInsumoService,
    CompraInsumoRepository,
  ],
  exports: [InsumoService],
})
export class InsumosModule {}
