-- AlterTable
ALTER TABLE "item_receita" DROP COLUMN "custo_calculado";

-- AlterTable
ALTER TABLE "receita" DROP COLUMN "custo_producao",
DROP COLUMN "custo_unitario",
DROP COLUMN "margem_lucro",
DROP COLUMN "preco_sugerido",
ADD COLUMN     "embalagem_por_unidade" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lucro_percentual" DOUBLE PRECISION,
ADD COLUMN     "perda_percentual" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "uso_por_lote" DOUBLE PRECISION NOT NULL DEFAULT 1;

