import { Module } from '@nestjs/common';
import { ConfiguracaoCustosModule } from '../configuracao-custos/configuracao-custos.module.js';
import { EstoqueModule } from '../estoque/estoque.module.js';
import { GastosIndiretosModule } from '../gastos-indiretos/gastos-indiretos.module.js';
import { ReceitasModule } from '../receitas/receitas.module.js';
import { ProducaoService } from './application/services/producao.service.js';
import { ProducoesController } from './infra/controllers/producoes.controller.js';
import { ProducaoRepository } from './infra/repositories/producao.repository.js';

@Module({
  imports: [
    ReceitasModule,
    GastosIndiretosModule,
    EstoqueModule,
    ConfiguracaoCustosModule,
  ],
  controllers: [ProducoesController],
  providers: [ProducaoService, ProducaoRepository],
})
export class ProducoesModule {}
