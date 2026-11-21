-- CreateEnum
CREATE TYPE "BaseRateio" AS ENUM ('FORNADAS', 'MINUTOS');

-- CreateTable
CREATE TABLE "configuracao_custos" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "base_rateio" "BaseRateio" NOT NULL DEFAULT 'FORNADAS',
    "capacidade_mensal" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "lucro_padrao" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "imposto_percentual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxa_maquininha" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "configuracao_custos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_custos_empresa_id_key" ON "configuracao_custos"("empresa_id");

-- AddForeignKey
ALTER TABLE "configuracao_custos" ADD CONSTRAINT "configuracao_custos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Empresas já existentes recebem a configuração padrão (os defaults acima).
INSERT INTO "configuracao_custos" ("empresa_id") SELECT "id" FROM "empresa";
