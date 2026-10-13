-- AlterTable
ALTER TABLE "siniestros" ADD COLUMN     "etapa_gestion_id" INTEGER,
ADD COLUMN     "franquicia_resuelta" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "etapas_gestion" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "es_meta" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "etapas_gestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas_transiciones" (
    "id" SERIAL NOT NULL,
    "coberturas" TEXT,
    "requiere_documentos" BOOLEAN NOT NULL DEFAULT false,
    "desde_id" INTEGER NOT NULL,
    "hasta_id" INTEGER NOT NULL,

    CONSTRAINT "etapas_transiciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_gestion" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,
    "siniestro_id" INTEGER NOT NULL,
    "etapa_anterior_id" INTEGER,
    "etapa_nueva_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "movimientos_gestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etapas_gestion_codigo_key" ON "etapas_gestion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_transiciones_desde_id_hasta_id_key" ON "etapas_transiciones"("desde_id", "hasta_id");

-- CreateIndex
CREATE INDEX "movimientos_gestion_siniestro_id_idx" ON "movimientos_gestion"("siniestro_id");

-- CreateIndex
CREATE INDEX "siniestros_etapa_gestion_id_idx" ON "siniestros"("etapa_gestion_id");

-- AddForeignKey
ALTER TABLE "siniestros" ADD CONSTRAINT "siniestros_etapa_gestion_id_fkey" FOREIGN KEY ("etapa_gestion_id") REFERENCES "etapas_gestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_transiciones" ADD CONSTRAINT "etapas_transiciones_desde_id_fkey" FOREIGN KEY ("desde_id") REFERENCES "etapas_gestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_transiciones" ADD CONSTRAINT "etapas_transiciones_hasta_id_fkey" FOREIGN KEY ("hasta_id") REFERENCES "etapas_gestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_gestion" ADD CONSTRAINT "movimientos_gestion_siniestro_id_fkey" FOREIGN KEY ("siniestro_id") REFERENCES "siniestros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_gestion" ADD CONSTRAINT "movimientos_gestion_etapa_anterior_id_fkey" FOREIGN KEY ("etapa_anterior_id") REFERENCES "etapas_gestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_gestion" ADD CONSTRAINT "movimientos_gestion_etapa_nueva_id_fkey" FOREIGN KEY ("etapa_nueva_id") REFERENCES "etapas_gestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_gestion" ADD CONSTRAINT "movimientos_gestion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
