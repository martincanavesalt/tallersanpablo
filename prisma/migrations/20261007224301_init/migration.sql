-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'EMPLEADO');

-- CreateEnum
CREATE TYPE "NombreSucursal" AS ENUM ('NORTE', 'OESTE', 'SUR');

-- CreateEnum
CREATE TYPE "TipoCobertura" AS ENUM ('TERCERO', 'TODO_RIESGO', 'TODO_RIESGO_FRANQUICIA');

-- CreateEnum
CREATE TYPE "EstadoSiniestro" AS ENUM ('INGRESADO', 'ESPERANDO_PAPELES_SEGURO', 'EN_REPARACION', 'ESPERANDO_REPUESTOS', 'CONTROL_CALIDAD', 'LISTO_PARA_ENTREGA', 'ENTREGADO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CARNET_CONDUCIR_FRENTE', 'CARNET_CONDUCIR_DORSO', 'POLIZA_SEGURO', 'CARTA_FRANQUICIA', 'TARJETA_AZUL_FRENTE', 'TARJETA_AZUL_DORSO', 'DNI_FRENTE', 'DNI_DORSO', 'OTRO');

-- CreateEnum
CREATE TYPE "FormatoArchivo" AS ENUM ('JPG', 'PDF');

-- CreateEnum
CREATE TYPE "TipoMovimientoCC" AS ENUM ('DEBITO', 'CREDITO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CHEQUE');

-- CreateTable
CREATE TABLE "sucursales" (
    "id" SERIAL NOT NULL,
    "nombre" "NombreSucursal" NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sucursal_id" INTEGER NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "password_hash" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autos" (
    "id" SERIAL NOT NULL,
    "patente" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anio" INTEGER,
    "color" TEXT,
    "cliente_id" INTEGER NOT NULL,

    CONSTRAINT "autos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siniestros" (
    "id" SERIAL NOT NULL,
    "numero_siniestro" TEXT NOT NULL,
    "tipo_cobertura" "TipoCobertura" NOT NULL,
    "monto_franquicia" DECIMAL(12,2),
    "estado" "EstadoSiniestro" NOT NULL DEFAULT 'INGRESADO',
    "descripcion" TEXT,
    "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_estimada_entrega" TIMESTAMP(3),
    "fecha_entrega" TIMESTAMP(3),
    "auto_id" INTEGER NOT NULL,
    "sucursal_id" INTEGER NOT NULL,
    "usuario_carga_id" INTEGER NOT NULL,

    CONSTRAINT "siniestros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" SERIAL NOT NULL,
    "tipo_documento" "TipoDocumento" NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "formato" "FormatoArchivo",
    "archivo_url" TEXT,
    "fecha_carga" TIMESTAMP(3),
    "siniestro_id" INTEGER NOT NULL,
    "usuario_id" INTEGER,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_estados" (
    "id" SERIAL NOT NULL,
    "estado_anterior" "EstadoSiniestro",
    "estado_nuevo" "EstadoSiniestro" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,
    "siniestro_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "historial_estados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuenta_corriente" (
    "id" SERIAL NOT NULL,
    "tipo_movimiento" "TipoMovimientoCC" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cliente_id" INTEGER NOT NULL,
    "siniestro_id" INTEGER,

    CONSTRAINT "cuenta_corriente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobros" (
    "id" SERIAL NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprobante_url" TEXT,
    "cliente_id" INTEGER NOT NULL,
    "siniestro_id" INTEGER,

    CONSTRAINT "cobros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_nombre_key" ON "sucursales"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_sucursal_id_idx" ON "usuarios"("sucursal_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_dni_key" ON "clientes"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE INDEX "clientes_dni_idx" ON "clientes"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "autos_patente_key" ON "autos"("patente");

-- CreateIndex
CREATE INDEX "autos_patente_idx" ON "autos"("patente");

-- CreateIndex
CREATE INDEX "autos_cliente_id_idx" ON "autos"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "siniestros_numero_siniestro_key" ON "siniestros"("numero_siniestro");

-- CreateIndex
CREATE INDEX "siniestros_sucursal_id_idx" ON "siniestros"("sucursal_id");

-- CreateIndex
CREATE INDEX "siniestros_estado_idx" ON "siniestros"("estado");

-- CreateIndex
CREATE INDEX "siniestros_auto_id_idx" ON "siniestros"("auto_id");

-- CreateIndex
CREATE INDEX "documentos_siniestro_id_idx" ON "documentos"("siniestro_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_siniestro_id_tipo_documento_key" ON "documentos"("siniestro_id", "tipo_documento");

-- CreateIndex
CREATE INDEX "historial_estados_siniestro_id_idx" ON "historial_estados"("siniestro_id");

-- CreateIndex
CREATE INDEX "cuenta_corriente_cliente_id_idx" ON "cuenta_corriente"("cliente_id");

-- CreateIndex
CREATE INDEX "cobros_cliente_id_idx" ON "cobros"("cliente_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autos" ADD CONSTRAINT "autos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siniestros" ADD CONSTRAINT "siniestros_auto_id_fkey" FOREIGN KEY ("auto_id") REFERENCES "autos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siniestros" ADD CONSTRAINT "siniestros_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siniestros" ADD CONSTRAINT "siniestros_usuario_carga_id_fkey" FOREIGN KEY ("usuario_carga_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_siniestro_id_fkey" FOREIGN KEY ("siniestro_id") REFERENCES "siniestros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_siniestro_id_fkey" FOREIGN KEY ("siniestro_id") REFERENCES "siniestros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_siniestro_id_fkey" FOREIGN KEY ("siniestro_id") REFERENCES "siniestros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_siniestro_id_fkey" FOREIGN KEY ("siniestro_id") REFERENCES "siniestros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
