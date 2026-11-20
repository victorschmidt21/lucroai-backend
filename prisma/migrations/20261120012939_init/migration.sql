-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('G', 'KG', 'ML', 'L', 'UN');

-- CreateEnum
CREATE TYPE "MetodoRateio" AS ENUM ('PROPORCIONAL', 'POR_UNIDADE', 'FIXO');

-- CreateEnum
CREATE TYPE "StatusVenda" AS ENUM ('PENDENTE', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "OrigemMovimentacaoEstoque" AS ENUM ('COMPRA', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "OrigemMovimentacaoProdutoAcabado" AS ENUM ('PRODUCAO', 'VENDA');

-- CreateTable
CREATE TABLE "empresa" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "cnpj" VARCHAR(18),
    "segmento" VARCHAR(80),
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nome" VARCHAR(80),
    "email" VARCHAR(80) NOT NULL,
    "senha" VARCHAR(255) NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumo" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "quantidade_base_custo" DOUBLE PRECISION NOT NULL,
    "unidade" "UnidadeMedida" NOT NULL,
    "valor_pago" DOUBLE PRECISION NOT NULL,
    "custo_unitario" DOUBLE PRECISION NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gasto_indireto" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "descricao" VARCHAR(100) NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "metodo_rateio" "MetodoRateio" NOT NULL,

    CONSTRAINT "gasto_indireto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receita" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "rendimento" INTEGER NOT NULL,
    "unidade_rendimento" "UnidadeMedida" NOT NULL,
    "custo_producao" DOUBLE PRECISION,
    "custo_unitario" DOUBLE PRECISION,
    "margem_lucro" DOUBLE PRECISION,
    "preco_sugerido" DOUBLE PRECISION,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_receita" (
    "id" SERIAL NOT NULL,
    "receita_id" INTEGER NOT NULL,
    "insumo_id" INTEGER NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "custo_calculado" DOUBLE PRECISION,

    CONSTRAINT "item_receita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "insumo_id" INTEGER NOT NULL,
    "quantidade_disponivel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantidade_minima" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "data_alteracao" TIMESTAMP(3),

    CONSTRAINT "estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacao_estoque" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "insumo_id" INTEGER NOT NULL,
    "tipo" "TipoMovimentacaoEstoque" NOT NULL,
    "origem" "OrigemMovimentacaoEstoque" NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "referencia_id" INTEGER,
    "observacao" VARCHAR(200),
    "data_movimentacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacao_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque_produto_acabado" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "receita_id" INTEGER NOT NULL,
    "quantidade_disponivel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "data_alteracao" TIMESTAMP(3),

    CONSTRAINT "estoque_produto_acabado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacao_produto_acabado" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "receita_id" INTEGER NOT NULL,
    "tipo" "TipoMovimentacaoEstoque" NOT NULL,
    "origem" "OrigemMovimentacaoProdutoAcabado" NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "referencia_id" INTEGER,
    "data_movimentacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacao_produto_acabado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producao" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "receita_id" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "total_unidades" INTEGER NOT NULL,
    "custo_total" DOUBLE PRECISION,
    "custo_unitario" DOUBLE PRECISION,
    "data_producao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateio_producao" (
    "id" SERIAL NOT NULL,
    "producao_id" INTEGER NOT NULL,
    "gasto_indireto_id" INTEGER,
    "descricao" VARCHAR(100) NOT NULL,
    "valor_rateado" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "rateio_producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venda" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "total" DOUBLE PRECISION,
    "status" "StatusVenda" NOT NULL DEFAULT 'PENDENTE',
    "data_venda" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_venda" (
    "id" SERIAL NOT NULL,
    "venda_id" INTEGER NOT NULL,
    "receita_id" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario_real" DOUBLE PRECISION NOT NULL,
    "custo_unitario" DOUBLE PRECISION,
    "margem_realizada" DOUBLE PRECISION,

    CONSTRAINT "item_venda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_cnpj_key" ON "empresa"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_empresa_id_idx" ON "usuario"("empresa_id");

-- CreateIndex
CREATE INDEX "insumo_empresa_id_idx" ON "insumo"("empresa_id");

-- CreateIndex
CREATE INDEX "gasto_indireto_empresa_id_idx" ON "gasto_indireto"("empresa_id");

-- CreateIndex
CREATE INDEX "receita_empresa_id_idx" ON "receita"("empresa_id");

-- CreateIndex
CREATE INDEX "item_receita_receita_id_idx" ON "item_receita"("receita_id");

-- CreateIndex
CREATE INDEX "item_receita_insumo_id_idx" ON "item_receita"("insumo_id");

-- CreateIndex
CREATE UNIQUE INDEX "estoque_insumo_id_key" ON "estoque"("insumo_id");

-- CreateIndex
CREATE INDEX "estoque_empresa_id_idx" ON "estoque"("empresa_id");

-- CreateIndex
CREATE INDEX "movimentacao_estoque_empresa_id_idx" ON "movimentacao_estoque"("empresa_id");

-- CreateIndex
CREATE INDEX "movimentacao_estoque_insumo_id_data_movimentacao_idx" ON "movimentacao_estoque"("insumo_id", "data_movimentacao");

-- CreateIndex
CREATE UNIQUE INDEX "estoque_produto_acabado_receita_id_key" ON "estoque_produto_acabado"("receita_id");

-- CreateIndex
CREATE INDEX "estoque_produto_acabado_empresa_id_idx" ON "estoque_produto_acabado"("empresa_id");

-- CreateIndex
CREATE INDEX "movimentacao_produto_acabado_empresa_id_idx" ON "movimentacao_produto_acabado"("empresa_id");

-- CreateIndex
CREATE INDEX "movimentacao_produto_acabado_receita_id_data_movimentacao_idx" ON "movimentacao_produto_acabado"("receita_id", "data_movimentacao");

-- CreateIndex
CREATE INDEX "producao_empresa_id_receita_id_idx" ON "producao"("empresa_id", "receita_id");

-- CreateIndex
CREATE INDEX "rateio_producao_producao_id_idx" ON "rateio_producao"("producao_id");

-- CreateIndex
CREATE INDEX "rateio_producao_gasto_indireto_id_idx" ON "rateio_producao"("gasto_indireto_id");

-- CreateIndex
CREATE INDEX "venda_empresa_id_data_venda_idx" ON "venda"("empresa_id", "data_venda");

-- CreateIndex
CREATE INDEX "item_venda_venda_id_idx" ON "item_venda"("venda_id");

-- CreateIndex
CREATE INDEX "item_venda_receita_id_idx" ON "item_venda"("receita_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto_indireto" ADD CONSTRAINT "gasto_indireto_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita" ADD CONSTRAINT "receita_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_receita" ADD CONSTRAINT "item_receita_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_receita" ADD CONSTRAINT "item_receita_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque" ADD CONSTRAINT "estoque_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque" ADD CONSTRAINT "estoque_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_estoque" ADD CONSTRAINT "movimentacao_estoque_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_estoque" ADD CONSTRAINT "movimentacao_estoque_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_produto_acabado" ADD CONSTRAINT "estoque_produto_acabado_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_produto_acabado" ADD CONSTRAINT "estoque_produto_acabado_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_produto_acabado" ADD CONSTRAINT "movimentacao_produto_acabado_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_produto_acabado" ADD CONSTRAINT "movimentacao_produto_acabado_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao" ADD CONSTRAINT "producao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao" ADD CONSTRAINT "producao_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rateio_producao" ADD CONSTRAINT "rateio_producao_producao_id_fkey" FOREIGN KEY ("producao_id") REFERENCES "producao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rateio_producao" ADD CONSTRAINT "rateio_producao_gasto_indireto_id_fkey" FOREIGN KEY ("gasto_indireto_id") REFERENCES "gasto_indireto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venda" ADD CONSTRAINT "venda_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_venda" ADD CONSTRAINT "item_venda_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_venda" ADD CONSTRAINT "item_venda_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
