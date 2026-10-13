import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  COMBUSTIBLES,
  ESTADOS,
  TIPOS_COBERTURA,
  TIPOS_TRABAJO,
  documentosObligatorios,
  transicionesDe,
  type TipoCobertura,
} from "../constants";
import { prisma } from "../db";
import type { Prisma } from "../../generated/prisma/client";
import { HttpError } from "../errors";
import { idParam, montoSchema, normalizarDni, normalizarPatente, sucursalFiltro } from "../lib/util";
import { usuarioActual, type UsuarioAuth } from "../middleware/auth";
import { exigir, puedeTransicionar, tiene, transicionesPermitidas } from "../permisos";
import { etapasSiguientes } from "../lib/etapas";

// Se monta detrás de requireUsuario
export const siniestrosRouter = Router();

const detalle = {
  sucursal: { select: { id: true, nombre: true } },
  auto: {
    include: {
      cliente: { select: { id: true, dni: true, nombre: true, apellido: true, telefono: true, email: true } },
    },
  },
  documentos: { orderBy: { id: "asc" } },
  etapaGestion: true,
  historialEstados: {
    orderBy: { fecha: "asc" },
    include: { usuario: { select: { nombre: true } } },
  },
  movimientosGestion: {
    orderBy: { fecha: "asc" },
    include: {
      etapaAnterior: { select: { nombre: true } },
      etapaNueva: { select: { nombre: true } },
      usuario: { select: { nombre: true } },
    },
  },
} satisfies Prisma.SiniestroInclude;

type SiniestroDetallado = Prisma.SiniestroGetPayload<{ include: typeof detalle }>;

// Quien no es ADMIN y pide un siniestro de otra sucursal recibe 404, como si no existiera
export async function cargarSiniestro(u: UsuarioAuth, id: number): Promise<SiniestroDetallado> {
  const s = await prisma.siniestro.findFirst({
    where: { id, sucursalId: sucursalFiltro(u) },
    include: detalle,
  });
  if (!s) throw new HttpError(404, "Siniestro no encontrado");
  return s;
}

// Un trabajo por aseguradora con etapas no pasa al taller hasta llegar a "Espera de turno"
function gestionPendiente(s: SiniestroDetallado): boolean {
  return s.tipoTrabajo === "ASEGURADORA" && s.etapaGestion !== null && !s.etapaGestion.esMeta;
}

// Lo que se devuelve al frontend: sin claves internas del storage
async function presentar(s: SiniestroDetallado, u: UsuarioAuth) {
  const { documentos, movimientosGestion, ...resto } = s;
  const docs = documentos.map((d) => ({
    id: d.id,
    tipoDocumento: d.tipoDocumento,
    obligatorio: d.obligatorio,
    cargado: d.archivoUrl !== null,
    formato: d.formato,
    fechaCarga: d.fechaCarga,
  }));

  const etapasActivas = s.etapaGestionId !== null
    ? await prisma.etapaGestion.findMany({ where: { activa: true }, orderBy: { orden: "asc" } })
    : [];
  const siguientes =
    tiene(u.rol, "gestionarEtapas") && s.estado !== "ENTREGADO"
      ? await etapasSiguientes(s.etapaGestionId, s.tipoCobertura)
      : [];

  // Bitácora única: cambios de etapa de gestión y de estado de taller, en orden
  const bitacora = [
    ...movimientosGestion.map((m) => ({
      id: `g${m.id}`,
      tipo: "ETAPA" as const,
      fecha: m.fecha,
      texto: m.etapaNueva.nombre,
      desde: m.etapaAnterior?.nombre ?? null,
      comentario: m.comentario,
      usuario: m.usuario.nombre,
    })),
    ...s.historialEstados.map((h) => ({
      id: `e${h.id}`,
      tipo: "ESTADO" as const,
      fecha: h.fecha,
      texto: h.estadoNuevo,
      desde: h.estadoAnterior,
      comentario: h.comentario,
      usuario: h.usuario.nombre,
    })),
  ].sort((x, y) => x.fecha.getTime() - y.fecha.getTime());

  return {
    ...resto,
    documentos: docs,
    documentosFaltantes: docs.filter((d) => d.obligatorio && !d.cargado).map((d) => d.tipoDocumento),
    // Qué cambios de estado de taller puede hacer ESTE usuario según su puesto
    transicionesPermitidas: gestionPendiente(s) ? [] : transicionesPermitidas(u.rol, s.estado, s),
    // Gestión con la aseguradora
    etapasGestion: etapasActivas.map((e) => ({ id: e.id, nombre: e.nombre, esMeta: e.esMeta })),
    etapasSiguientes: siguientes,
    bitacora,
  };
}

