import { Router } from "express";
import { ETIQUETA_ESTADO, type Estado } from "../constants";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { idParam } from "../lib/util";
import { clienteActual } from "../middleware/auth";

// Se monta detrás de requireCliente. El cliente solo ve SUS siniestros y nunca
// ve montos, comentarios internos ni los archivos subidos.
export const portalRouter = Router();

const etiqueta = (e: Estado) => ETIQUETA_ESTADO[e];

portalRouter.get("/siniestros", async (req, res) => {
  const c = clienteActual(req);
  const filas = await prisma.siniestro.findMany({
    where: { auto: { clienteId: c.id } },
    orderBy: { fechaIngreso: "desc" },
    select: {
      id: true,
      numeroSiniestro: true,
      estado: true,
      fechaIngreso: true,
      fechaEstimada: true,
      fechaEntrega: true,
      sucursal: { select: { nombre: true } },
      auto: { select: { patente: true, marca: true, modelo: true } },
    },
  });
  res.json(filas.map((s) => ({ ...s, estadoTexto: etiqueta(s.estado) })));
});

portalRouter.get("/siniestros/:id", async (req, res) => {
  const c = clienteActual(req);
  const s = await prisma.siniestro.findFirst({
    where: { id: idParam(req.params.id), auto: { clienteId: c.id } },
    select: {
      id: true,
      numeroSiniestro: true,
      estado: true,
      tipoTrabajo: true,
      tipoCobertura: true,
      etapaGestion: { select: { nombre: true } },
      fechaIngreso: true,
      fechaEstimada: true,
      fechaEntrega: true,
      sucursal: { select: { nombre: true } },
      auto: { select: { patente: true, marca: true, modelo: true } },
      historialEstados: { orderBy: { fecha: "asc" }, select: { estadoNuevo: true, fecha: true } },
      documentos: { where: { obligatorio: true, archivoUrl: null }, select: { tipoDocumento: true } },
    },
  });
  if (!s) throw new HttpError(404, "Siniestro no encontrado");

  const { historialEstados, documentos, ...resto } = s;
  res.json({
    ...resto,
    estadoTexto: etiqueta(s.estado),
    linea_de_tiempo: historialEstados.map((h) => ({
      estado: h.estadoNuevo,
      estadoTexto: etiqueta(h.estadoNuevo),
      fecha: h.fecha,
    })),
    documentosPendientes: documentos.map((d) => d.tipoDocumento),
  });
});
