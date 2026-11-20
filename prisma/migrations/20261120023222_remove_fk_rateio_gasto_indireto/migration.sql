/*
  Warnings:

  - Made the column `gasto_indireto_id` on table `rateio_producao` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "rateio_producao" DROP CONSTRAINT "rateio_producao_gasto_indireto_id_fkey";

-- AlterTable
ALTER TABLE "rateio_producao" ALTER COLUMN "gasto_indireto_id" SET NOT NULL;