const coberturaValida = (d: { tipoCobertura: TipoCobertura | null; montoFranquicia?: number | null }) =>
  d.tipoCobertura === "TODO_RIESGO_FRANQUICIA"
    ? d.montoFranquicia !== undefined && d.montoFranquicia !== null
    : d.montoFranquicia === undefined || d.montoFranquicia === null;

const MSG_FRANQUICIA = "montoFranquicia es obligatorio solo cuando la cobertura es TODO_RIESGO_FRANQUICIA";
const MSG_PARTICULAR = "Este dato no aplica a un trabajo particular";

const texto = (max: number) => z.string().trim().min(1).max(max);

// Datos de la recepción y del hecho: iguales para los dos tipos de trabajo
const recepcionCampos = {
  fechaHecho: z.coerce.date().optional(),
  relato: texto(2000).optional(),
  kilometraje: z.number().int().min(0).max(2_000_000).optional(),
  combustible: z.enum(COMBUSTIBLES).optional(),
  inventario: texto(1000).optional(),
  estadoPrevio: texto(1000).optional(),
  chasis: texto(30).optional(),
};

// ── Alta ──────────────────────────────────────────────────────────

const crearSchema = z
  .object({
    autoId: z.number().int().positive(),
    tipoTrabajo: z.enum(TIPOS_TRABAJO),
    // Solo trabajos por aseguradora
    tipoCobertura: z.enum(TIPOS_COBERTURA).optional(),
    montoFranquicia: montoSchema.optional(),
    aseguradora: texto(80).optional(),
    numeroPoliza: texto(60).optional(),
    aseguradoraTercero: texto(80).optional(),
    reclamoTercero: texto(60).optional(),
    // Si no se manda, el sistema genera SIN-000123 (o PAR-000123 en los particulares)
    numeroSiniestro: z.string().trim().min(1).max(50).optional(),
    descripcion: z.string().trim().max(2000).optional(),
    fechaEstimada: z.coerce.date().optional(),
    // Solo lo usa un ADMIN; el resto siempre carga en su sucursal
    sucursalId: z.number().int().positive().optional(),
    ...recepcionCampos,
  })
  .superRefine((d, ctx) => {
    const error = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (d.tipoTrabajo === "PARTICULAR") {
      for (const k of ["tipoCobertura", "montoFranquicia", "aseguradora", "numeroPoliza", "aseguradoraTercero", "reclamoTercero"] as const) {
        if (d[k] !== undefined) error(k, MSG_PARTICULAR);
      }
      return;
    }
    if (!d.tipoCobertura) error("tipoCobertura", "Elegí el tipo de cobertura");
    if (!d.aseguradora) error("aseguradora", "Indicá la compañía de seguros");
    if (!coberturaValida({ tipoCobertura: d.tipoCobertura ?? null, montoFranquicia: d.montoFranquicia })) {
      error("montoFranquicia", MSG_FRANQUICIA);
    }
    if (d.tipoCobertura !== "TERCERO" && (d.aseguradoraTercero !== undefined || d.reclamoTercero !== undefined)) {
      error("aseguradoraTercero", "Los datos del tercero solo aplican a la cobertura TERCERO");
    }
  });

