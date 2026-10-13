import { Router } from "express";
import { prisma } from "../db";

// Se monta detrás de requireUsuario
export const sucursalesRouter = Router();

sucursalesRouter.get("/", async (_req, res) => {
  res.json(await prisma.sucursal.findMany({ select: { id: true, nombre: true }, orderBy: { id: "asc" } }));
});
