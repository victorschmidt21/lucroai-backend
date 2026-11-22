-- BE-29: custo médio, último custo e preço de mercado no insumo, e a tabela de compras.
-- Sem migração de dados (não há dados reais): as linhas existentes só recebem
-- médio e último iguais ao custo unitário que tinham, para as colunas serem NOT NULL.

-- AlterTable
ALTER TABLE "insumo" ADD COLUMN     "custo_medio" DOUBLE PRECISION,
ADD COLUMN     "preco_mercado" DOUBLE PRECISION,
ADD COLUMN     "preco_mercado_data" TIMESTAMP(3),
ADD COLUMN     "ultimo_custo" DOUBLE PRECISION;

UPDATE "insumo" SET "custo_medio" = "custo_unitario", "ultimo_custo" = "custo_unitario";

ALTER TABLE "insumo" ALTER COLUMN "custo_medio" SET NOT NULL,
ALTER COLUMN "ultimo_custo" SET NOT NULL,
DROP COLUMN "custo_unitario";

-- CreateTable
CREATE TABLE "compra_insumo" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "insumo_id" INTEGER NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "valor_total" DOUBLE PRECISION NOT NULL,
    "custo_unitario" DOUBLE PRECISION NOT NULL,
    "observacao" VARCHAR(200),
    "data_compra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compra_insumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compra_insumo_empresa_id_idx" ON "compra_insumo"("empresa_id");

-- CreateIndex
CREATE INDEX "compra_insumo_insumo_id_data_compra_idx" ON "compra_insumo"("insumo_id", "data_compra");

-- AddForeignKey
ALTER TABLE "compra_insumo" ADD CONSTRAINT "compra_insumo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_insumo" ADD CONSTRAINT "compra_insumo_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