siniestrosRouter.post("/", async (req, res) => {
  const u = usuarioActual(req);
  exigir(u.rol, "gestionarSiniestros");
  const d = crearSchema.parse(req.body);

  const sucursalId = u.rol === "ADMIN" ? d.sucursalId : u.sucursalId;
  if (!sucursalId) throw new HttpError(400, "Un administrador debe indicar la sucursalId");
  if (!(await prisma.sucursal.findUnique({ where: { id: sucursalId }, select: { id: true } }))) {
    throw new HttpError(400, "La sucursal no existe");
  }
  if (!(await prisma.auto.findUnique({ where: { id: d.autoId }, select: { id: true } }))) {
    throw new HttpError(404, "Auto no encontrado");
  }
  if (d.numeroSiniestro) {
    const repetido = await prisma.siniestro.findUnique({ where: { numeroSiniestro: d.numeroSiniestro }, select: { id: true } });
    if (repetido) throw new HttpError(409, "Ya existe un siniestro con ese número", { siniestroId: repetido.id });
  }

  const particular = d.tipoTrabajo === "PARTICULAR";
  const cobertura = d.tipoCobertura ?? null;
  // Un trabajo por aseguradora arranca en la primera etapa de la gestión
  const primeraEtapa = particular
    ? null
    : await prisma.etapaGestion.findFirst({ where: { activa: true }, orderBy: { orden: "asc" }, select: { id: true } });

  const creado = await prisma.$transaction(async (tx) => {
    const s = await tx.siniestro.create({
      data: {
        numeroSiniestro: d.numeroSiniestro ?? `TMP-${randomUUID()}`,
        tipoTrabajo: d.tipoTrabajo,
        tipoCobertura: cobertura,
        etapaGestionId: primeraEtapa?.id ?? null,
        montoFranquicia: d.montoFranquicia,
        aseguradora: d.aseguradora,
        numeroPoliza: d.numeroPoliza,
        aseguradoraTercero: d.aseguradoraTercero,
        reclamoTercero: d.reclamoTercero,
        fechaHecho: d.fechaHecho,
        relato: d.relato,
        kilometraje: d.kilometraje,
        combustible: d.combustible,
        inventario: d.inventario,
        estadoPrevio: d.estadoPrevio,
        descripcion: d.descripcion,
        fechaEstimada: d.fechaEstimada,
        autoId: d.autoId,
        sucursalId,
        usuarioCargaId: u.id,
      },
    });
    if (!d.numeroSiniestro) {
      await tx.siniestro.update({
        where: { id: s.id },
        data: { numeroSiniestro: `${particular ? "PAR" : "SIN"}-${String(s.id).padStart(6, "0")}` },
      });
    }
    // El chasis es del auto, no del ingreso
    if (d.chasis) await tx.auto.update({ where: { id: d.autoId }, data: { chasis: d.chasis } });
    await tx.historialEstado.create({
      data: {
        estadoAnterior: null,
        estadoNuevo: "INGRESADO",
        comentario: particular ? "Ingreso al taller (trabajo particular)" : "Ingreso al taller (por aseguradora)",
        siniestroId: s.id,
        usuarioId: u.id,
      },
    });
    if (primeraEtapa) {
      await tx.movimientoGestion.create({
        data: { siniestroId: s.id, etapaNuevaId: primeraEtapa.id, comentario: "Alta del siniestro", usuarioId: u.id },
      });
    }
    // Checklist automático de documentos obligatorios (archivo pendiente)
    await tx.documento.createMany({
      data: documentosObligatorios(d.tipoTrabajo, cobertura).map((t) => ({
        siniestroId: s.id,
        tipoDocumento: t,
        obligatorio: true,
      })),
    });
    return s.id;
  });

  res.status(201).json(await presentar(await cargarSiniestro(u, creado), u));
});

// ── Consulta ──────────────────────────────────────────────────────

