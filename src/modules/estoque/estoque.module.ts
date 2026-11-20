import { Module } from '@nestjs/common';
import { EstoqueProdutoAcabadoService } from './application/services/estoque-produto-acabado.service.js';
import { EstoqueService } from './application/services/estoque.service.js';
import { EstoqueController } from './infra/controllers/estoque.controller.js';
import { EstoqueProdutoAcabadoRepository } from './infra/repositories/estoque-produto-acabado.repository.js';
import { EstoqueRepository } from './infra/repositories/estoque.repository.js';

@Module({
  controllers: [EstoqueController],
  providers: [
    EstoqueService,
    EstoqueRepository,
    EstoqueProdutoAcabadoService,
    EstoqueProdutoAcabadoRepository,
  ],
  exports: [EstoqueService, EstoqueProdutoAcabadoService],
})
export class EstoqueModule {}
