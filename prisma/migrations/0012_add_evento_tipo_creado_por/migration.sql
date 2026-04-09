-- Add tipo and creado_por fields to evento_metrica
ALTER TABLE "evento_metrica" ADD COLUMN "tipo" TEXT;
ALTER TABLE "evento_metrica" ADD COLUMN "creado_por" TEXT;
