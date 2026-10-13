import { z } from "zod";
import { HttpError } from "../errors";
import type { UsuarioAuth } from "../middleware/auth";

export const normalizarDni = (s: string) => s.replace(/\D/g, "");
export const normalizarPatente = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function idParam(valor: unknown): number {
  const r = z.coerce.number().int().positive().safeParse(valor);
  if (!r.success) throw new HttpError(400, "Identificador inválido");
  return r.data;
}

// Todo el personal que no es ADMIN opera solo sobre su sucursal; un ADMIN elige una o ve todas.
export function sucursalFiltro(u: UsuarioAuth, pedida?: number): number | undefined {
  return u.rol === "ADMIN" ? pedida : u.sucursalId;
}

// Monto con a lo sumo 2 decimales
export const montoSchema = z
  .number()
  .positive()
  .max(999_999_999)
  .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, {
    message: "El monto admite hasta 2 decimales",
  });

export const redondear2 = (n: number) => Math.round(n * 100) / 100;

// Inicio del mes actual en hora de Argentina (UTC-3), expresado en UTC
export function inicioDeMesAR(ahora = new Date()): Date {
  const ar = new Date(ahora.getTime() - 3 * 3600 * 1000);
  return new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), 1, 3, 0, 0));
}
