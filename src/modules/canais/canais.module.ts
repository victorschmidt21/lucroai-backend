import { Module } from '@nestjs/common';
import { CanalVendaService } from './application/services/canal-venda.service.js';
import { CanaisController } from './infra/controllers/canais.controller.js';
import { CanalVendaRepository } from './infra/repositories/canal-venda.repository.js';

@Module({
  controllers: [CanaisController],
  providers: [CanalVendaService, CanalVendaRepository],
  exports: [CanalVendaService],
})
export class CanaisModule {}
