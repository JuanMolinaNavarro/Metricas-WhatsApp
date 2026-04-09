-- Add zona, desdeHora, hastaHora fields to evento_metrica
ALTER TABLE "evento_metrica" ADD COLUMN "zona" TEXT;
ALTER TABLE "evento_metrica" ADD COLUMN "desdeHora" TEXT;
ALTER TABLE "evento_metrica" ADD COLUMN "hastaHora" TEXT;
