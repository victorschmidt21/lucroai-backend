import { Module } from '@nestjs/common';
import { EstoqueService } from './application/services/estoque.service.js';
import { EstoqueRepository } from './infra/repositories/estoque.repository.js';

// Só a base (BE-07): rotas de /estoque chegam na BE-11.
@Module({
  providers: [EstoqueService, EstoqueRepository],
  exports: [EstoqueService],
})
export class EstoqueModule {}
