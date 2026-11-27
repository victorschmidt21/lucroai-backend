-- AlterTable
ALTER TABLE "configuracao_custos" ADD COLUMN     "valor_hora" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "receita" ADD COLUMN     "minutos_trabalho_por_lote" DOUBLE PRECISION NOT NULL DEFAULT 0;

