import { Module } from '@nestjs/common';
import { CanaisModule } from '../canais/canais.module.js';
import { EstoqueModule } from '../estoque/estoque.module.js';
import { ReceitasModule } from '../receitas/receitas.module.js';
import { VendaService } from './application/services/venda.service.js';
import { VendasController } from './infra/controllers/vendas.controller.js';
import { VendaRepository } from './infra/repositories/venda.repository.js';

@Module({
  imports: [ReceitasModule, EstoqueModule, CanaisModule],
  controllers: [VendasController],
  providers: [VendaService, VendaRepository],
})
export class VendasModule {}