siniestrosRouter.get("/", async (req, res) => {
  const u = usuarioActual(req);
  const q = z
    .object({
      estado: z.enum(ESTADOS).optional(),
      tipoTrabajo: z.enum(TIPOS_TRABAJO).optional(),
      activos: z.enum(["true", "false"]).optional(),
      sucursalId: z.coerce.number().int().positive().optional(),
      q: z.string().trim().max(60).optional(),
      pagina: z.coerce.number().int().min(1).default(1),
    })
    .parse(req.query);

  const or: Prisma.SiniestroWhereInput[] = [];
  if (q.q) {
    or.push(
      { numeroSiniestro: { contains: q.q, mode: "insensitive" } },
      { auto: { cliente: { apellido: { contains: q.q, mode: "insensitive" } } } },
    );
    const patente = normalizarPatente(q.q);
    if (patente.length >= 2) or.push({ auto: { patente: { contains: patente } } });
    const dni = normalizarDni(q.q);
    if (dni.length >= 3) or.push({ auto: { cliente: { dni: { startsWith: dni } } } });
  }

  const where: Prisma.SiniestroWhereInput = {
    sucursalId: sucursalFiltro(u, q.sucursalId),
    tipoTrabajo: q.tipoTrabajo,
    estado: q.estado ?? (q.activos === "true" ? { not: "ENTREGADO" } : undefined),
    ...(or.length ? { OR: or } : {}),
  };

  const POR_PAGINA = 50;
  const [total, filas] = await Promise.all([
    prisma.siniestro.count({ where }),
    prisma.siniestro.findMany({
      where,
      orderBy: { fechaIngreso: "desc" },
      skip: (q.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        numeroSiniestro: true,
        estado: true,
        tipoTrabajo: true,
        tipoCobertura: true,
        aseguradora: true,
        etapaGestion: { select: { id: true, nombre: true } },
        fechaIngreso: true,
        fechaEstimada: true,
        sucursal: { select: { nombre: true } },
        auto: {
          select: {
            patente: true,
            marca: true,
            modelo: true,
            cliente: { select: { id: true, dni: true, nombre: true, apellido: true } },
          },
        },
        documentos: { where: { obligatorio: true, archivoUrl: null }, select: { id: true } },
      },
    }),
  ]);

  res.json({
    total,
    pagina: q.pagina,
    porPagina: POR_PAGINA,
    siniestros: filas.map(({ documentos, ...s }) => ({ ...s, documentosFaltantes: documentos.length })),
  });
});

siniestrosRouter.get("/:id", async (req, res) => {
  const u = usuarioActual(req);
  res.json(await presentar(await cargarSiniestro(u, idParam(req.params.id)), u));
});

// ── Edición de datos ──────────────────────────────────────────────

