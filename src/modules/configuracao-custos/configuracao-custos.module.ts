import { Module } from '@nestjs/common';
import { ConfiguracaoCustosService } from './application/services/configuracao-custos.service.js';
import { ConfiguracaoCustosController } from './infra/controllers/configuracao-custos.controller.js';
import { ConfiguracaoCustosRepository } from './infra/repositories/configuracao-custos.repository.js';

@Module({
  controllers: [ConfiguracaoCustosController],
  providers: [ConfiguracaoCustosService, ConfiguracaoCustosRepository],
  exports: [ConfiguracaoCustosService],
})
export class ConfiguracaoCustosModule {}
