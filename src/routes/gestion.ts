import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { etapasSiguientes } from "../lib/etapas";
import { idParam, sucursalFiltro } from "../lib/util";
import { usuarioActual } from "../middleware/auth";
import { tiene } from "../permisos";

// Se monta detrás de requireUsuario
export const gestionRouter = Router();

// Etapas activas, en orden
gestionRouter.get("/etapas", async (_req, res) => {
  res.json(
    await prisma.etapaGestion.findMany({
      where: { activa: true },
      orderBy: { orden: "asc" },
      select: { id: true, codigo: true, nombre: true, orden: true, esMeta: true },
    }),
  );
});

// Tablero del tramitador: los siniestros por aseguradora que siguen en gestión, agrupados por etapa.
// Cada tarjeta trae a qué etapas puede pasar (según su cobertura y el puesto de quien mira).
gestionRouter.get("/tablero", async (req, res) => {
  const u = usuarioActual(req);
  const { sucursalId } = z
    .object({ sucursalId: z.coerce.number().int().positive().optional() })
    .parse(req.query);

  const [etapas, filas] = await Promise.all([
    prisma.etapaGestion.findMany({
      where: { activa: true },
      orderBy: { orden: "asc" },
      select: { id: true, codigo: true, nombre: true, esMeta: true },
    }),
    prisma.siniestro.findMany({
      where: {
        tipoTrabajo: "ASEGURADORA",
        etapaGestionId: { not: null },
        estado: "INGRESADO",
        sucursalId: sucursalFiltro(u, sucursalId),
      },
      orderBy: { fechaIngreso: "asc" },
      select: {
        id: true,
        numeroSiniestro: true,
        tipoCobertura: true,
        aseguradora: true,
        etapaGestionId: true,
        franquiciaResuelta: true,
        fechaIngreso: true,
        sucursal: { select: { nombre: true } },
        auto: {
          select: {
            patente: true,
            marca: true,
            modelo: true,
            cliente: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        documentos: { where: { obligatorio: true, archivoUrl: null }, select: { id: true } },
      },
    }),
  ]);

  const puedeMover = tiene(u.rol, "gestionarEtapas");
  // Las transiciones se piden una vez por etapa y cobertura, no una por tarjeta
  const cache = new Map<string, Awaited<ReturnType<typeof etapasSiguientes>>>();
  const siguientesDe = async (etapaId: number, cobertura: string | null) => {
    const clave = `${etapaId}|${cobertura}`;
    if (!cache.has(clave)) cache.set(clave, await etapasSiguientes(etapaId, cobertura));
    return cache.get(clave)!;
  };

  const siniestros = [];
  for (const { documentos, ...s } of filas) {
    siniestros.push({
      ...s,
      documentosFaltantes: documentos.length,
      siguientes: puedeMover && s.etapaGestionId !== null
        ? (await siguientesDe(s.etapaGestionId, s.tipoCobertura)).map((e) => ({ id: e.id, nombre: e.nombre }))
        : [],
    });
  }

  res.json({ etapas, siniestros });
});

// Configuración de las etapas (solo ADMIN): cambiar nombre, orden o desactivar. Las etapas no se borran.
gestionRouter.patch("/etapas/:id", async (req, res) => {
  const u = usuarioActual(req);
  if (u.rol !== "ADMIN") throw new HttpError(403, "Solo un administrador puede configurar las etapas");
  const id = idParam(req.params.id);
  const d = z
    .object({
      nombre: z.string().trim().min(2).max(80).optional(),
      orden: z.number().int().min(1).max(999).optional(),
      activa: z.boolean().optional(),
    })
    .parse(req.body);

  const etapa = await prisma.etapaGestion.findUnique({ where: { id } });
  if (!etapa) throw new HttpError(404, "Etapa no encontrada");
  if (d.activa === false) {
    if (etapa.esMeta) throw new HttpError(409, "La etapa final (espera de turno) no se puede desactivar");
    const enUso = await prisma.siniestro.count({ where: { etapaGestionId: id, estado: { not: "ENTREGADO" } } });
    if (enUso > 0) {
      throw new HttpError(409, `Hay ${enUso} siniestro${enUso === 1 ? "" : "s"} en esa etapa: movelos antes de desactivarla`);
    }
  }
  res.json(await prisma.etapaGestion.update({ where: { id }, data: d }));
});
