-- DropIndex
DROP INDEX "documentos_siniestro_id_idx";

-- DropIndex
DROP INDEX "documentos_siniestro_id_tipo_documento_key";

-- CreateIndex
CREATE INDEX "documentos_siniestro_id_tipo_documento_idx" ON "documentos"("siniestro_id", "tipo_documento");
