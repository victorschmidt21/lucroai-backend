-- CreateTable
CREATE TABLE "receita_usada_producao" (
    "id" SERIAL NOT NULL,
    "producao_id" INTEGER NOT NULL,
    "receita_id" INTEGER NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unidade" "UnidadeMedida" NOT NULL,

    CONSTRAINT "receita_usada_producao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receita_usada_producao_producao_id_idx" ON "receita_usada_producao"("producao_id");

-- AddForeignKey
ALTER TABLE "receita_usada_producao" ADD CONSTRAINT "receita_usada_producao_producao_id_fkey" FOREIGN KEY ("producao_id") REFERENCES "producao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

