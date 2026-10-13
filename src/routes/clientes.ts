import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { METODOS_PAGO } from "../constants";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { idParam, montoSchema, normalizarDni, redondear2, sucursalFiltro } from "../lib/util";
import { usuarioActual } from "../middleware/auth";
import { exigir, tiene } from "../permisos";

// Se monta detrás de requireUsuario
export const clientesRouter = Router();

// "" -> undefined, para que un campo vacío del formulario no choque con los unique
const opcional = (s: z.ZodType<string>) =>
  z.union([z.literal(""), s]).optional().transform((v) => v || undefined);

const clienteSchema = z.object({
  dni: z.string().transform(normalizarDni).pipe(z.string().min(6, "DNI inválido").max(9, "DNI inválido")),
  nombre: z.string().trim().min(1).max(80),
  apellido: z.string().trim().min(1).max(80),
  telefono: opcional(z.string().trim().max(40)),
  email: opcional(z.email()),
  direccion: opcional(z.string().trim().max(200)),
});

async function saldoDe(clienteId: number): Promise<number> {
  const [deb, cred] = await Promise.all([
    prisma.movimientoCC.aggregate({ where: { clienteId, tipoMovimiento: "DEBITO" }, _sum: { monto: true } }),
    prisma.movimientoCC.aggregate({ where: { clienteId, tipoMovimiento: "CREDITO" }, _sum: { monto: true } }),
  ]);
  return redondear2(Number(deb._sum.monto ?? 0) - Number(cred._sum.monto ?? 0));
}

async function clienteOFalla(id: number) {
  const c = await prisma.cliente.findUnique({ where: { id } });
  if (!c) throw new HttpError(404, "Cliente no encontrado");
  return c;
}

// Alta de cliente. Si el DNI ya existe devuelve 409 con el id, para abrir el existente.
clientesRouter.post("/", async (req, res) => {
  exigir(usuarioActual(req).rol, "gestionarClientes");
  const d = clienteSchema.parse(req.body);

  const existente = await prisma.cliente.findUnique({ where: { dni: d.dni }, select: { id: true } });
  if (existente) throw new HttpError(409, "Ya existe un cliente con ese DNI", { clienteId: existente.id });

  const creado = await prisma.cliente.create({ data: d });
  const { passwordHash: _omitido, ...publico } = creado;
  res.status(201).json(publico);
});

clientesRouter.get("/:id", async (req, res) => {
  const u = usuarioActual(req);
  const id = idParam(req.params.id);
  const { passwordHash, ...cliente } = await clienteOFalla(id);

  const [autos, siniestros, saldo] = await Promise.all([
    prisma.auto.findMany({ where: { clienteId: id }, orderBy: { patente: "asc" } }),
    prisma.siniestro.findMany({
      where: { auto: { clienteId: id }, sucursalId: sucursalFiltro(u) },
      select: {
        id: true,
        numeroSiniestro: true,
        estado: true,
        tipoTrabajo: true,
        tipoCobertura: true,
        fechaIngreso: true,
        sucursal: { select: { nombre: true } },
        auto: { select: { patente: true, marca: true, modelo: true } },
      },
      orderBy: { fechaIngreso: "desc" },
    }),
    // El saldo solo lo ven los puestos con acceso a finanzas
    tiene(u.rol, "verFinanzas") ? saldoDe(id) : Promise.resolve(null),
  ]);

  res.json({ ...cliente, tienePortal: passwordHash !== null, autos, siniestros, saldo });
});

clientesRouter.patch("/:id", async (req, res) => {
  exigir(usuarioActual(req).rol, "gestionarClientes");
  const id = idParam(req.params.id);
  // El DNI es el identificador único: no se edita desde acá
  const d = clienteSchema.omit({ dni: true }).partial().parse(req.body);
  await clienteOFalla(id);
  const { passwordHash: _omitido, ...publico } = await prisma.cliente.update({ where: { id }, data: d });
  res.json(publico);
});

// Genera (o resetea) la clave del portal. Se devuelve UNA sola vez para dársela al cliente.
clientesRouter.post("/:id/portal-password", async (req, res) => {
  exigir(usuarioActual(req).rol, "gestionarClientes");
  const id = idParam(req.params.id);
  await clienteOFalla(id);
  const temporal = randomBytes(5).toString("hex"); // 10 caracteres
  await prisma.cliente.update({ where: { id }, data: { passwordHash: await bcrypt.hash(temporal, 10) } });
  res.json({ passwordTemporal: temporal });
});

// ── Cuenta corriente ──────────────────────────────────────────────

clientesRouter.get("/:id/cuenta-corriente", async (req, res) => {
  exigir(usuarioActual(req).rol, "verFinanzas");
  const id = idParam(req.params.id);
  await clienteOFalla(id);
  const [movimientos, saldo] = await Promise.all([
    prisma.movimientoCC.findMany({
      where: { clienteId: id },
      orderBy: { fecha: "desc" },
      take: 200,
      include: { siniestro: { select: { numeroSiniestro: true } } },
    }),
    saldoDe(id),
  ]);
  res.json({ saldo, movimientos });
});

async function validarSiniestroDelCliente(
  u: ReturnType<typeof usuarioActual>,
  clienteId: number,
  siniestroId?: number,
) {
  if (siniestroId === undefined) return;
  const s = await prisma.siniestro.findFirst({
    where: { id: siniestroId, auto: { clienteId }, sucursalId: sucursalFiltro(u) },
    select: { id: true },
  });
  if (!s) throw new HttpError(400, "El siniestro no existe o no pertenece a este cliente");
}

// Cargo (deuda): suma al saldo del cliente
clientesRouter.post("/:id/cargos", async (req, res) => {
  const u = usuarioActual(req);
  exigir(u.rol, "verFinanzas");
  const id = idParam(req.params.id);
  const d = z
    .object({
      monto: montoSchema,
      concepto: z.string().trim().min(2).max(200),
      siniestroId: z.number().int().positive().optional(),
    })
    .parse(req.body);

  await clienteOFalla(id);
  await validarSiniestroDelCliente(u, id, d.siniestroId);

  const mov = await prisma.movimientoCC.create({
    data: { tipoMovimiento: "DEBITO", monto: d.monto, concepto: d.concepto, clienteId: id, siniestroId: d.siniestroId },
  });
  res.status(201).json({ movimiento: mov, saldo: await saldoDe(id) });
});

// Cobro: registra el pago y descuenta del saldo, todo en una sola transacción
clientesRouter.post("/:id/cobros", async (req, res) => {
  const u = usuarioActual(req);
  exigir(u.rol, "verFinanzas");
  const id = idParam(req.params.id);
  const d = z
    .object({
      monto: montoSchema,
      metodoPago: z.enum(METODOS_PAGO),
      siniestroId: z.number().int().positive().optional(),
      concepto: z.string().trim().max(200).optional(),
    })
    .parse(req.body);

  await clienteOFalla(id);
  await validarSiniestroDelCliente(u, id, d.siniestroId);

  const cobro = await prisma.$transaction(async (tx) => {
    const c = await tx.cobro.create({
      data: { monto: d.monto, metodoPago: d.metodoPago, clienteId: id, siniestroId: d.siniestroId },
    });
    await tx.movimientoCC.create({
      data: {
        tipoMovimiento: "CREDITO",
        monto: d.monto,
        concepto: d.concepto ?? `Cobro (${d.metodoPago.toLowerCase().replace("_", " ")})`,
        clienteId: id,
        siniestroId: d.siniestroId,
      },
    });
    return c;
  });
  res.status(201).json({ cobro, saldo: await saldoDe(id) });
});
