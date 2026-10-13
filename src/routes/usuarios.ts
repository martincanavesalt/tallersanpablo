import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { idParam } from "../lib/util";
import { ROLES_PERSONAL } from "../permisos";

// ABM del personal. Se monta detrás de requireAdmin.
// Maneja solo al personal que NO es administrador: no se pueden crear, ver ni
// editar administradores desde acá (se evita escalar privilegios por esta vía).
// Una "baja" desactiva la cuenta y no la borra, porque los siniestros y el
// historial de estados guardan quién hizo cada cosa.
export const usuariosRouter = Router();

const seleccion = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  sucursalId: true,
  sucursal: { select: { nombre: true } },
} as const;

const claveSchema = z.string().min(8, "La clave debe tener al menos 8 caracteres").max(100);
const rolSchema = z.enum(ROLES_PERSONAL);

async function exigirSucursal(id: number) {
  if (!(await prisma.sucursal.findUnique({ where: { id }, select: { id: true } }))) {
    throw new HttpError(400, "La sucursal no existe");
  }
}

async function emailEnUso(email: string, exceptoId?: number) {
  const otro = await prisma.usuario.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      ...(exceptoId !== undefined ? { id: { not: exceptoId } } : {}),
    },
    select: { id: true },
  });
  return otro !== null;
}

async function empleadoOFalla(id: number) {
  const u = await prisma.usuario.findFirst({ where: { id, rol: { not: "ADMIN" } }, select: { id: true } });
  if (!u) throw new HttpError(404, "Empleado no encontrado");
}

usuariosRouter.get("/", async (_req, res) => {
  res.json(
    await prisma.usuario.findMany({
      where: { rol: { not: "ADMIN" } },
      select: seleccion,
      orderBy: [{ activo: "desc" }, { sucursalId: "asc" }, { nombre: "asc" }],
    }),
  );
});

// Alta
usuariosRouter.post("/", async (req, res) => {
  const d = z
    .object({
      nombre: z.string().trim().min(2).max(100),
      email: z.email(),
      password: claveSchema,
      rol: rolSchema,
      sucursalId: z.number().int().positive(),
    })
    .parse(req.body);

  await exigirSucursal(d.sucursalId);
  if (await emailEnUso(d.email)) throw new HttpError(409, "Ya existe un usuario con ese email");

  const creado = await prisma.usuario.create({
    data: {
      nombre: d.nombre,
      email: d.email,
      passwordHash: await bcrypt.hash(d.password, 10),
      rol: d.rol,
      sucursalId: d.sucursalId,
    },
    select: seleccion,
  });
  res.status(201).json(creado);
});

// Modificación: datos, puesto, sucursal, clave y baja/reactivación (activo)
usuariosRouter.patch("/:id", async (req, res) => {
  const id = idParam(req.params.id);
  const d = z
    .object({
      nombre: z.string().trim().min(2).max(100).optional(),
      email: z.email().optional(),
      rol: rolSchema.optional(),
      sucursalId: z.number().int().positive().optional(),
      activo: z.boolean().optional(),
      password: claveSchema.optional(),
    })
    .parse(req.body);

  await empleadoOFalla(id);
  if (d.sucursalId !== undefined) await exigirSucursal(d.sucursalId);
  if (d.email !== undefined && (await emailEnUso(d.email, id))) {
    throw new HttpError(409, "Ya existe un usuario con ese email");
  }

  const { password, ...resto } = d;
  const actualizado = await prisma.usuario.update({
    where: { id },
    data: { ...resto, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
    select: seleccion,
  });
  res.json(actualizado);
});
