import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detalles?: unknown,
  ) {
    super(message);
  }
}

export function noEncontrado(_req: Request, res: Response) {
  res.status(404).json({ error: "Ruta no encontrada" });
}

// Express 5 envía acá cualquier error (también los de funciones async)
export function manejarErrores(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.detalles !== undefined ? { detalles: err.detalles } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Datos inválidos",
      detalles: err.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
    });
    return;
  }

  if (err instanceof MulterError) {
    const muyGrande = err.code === "LIMIT_FILE_SIZE";
    res.status(muyGrande ? 413 : 400).json({
      error: muyGrande ? "El archivo supera los 10 MB" : "No se pudo recibir el archivo",
    });
    return;
  }

  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    res.status(400).json({ error: "El cuerpo de la petición no es un JSON válido" });
    return;
  }

  // Violación de unique de Prisma (ej: DNI, patente o email repetidos)
  if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
    res.status(409).json({ error: "Ya existe un registro con esos datos" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}
