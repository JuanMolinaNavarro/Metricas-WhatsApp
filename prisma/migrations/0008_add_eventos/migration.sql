-- CreateTable
CREATE TABLE "evento_metrica" (
  "id"          SERIAL       NOT NULL,
  "fecha"       DATE         NOT NULL,
  "titulo"      TEXT         NOT NULL,
  "descripcion" TEXT,
  "color"       TEXT         NOT NULL DEFAULT '#EF553B',
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "evento_metrica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evento_metrica_fecha_idx" ON "evento_metrica"("fecha");
