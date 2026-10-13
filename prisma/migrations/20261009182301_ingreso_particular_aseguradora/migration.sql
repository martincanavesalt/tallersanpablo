-- CreateEnum
CREATE TYPE "TipoTrabajo" AS ENUM ('PARTICULAR', 'ASEGURADORA');

-- AlterTable
ALTER TABLE "autos" ADD COLUMN     "chasis" TEXT;

-- AlterTable
ALTER TABLE "siniestros" ADD COLUMN     "aseguradora" TEXT,
ADD COLUMN     "aseguradora_tercero" TEXT,
ADD COLUMN     "combustible" TEXT,
ADD COLUMN     "estado_previo" TEXT,
ADD COLUMN     "fecha_hecho" TIMESTAMP(3),
ADD COLUMN     "inventario" TEXT,
ADD COLUMN     "kilometraje" INTEGER,
ADD COLUMN     "numero_poliza" TEXT,
ADD COLUMN     "reclamo_tercero" TEXT,
ADD COLUMN     "relato" TEXT,
ADD COLUMN     "tipo_trabajo" "TipoTrabajo" NOT NULL DEFAULT 'ASEGURADORA',
ALTER COLUMN "tipo_cobertura" DROP NOT NULL;
