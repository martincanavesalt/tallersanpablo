import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { TIPOS_DOCUMENTO } from "../constants";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { idParam, sucursalFiltro } from "../lib/util";
import { borrarArchivo, detectarFormato, subirArchivo, urlFirmada } from "../lib/storage";
import { requireUsuario, usuarioActual } from "../middleware/auth";
import { exigir } from "../permisos";
import { cargarSiniestro } from "./siniestros";

// Rutas completas (se monta en la raíz); cada una exige personal del taller
export const documentosRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// Subir un documento. Para un tipo del checklist reemplaza el archivo anterior;
// el tipo OTRO siempre agrega uno nuevo (fotos extra, presupuestos, etc).
// Se envía como multipart/form-data con los campos: tipoDocumento, archivo
documentosRouter.post(
  "/siniestros/:id/documentos",
  requireUsuario,
  upload.single("archivo"),
  async (req, res) => {
    const u = usuarioActual(req);
    const siniestroId = idParam(req.params.id);
    const { tipoDocumento } = z.object({ tipoDocumento: z.enum(TIPOS_DOCUMENTO) }).parse(req.body);
    // El tallerista puede subir fotos ("OTRO"), pero no tocar los documentos obligatorios
    if (tipoDocumento !== "OTRO") exigir(u.rol, "subirDocumentosObligatorios");

    if (!req.file) throw new HttpError(400, "Falta el archivo (campo 'archivo')");
    const formato = detectarFormato(req.file.buffer);
    if (!formato) throw new HttpError(415, "Solo se aceptan archivos JPG o PDF");

    const s = await cargarSiniestro(u, siniestroId);
    if (tipoDocumento === "CARTA_FRANQUICIA" && s.tipoCobertura !== "TODO_RIESGO_FRANQUICIA") {
      throw new HttpError(400, "La carta de franquicia solo aplica a TODO_RIESGO_FRANQUICIA");
    }

    const clave = await subirArchivo(req.file.buffer, `siniestros/${siniestroId}`);

    const existente =
      tipoDocumento === "OTRO" ? undefined : s.documentos.find((d) => d.tipoDocumento === tipoDocumento);
    const datosArchivo = { archivoUrl: clave, formato, fechaCarga: new Date(), usuarioId: u.id };

    try {
      const doc = existente
        ? await prisma.documento.update({ where: { id: existente.id }, data: datosArchivo })
        : await prisma.documento.create({
            data: { siniestroId, tipoDocumento, obligatorio: tipoDocumento !== "OTRO", ...datosArchivo },
          });
      if (existente?.archivoUrl) await borrarArchivo(existente.archivoUrl);
      res.status(201).json({
        id: doc.id,
        tipoDocumento: doc.tipoDocumento,
        obligatorio: doc.obligatorio,
        cargado: true,
        formato: doc.formato,
        fechaCarga: doc.fechaCarga,
      });
    } catch (e) {
      await borrarArchivo(clave); // no dejar un archivo huérfano si falló la base
      throw e;
    }
  },
);

async function documentoAutorizado(req: Parameters<typeof usuarioActual>[0], id: number) {
  const u = usuarioActual(req);
  const doc = await prisma.documento.findFirst({
    where: { id, siniestro: { sucursalId: sucursalFiltro(u) } },
  });
  if (!doc) throw new HttpError(404, "Documento no encontrado");
  return doc;
}

// URL firmada para ver o descargar el archivo
documentosRouter.get("/documentos/:id/url", requireUsuario, async (req, res) => {
  const doc = await documentoAutorizado(req, idParam(req.params.id));
  if (!doc.archivoUrl || !doc.formato) throw new HttpError(404, "Ese documento todavía no tiene archivo");
  res.json({ url: urlFirmada(doc.archivoUrl, doc.formato) });
});

// Quitar el archivo: si es OTRO se elimina la fila; si es del checklist vuelve a "pendiente"
documentosRouter.delete("/documentos/:id", requireUsuario, async (req, res) => {
  const doc = await documentoAutorizado(req, idParam(req.params.id));
  if (doc.tipoDocumento !== "OTRO") exigir(usuarioActual(req).rol, "quitarDocumentosObligatorios");

  if (doc.tipoDocumento === "OTRO") {
    await prisma.documento.delete({ where: { id: doc.id } });
  } else {
    await prisma.documento.update({
      where: { id: doc.id },
      data: { archivoUrl: null, formato: null, fechaCarga: null, usuarioId: null },
    });
  }
  if (doc.archivoUrl) await borrarArchivo(doc.archivoUrl);
  res.status(204).end();
});
