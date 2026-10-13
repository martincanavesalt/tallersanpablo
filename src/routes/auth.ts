import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { normalizarDni } from "../lib/util";
import { firmarToken, requireUsuario, usuarioActual } from "../middleware/auth";
import { permisosDe, type Rol } from "../permisos";

export const authRouter = Router();

const limitarIntentos = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Probá de nuevo en 15 minutos." },
});

// Se compara contra este hash cuando el usuario no existe, para que el tiempo
// de respuesta no revele qué emails o DNI están registrados.
const HASH_FALSO = bcrypt.hashSync("clave-que-nadie-usa", 10);

// Lo que el panel necesita saber del usuario, incluidos los permisos de su puesto
function datosUsuario(u: {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  sucursalId: number;
  sucursal: { nombre: string };
}) {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    sucursalId: u.sucursalId,
    sucursal: u.sucursal.nombre,
    permisos: permisosDe(u.rol),
  };
}

// Login del personal del taller
authRouter.post("/login", limitarIntentos, async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().trim().min(3), password: z.string().min(1) })
    .parse(req.body);

  const u = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { sucursal: true },
  });
  const ok = await bcrypt.compare(password, u?.passwordHash ?? HASH_FALSO);
  if (!u || !u.activo || !ok) throw new HttpError(401, "Credenciales inválidas");

  res.json({ token: firmarToken("usuario", u.id, 8 * 3600), usuario: datosUsuario(u) });
});

// Datos actualizados del usuario logueado (si le cambiaron el puesto o la sucursal, se ve acá)
authRouter.get("/me", requireUsuario, async (req, res) => {
  const yo = usuarioActual(req);
  const u = await prisma.usuario.findUniqueOrThrow({ where: { id: yo.id }, include: { sucursal: true } });
  res.json(datosUsuario(u));
});

// Cada persona cambia su propia clave
authRouter.post("/cambiar-clave", limitarIntentos, requireUsuario, async (req, res) => {
  const yo = usuarioActual(req);
  const { actual, nueva } = z
    .object({
      actual: z.string().min(1),
      nueva: z.string().min(8, "La clave nueva debe tener al menos 8 caracteres").max(100),
    })
    .parse(req.body);

  const u = await prisma.usuario.findUniqueOrThrow({ where: { id: yo.id } });
  if (!(await bcrypt.compare(actual, u.passwordHash))) throw new HttpError(400, "La clave actual no es correcta");
  if (actual === nueva) throw new HttpError(400, "La clave nueva tiene que ser distinta de la actual");

  await prisma.usuario.update({ where: { id: yo.id }, data: { passwordHash: await bcrypt.hash(nueva, 10) } });
  res.json({ ok: true });
});

// Login del portal de clientes (DNI + clave)
authRouter.post("/portal/login", limitarIntentos, async (req, res) => {
  const { dni, password } = z
    .object({ dni: z.string().min(1), password: z.string().min(1) })
    .parse(req.body);

  const c = await prisma.cliente.findUnique({ where: { dni: normalizarDni(dni) } });
  const ok = await bcrypt.compare(password, c?.passwordHash ?? HASH_FALSO);
  if (!c || !c.activo || !c.passwordHash || !ok) throw new HttpError(401, "DNI o clave incorrectos");

  res.json({
    token: firmarToken("cliente", c.id, 12 * 3600),
    cliente: { id: c.id, nombre: c.nombre, apellido: c.apellido },
  });
});
