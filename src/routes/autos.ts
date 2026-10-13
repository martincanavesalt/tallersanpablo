import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { idParam, normalizarPatente, sucursalFiltro } from "../lib/util";
import { usuarioActual } from "../middleware/auth";
import { exigir } from "../permisos";

// Se monta detrás de requireUsuario
export const autosRouter = Router();

const autoSchema = z.object({
  patente: z
    .string()
    .transform(normalizarPatente)
    .pipe(z.string().min(6, "Patente inválida").max(8, "Patente inválida")),
  marca: z.string().trim().min(1).max(60),
  modelo: z.string().trim().min(1).max(60),
  anio: z.number().int().min(1950).max(new Date().getFullYear() + 1).optional(),
  color: z.string().trim().max(40).optional(),
  chasis: z.string().trim().max(30).optional(),
  clienteId: z.number().int().positive(),
});

const conTitular = {
  cliente: { select: { id: true, dni: true, nombre: true, apellido: true, telefono: true } },
} as const;

autosRouter.post("/", async (req, res) => {
  exigir(usuarioActual(req).rol, "gestionarClientes");
  const d = autoSchema.parse(req.body);

  if (!(await prisma.cliente.findUnique({ where: { id: d.clienteId }, select: { id: true } }))) {
    throw new HttpError(400, "El cliente no existe");
  }
  const existente = await prisma.auto.findUnique({ where: { patente: d.patente }, select: { id: true, clienteId: true } });
  if (existente) {
    throw new HttpError(409, "Ya existe un auto con esa patente", {
      autoId: existente.id,
      titularActual: existente.clienteId,
    });
  }

  res.status(201).json(await prisma.auto.create({ data: d, include: conTitular }));
});

autosRouter.get("/patente/:patente", async (req, res) => {
  const u = usuarioActual(req);
  const patente = normalizarPatente(String(req.params.patente));
  const auto = await prisma.auto.findUnique({
    where: { patente },
    include: {
      ...conTitular,
      siniestros: {
        where: { sucursalId: sucursalFiltro(u) },
        select: { id: true, numeroSiniestro: true, estado: true, tipoTrabajo: true, tipoCobertura: true, fechaIngreso: true },
        orderBy: { fechaIngreso: "desc" },
      },
    },
  });
  if (!auto) throw new HttpError(404, "No hay ningún auto con esa patente");
  res.json(auto);
});

// Edición de datos y cambio de titular (clienteId)
autosRouter.patch("/:id", async (req, res) => {
  exigir(usuarioActual(req).rol, "gestionarClientes");
  const id = idParam(req.params.id);
  const d = autoSchema.omit({ patente: true }).partial().parse(req.body);

  if (!(await prisma.auto.findUnique({ where: { id }, select: { id: true } }))) {
    throw new HttpError(404, "Auto no encontrado");
  }
  if (d.clienteId && !(await prisma.cliente.findUnique({ where: { id: d.clienteId }, select: { id: true } }))) {
    throw new HttpError(400, "El cliente no existe");
  }
  res.json(await prisma.auto.update({ where: { id }, data: d, include: conTitular }));
});
