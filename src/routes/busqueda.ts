import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { normalizarDni, normalizarPatente } from "../lib/util";

export const busquedaRouter = Router();

// Buscador único del flujo: DNI, patente o apellido/nombre
busquedaRouter.get("/", async (req, res) => {
  const { q } = z.object({ q: z.string().trim().min(2).max(60) }).parse(req.query);

  const dni = normalizarDni(q);
  const patente = normalizarPatente(q);

  const clientes = await prisma.cliente.findMany({
    where: {
      OR: [
        ...(dni.length >= 3 ? [{ dni: { startsWith: dni } }] : []),
        { apellido: { contains: q, mode: "insensitive" as const } },
        { nombre: { contains: q, mode: "insensitive" as const } },
      ],
    },
    select: { id: true, dni: true, nombre: true, apellido: true, telefono: true, _count: { select: { autos: true } } },
    orderBy: { apellido: "asc" },
    take: 20,
  });

  const autos =
    patente.length >= 2
      ? await prisma.auto.findMany({
          where: { patente: { contains: patente } },
          select: {
            id: true,
            patente: true,
            marca: true,
            modelo: true,
            cliente: { select: { id: true, dni: true, nombre: true, apellido: true } },
          },
          take: 20,
        })
      : [];

  res.json({ clientes, autos });
});
