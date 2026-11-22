-- AlterTable
ALTER TABLE "item_venda" ADD COLUMN     "lucro_real" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "venda" ADD COLUMN     "canal_id" INTEGER;

-- CreateIndex
CREATE INDEX "venda_canal_id_idx" ON "venda"("canal_id");

-- AddForeignKey
ALTER TABLE "venda" ADD CONSTRAINT "venda_canal_id_fkey" FOREIGN KEY ("canal_id") REFERENCES "canal_venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
