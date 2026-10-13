import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { prisma } from "../db";
import { HttpError } from "../errors";
import type { Rol } from "../permisos";

export type UsuarioAuth = {
  tipo: "usuario";
  id: number;
  rol: Rol;
  sucursalId: number;
};
export type ClienteAuth = { tipo: "cliente"; id: number };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: UsuarioAuth | ClienteAuth;
    }
  }
}

// El token solo dice quién es; rol y sucursal se leen de la base en cada pedido,
// así un cambio de rol o una baja se aplican al instante.
export function firmarToken(tipo: "usuario" | "cliente", id: number, segundos: number): string {
  return jwt.sign({ tipo, id }, config.jwtSecret, { algorithm: "HS256", expiresIn: segundos });
}

function leerToken(req: Request): { tipo: "usuario" | "cliente"; id: number } {
  const cabecera = req.headers.authorization;
  if (!cabecera?.startsWith("Bearer ")) throw new HttpError(401, "Falta iniciar sesión");
  try {
    const p = jwt.verify(cabecera.slice(7), config.jwtSecret, { algorithms: ["HS256"] });
    if (
      typeof p === "object" &&
      (p.tipo === "usuario" || p.tipo === "cliente") &&
      Number.isInteger(p.id)
    ) {
      return { tipo: p.tipo, id: p.id as number };
    }
  } catch {
    // cae al error de abajo
  }
  throw new HttpError(401, "Sesión inválida o vencida");
}

async function cargarUsuario(req: Request): Promise<UsuarioAuth> {
  const t = leerToken(req);
  if (t.tipo !== "usuario") throw new HttpError(403, "Acceso solo para personal del taller");
  const u = await prisma.usuario.findUnique({
    where: { id: t.id },
    select: { id: true, activo: true, rol: true, sucursalId: true },
  });
  if (!u || !u.activo) throw new HttpError(401, "Usuario inexistente o dado de baja");
  return { tipo: "usuario", id: u.id, rol: u.rol, sucursalId: u.sucursalId };
}

export async function requireUsuario(req: Request, _res: Response, next: NextFunction) {
  req.auth = await cargarUsuario(req);
  next();
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const u = await cargarUsuario(req);
  if (u.rol !== "ADMIN") throw new HttpError(403, "Solo administradores");
  req.auth = u;
  next();
}

export async function requireCliente(req: Request, _res: Response, next: NextFunction) {
  const t = leerToken(req);
  if (t.tipo !== "cliente") throw new HttpError(403, "Acceso solo para clientes");
  const c = await prisma.cliente.findUnique({
    where: { id: t.id },
    select: { id: true, activo: true },
  });
  if (!c || !c.activo) throw new HttpError(401, "Cliente inexistente o dado de baja");
  req.auth = { tipo: "cliente", id: c.id };
  next();
}

export function usuarioActual(req: Request): UsuarioAuth {
  if (req.auth?.tipo !== "usuario") throw new HttpError(401, "Falta iniciar sesión");
  return req.auth;
}

export function clienteActual(req: Request): ClienteAuth {
  if (req.auth?.tipo !== "cliente") throw new HttpError(401, "Falta iniciar sesión");
  return req.auth;
}
