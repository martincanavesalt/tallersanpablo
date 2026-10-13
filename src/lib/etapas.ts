import { prisma } from "../db";

// Valores iniciales, tomados del documento "Software gestión de talleres".
// Se cargan UNA sola vez, cuando la tabla está vacía; después se editan en la base
// (o desde el módulo Configuración) y esta lista no los pisa.
const ETAPAS = [
  { codigo: "PARA_PRESENTAR", nombre: "Para presentar", esMeta: false },
  { codigo: "PRESENTADO", nombre: "Presentado", esMeta: false },
  { codigo: "PRESENTADO_SIN_DENUNCIA", nombre: "Presentado sin denuncia", esMeta: false },
  { codigo: "ESPERA_PERITO", nombre: "Espera de asignación de perito", esMeta: false },
  { codigo: "NEGOCIACION", nombre: "Negociación", esMeta: false },
  { codigo: "ACORDADO_SIN_ORDEN", nombre: "Acordado / ajustado, sin orden", esMeta: false },
  { codigo: "ESPERA_REPUESTOS", nombre: "Espera de repuestos", esMeta: false },
  { codigo: "ESPERA_FRANQUICIA", nombre: "Espera de resolución de franquicia", esMeta: false },
  { codigo: "ESPERA_TURNO", nombre: "Espera de turno", esMeta: true },
] as const;

type Codigo = (typeof ETAPAS)[number]["codigo"];

const TRF = "TODO_RIESGO_FRANQUICIA";

const TRANSICIONES: { desde: Codigo; hasta: Codigo; coberturas?: string; requiereDocumentos?: boolean }[] = [
  // Pasa a la siguiente si está toda la documentación pedida al cliente (y, más adelante, el presupuesto)
  { desde: "PARA_PRESENTAR", hasta: "PRESENTADO", requiereDocumentos: true },
  // Terceros: la aseguradora chequea que su asegurado haya hecho la denuncia
  { desde: "PRESENTADO", hasta: "PRESENTADO_SIN_DENUNCIA", coberturas: "TERCERO" },
  { desde: "PRESENTADO_SIN_DENUNCIA", hasta: "ESPERA_PERITO", coberturas: "TERCERO" },
  { desde: "PRESENTADO", hasta: "ESPERA_PERITO" },
  { desde: "ESPERA_PERITO", hasta: "NEGOCIACION" },
  { desde: "NEGOCIACION", hasta: "ACORDADO_SIN_ORDEN" },
  // Con la orden de reparación: sin repuestos que esperar → turno; con repuestos → espera de repuestos;
  // con franquicia a reclamar → espera de resolución de franquicia
  { desde: "ACORDADO_SIN_ORDEN", hasta: "ESPERA_TURNO" },
  { desde: "ACORDADO_SIN_ORDEN", hasta: "ESPERA_REPUESTOS" },
  { desde: "ACORDADO_SIN_ORDEN", hasta: "ESPERA_FRANQUICIA", coberturas: TRF },
  { desde: "ESPERA_REPUESTOS", hasta: "ESPERA_TURNO" },
  { desde: "ESPERA_REPUESTOS", hasta: "ESPERA_FRANQUICIA", coberturas: TRF },
  { desde: "ESPERA_FRANQUICIA", hasta: "ESPERA_TURNO" },
  { desde: "ESPERA_FRANQUICIA", hasta: "ESPERA_REPUESTOS" },
  // Si se cae el turno, vuelve a esperar
  { desde: "ESPERA_TURNO", hasta: "ESPERA_REPUESTOS" },
  { desde: "ESPERA_TURNO", hasta: "ESPERA_FRANQUICIA", coberturas: TRF },
];

export async function asegurarEtapasBase(): Promise<void> {
  if ((await prisma.etapaGestion.count()) > 0) return;
  // Pocas consultas en lote: con la base en la nube, muchas consultas sueltas vencen el límite de la transacción
  await prisma.etapaGestion.createMany({ data: ETAPAS.map((e, i) => ({ ...e, orden: i + 1 })) });
  const creadas = await prisma.etapaGestion.findMany({ select: { id: true, codigo: true } });
  const ids = new Map(creadas.map((c) => [c.codigo, c.id]));
  await prisma.etapaTransicion.createMany({
    data: TRANSICIONES.map((t) => ({
      desdeId: ids.get(t.desde)!,
      hastaId: ids.get(t.hasta)!,
      coberturas: t.coberturas,
      requiereDocumentos: t.requiereDocumentos ?? false,
    })),
  });
}

// Etapas a las que puede pasar un siniestro desde la que tiene, según su cobertura
export async function etapasSiguientes(etapaId: number | null, cobertura: string | null) {
  if (etapaId === null) return [];
  const filas = await prisma.etapaTransicion.findMany({
    where: { desdeId: etapaId, hasta: { activa: true } },
    include: { hasta: true },
    orderBy: { hasta: { orden: "asc" } },
  });
  return filas
    .filter((t) => !t.coberturas || (cobertura !== null && t.coberturas.split(",").includes(cobertura)))
    .map((t) => ({
      id: t.hasta.id,
      codigo: t.hasta.codigo,
      nombre: t.hasta.nombre,
      esMeta: t.hasta.esMeta,
      requiereDocumentos: t.requiereDocumentos,
    }));
}
