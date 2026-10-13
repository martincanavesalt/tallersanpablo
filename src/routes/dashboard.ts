import { Router } from "express";
import { z } from "zod";
import { ESTADOS } from "../constants";
import { prisma } from "../db";
import { inicioDeMesAR, redondear2, sucursalFiltro } from "../lib/util";
import { usuarioActual } from "../middleware/auth";
import { tiene } from "../permisos";

// Se monta detrás de requireUsuario
export const dashboardRouter = Router();

// El personal ve solo su sucursal; un ADMIN ve las tres (o una con ?sucursalId=)
dashboardRouter.get("/", async (req, res) => {
  const u = usuarioActual(req);
  const { sucursalId } = z
    .object({ sucursalId: z.coerce.number().int().positive().optional() })
    .parse(req.query);

  const filtro = sucursalFiltro(u, sucursalId);
  const sucursales = await prisma.sucursal.findMany({
    where: filtro ? { id: filtro } : undefined,
    orderBy: { id: "asc" },
  });
  const desde = inicioDeMesAR();
  const verFinanzas = tiene(u.rol, "verFinanzas");

  const resultado = await Promise.all(
    sucursales.map(async (s) => {
      const [porEstadoRaw, ingresadosMes, entregadosMes, cobrosMes, conDocsPendientes] = await Promise.all([
        prisma.siniestro.groupBy({ by: ["estado"], where: { sucursalId: s.id }, _count: { _all: true } }),
        prisma.siniestro.count({ where: { sucursalId: s.id, fechaIngreso: { gte: desde } } }),
        prisma.siniestro.count({ where: { sucursalId: s.id, fechaEntrega: { gte: desde } } }),
        verFinanzas
          ? prisma.cobro.aggregate({
              where: { fecha: { gte: desde }, siniestro: { sucursalId: s.id } },
              _sum: { monto: true },
            })
          : Promise.resolve(null),
        prisma.siniestro.count({
          where: {
            sucursalId: s.id,
            estado: { not: "ENTREGADO" },
            documentos: { some: { obligatorio: true, archivoUrl: null } },
          },
        }),
      ]);

      const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<(typeof ESTADOS)[number], number>;
      for (const f of porEstadoRaw) porEstado[f.estado] = f._count._all;
      const activos = ESTADOS.filter((e) => e !== "ENTREGADO").reduce((acc, e) => acc + porEstado[e], 0);

      return {
        sucursal: { id: s.id, nombre: s.nombre },
        activos,
        porEstado,
        ingresadosMes,
        entregadosMes,
        // null para los puestos sin acceso a finanzas
        cobrosMes: cobrosMes ? redondear2(Number(cobrosMes._sum.monto ?? 0)) : null,
        siniestrosConDocumentosPendientes: conDocsPendientes,
      };
    }),
  );

  res.json({ desde, sucursales: resultado });
});
