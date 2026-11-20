import { Module } from '@nestjs/common';
import { EstoqueService } from './application/services/estoque.service.js';
import { EstoqueController } from './infra/controllers/estoque.controller.js';
import { EstoqueRepository } from './infra/repositories/estoque.repository.js';

@Module({
  controllers: [EstoqueController],
  providers: [EstoqueService, EstoqueRepository],
  exports: [EstoqueService],
})
export class EstoqueModule {}
