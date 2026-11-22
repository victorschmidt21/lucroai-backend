-- BE-26: troca o MetodoRateio (FIXO, PROPORCIONAL, POR_UNIDADE) pelo TipoGasto.
-- Não há dados reais, mas os bancos de desenvolvimento e de teste têm gastos:
-- POR_UNIDADE continua POR_UNIDADE (já era valor por unidade) e FIXO e
-- PROPORCIONAL viram MENSAL, para o NOT NULL não falhar.

-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('MENSAL', 'POR_UNIDADE', 'PERCENTUAL_VENDA');

-- AlterTable
ALTER TABLE "gasto_indireto" ADD COLUMN "tipo" "TipoGasto";

UPDATE "gasto_indireto"
SET "tipo" = CASE
  WHEN "metodo_rateio" = 'POR_UNIDADE' THEN 'POR_UNIDADE'::"TipoGasto"
  ELSE 'MENSAL'::"TipoGasto"
END;

ALTER TABLE "gasto_indireto" ALTER COLUMN "tipo" SET NOT NULL;

ALTER TABLE "gasto_indireto" DROP COLUMN "metodo_rateio";

-- DropEnum
DROP TYPE "MetodoRateio";
