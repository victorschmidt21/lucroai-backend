-- AlterTable
ALTER TABLE "receita" ADD COLUMN     "vendavel" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "item_receita_receita" (
    "id" SERIAL NOT NULL,
    "receita_id" INTEGER NOT NULL,
    "receita_usada_id" INTEGER NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "item_receita_receita_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_receita_receita_receita_id_idx" ON "item_receita_receita"("receita_id");

-- CreateIndex
CREATE INDEX "item_receita_receita_receita_usada_id_idx" ON "item_receita_receita"("receita_usada_id");

-- AddForeignKey
ALTER TABLE "item_receita_receita" ADD CONSTRAINT "item_receita_receita_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_receita_receita" ADD CONSTRAINT "item_receita_receita_receita_usada_id_fkey" FOREIGN KEY ("receita_usada_id") REFERENCES "receita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