siniestrosRouter.patch("/:id", async (req, res) => {
  const u = usuarioActual(req);
  exigir(u.rol, "gestionarSiniestros");
  const id = idParam(req.params.id);
  const d = z
    .object({
      descripcion: z.string().trim().max(2000).nullable().optional(),
      fechaEstimada: z.coerce.date().nullable().optional(),
      tipoCobertura: z.enum(TIPOS_COBERTURA).optional(),
      montoFranquicia: montoSchema.nullable().optional(),
      aseguradora: texto(80).optional(), // la compañía no se puede borrar, solo cambiar
      numeroPoliza: texto(60).nullable().optional(),
      aseguradoraTercero: texto(80).nullable().optional(),
      reclamoTercero: texto(60).nullable().optional(),
      fechaHecho: z.coerce.date().nullable().optional(),
      relato: texto(2000).nullable().optional(),
      kilometraje: z.number().int().min(0).max(2_000_000).nullable().optional(),
      combustible: z.enum(COMBUSTIBLES).nullable().optional(),
      inventario: texto(1000).nullable().optional(),
      estadoPrevio: texto(1000).nullable().optional(),
      chasis: texto(30).optional(),
      franquiciaResuelta: z.boolean().optional(),
    })
    .parse(req.body);

  const actual = await cargarSiniestro(u, id);
  if (actual.estado === "ENTREGADO") throw new HttpError(409, "El siniestro ya fue entregado y no se puede modificar");

  const particular = actual.tipoTrabajo === "PARTICULAR";
  if (particular && d.franquiciaResuelta !== undefined) {
    throw new HttpError(400, `franquiciaResuelta: ${MSG_PARTICULAR}`);
  }
  if (particular) {
    for (const k of ["tipoCobertura", "montoFranquicia", "aseguradora", "numeroPoliza", "aseguradoraTercero", "reclamoTercero"] as const) {
      if (d[k] !== undefined) throw new HttpError(400, `${k}: ${MSG_PARTICULAR}`);
    }
  }

  const cobertura: TipoCobertura | null = d.tipoCobertura ?? actual.tipoCobertura;
  // Si cambia la cobertura y no se informa monto, se descarta el anterior
  const monto =
    d.montoFranquicia !== undefined
      ? d.montoFranquicia
      : d.tipoCobertura && d.tipoCobertura !== actual.tipoCobertura
        ? null
        : actual.montoFranquicia === null
          ? null
          : Number(actual.montoFranquicia);
  if (!particular && !coberturaValida({ tipoCobertura: cobertura, montoFranquicia: monto })) {
    throw new HttpError(400, MSG_FRANQUICIA);
  }
  // Los datos del tercero solo existen con cobertura TERCERO
  const hayTercero = cobertura === "TERCERO";
  if (!hayTercero && (d.aseguradoraTercero || d.reclamoTercero)) {
    throw new HttpError(400, "Los datos del tercero solo aplican a la cobertura TERCERO");
  }

  const { chasis, ...datos } = d;
  await prisma.$transaction(async (tx) => {
    await tx.siniestro.update({
      where: { id },
      data: {
        ...datos,
        tipoCobertura: particular ? null : cobertura,
        montoFranquicia: particular ? null : monto,
        ...(!particular && !hayTercero ? { aseguradoraTercero: null, reclamoTercero: null } : {}),
      },
    });
    if (chasis) await tx.auto.update({ where: { id: actual.autoId }, data: { chasis } });

    // Mantener el checklist coherente con la cobertura (los particulares no tienen carta)
    if (!particular) {
      const carta = actual.documentos.find((x) => x.tipoDocumento === "CARTA_FRANQUICIA");
      if (cobertura === "TODO_RIESGO_FRANQUICIA") {
        if (!carta) {
          await tx.documento.create({ data: { siniestroId: id, tipoDocumento: "CARTA_FRANQUICIA", obligatorio: true } });
        } else if (!carta.obligatorio) {
          await tx.documento.update({ where: { id: carta.id }, data: { obligatorio: true } });
        }
      } else if (carta) {
        if (carta.archivoUrl) {
          await tx.documento.update({ where: { id: carta.id }, data: { obligatorio: false } });
        } else {
          await tx.documento.delete({ where: { id: carta.id } });
        }
      }
    }
  });

  res.json(await presentar(await cargarSiniestro(u, id), u));
});

// ── Cambio de estado ──────────────────────────────────────────────

