-- CreateTable
CREATE TABLE "canal_venda" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "comissao_percentual" DOUBLE PRECISION NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "balcao" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "canal_venda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canal_venda_empresa_id_idx" ON "canal_venda"("empresa_id");

-- AddForeignKey
ALTER TABLE "canal_venda" ADD CONSTRAINT "canal_venda_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Empresas já existentes recebem os canais padrão (BE-25): só o Balcão ativo.
INSERT INTO "canal_venda" ("empresa_id", "nome", "comissao_percentual", "ativo", "balcao")
SELECT "id", 'Balcão', 0, true, true FROM "empresa";
INSERT INTO "canal_venda" ("empresa_id", "nome", "comissao_percentual", "ativo", "balcao")
SELECT "id", 'iFood', 0.152, false, false FROM "empresa";
INSERT INTO "canal_venda" ("empresa_id", "nome", "comissao_percentual", "ativo", "balcao")
SELECT "id", 'iFood com entrega', 0.262, false, false FROM "empresa";