siniestrosRouter.patch("/:id/estado", async (req, res) => {
  const u = usuarioActual(req);
  const id = idParam(req.params.id);
  const { estado, comentario } = z
    .object({ estado: z.enum(ESTADOS), comentario: z.string().trim().max(500).optional() })
    .parse(req.body);

  const s = await cargarSiniestro(u, id);

  if (!transicionesDe(s, s.estado).includes(estado)) {
    throw new HttpError(409, `No se puede pasar de ${s.estado} a ${estado}`, {
      permitidos: transicionesDe(s, s.estado),
    });
  }
  if (!puedeTransicionar(u.rol, s.estado, estado, s)) {
    throw new HttpError(403, "Tu puesto no puede hacer este cambio de estado", {
      permitidos: transicionesPermitidas(u.rol, s.estado, s),
    });
  }
  if (gestionPendiente(s)) {
    throw new HttpError(
      409,
      `La gestión con la aseguradora está en “${s.etapaGestion!.nombre}”. El auto pasa a reparación cuando llega a la etapa final de espera de turno.`,
    );
  }

  // Para salir de INGRESADO tiene que estar toda la documentación obligatoria
  if (s.estado === "INGRESADO") {
    const faltan = s.documentos.filter((x) => x.obligatorio && !x.archivoUrl).map((x) => x.tipoDocumento);
    if (faltan.length > 0) {
      throw new HttpError(409, "Faltan documentos obligatorios para avanzar", { faltan });
    }
  }

  await prisma.$transaction(async (tx) => {
    // Condición sobre el estado anterior: si otro usuario lo cambió en el medio, no pisa
    const r = await tx.siniestro.updateMany({
      where: { id, estado: s.estado },
      data: { estado, ...(estado === "ENTREGADO" ? { fechaEntrega: new Date() } : {}) },
    });
    if (r.count === 0) throw new HttpError(409, "El siniestro cambió de estado mientras tanto. Recargá la pantalla.");
    await tx.historialEstado.create({
      data: { estadoAnterior: s.estado, estadoNuevo: estado, comentario, siniestroId: id, usuarioId: u.id },
    });
  });

  res.json(await presentar(await cargarSiniestro(u, id), u));
});

// ── Cambio de etapa en la gestión con la aseguradora ──────────────

siniestrosRouter.patch("/:id/etapa", async (req, res) => {
  const u = usuarioActual(req);
  exigir(u.rol, "gestionarEtapas");
  const id = idParam(req.params.id);
  const { etapaId, comentario } = z
    .object({ etapaId: z.number().int().positive(), comentario: z.string().trim().max(500).optional() })
    .parse(req.body);

  const s = await cargarSiniestro(u, id);
  if (s.tipoTrabajo !== "ASEGURADORA" || s.etapaGestionId === null) {
    throw new HttpError(409, "Este ingreso no tiene gestión con aseguradora");
  }
  if (s.estado !== "INGRESADO") {
    throw new HttpError(409, "La gestión ya terminó: el auto está en el taller");
  }

  const siguientes = await etapasSiguientes(s.etapaGestionId, s.tipoCobertura);
  const destino = siguientes.find((e) => e.id === etapaId);
  if (!destino) {
    throw new HttpError(409, "No se puede pasar a esa etapa desde la actual", {
      permitidas: siguientes.map((e) => ({ id: e.id, nombre: e.nombre })),
    });
  }

  if (destino.requiereDocumentos) {
    const faltan = s.documentos.filter((x) => x.obligatorio && !x.archivoUrl).map((x) => x.tipoDocumento);
    if (faltan.length > 0) throw new HttpError(409, "Faltan documentos obligatorios para avanzar", { faltan });
  }
  if (destino.esMeta && s.tipoCobertura === "TODO_RIESGO_FRANQUICIA" && !s.franquiciaResuelta) {
    throw new HttpError(
      409,
      "Falta confirmar la franquicia: tiene que estar autorizada por la otra compañía o abonada por el cliente",
    );
  }

  await prisma.$transaction(async (tx) => {
    // Condición sobre la etapa anterior: si otro usuario la cambió en el medio, no pisa
    const r = await tx.siniestro.updateMany({
      where: { id, etapaGestionId: s.etapaGestionId },
      data: { etapaGestionId: destino.id },
    });
    if (r.count === 0) throw new HttpError(409, "El siniestro cambió de etapa mientras tanto. Recargá la pantalla.");
    await tx.movimientoGestion.create({
      data: {
        siniestroId: id,
        etapaAnteriorId: s.etapaGestionId,
        etapaNuevaId: destino.id,
        comentario,
        usuarioId: u.id,
      },
    });
  });

  res.json(await presentar(await cargarSiniestro(u, id), u));
});
