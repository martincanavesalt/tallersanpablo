// Estos valores replican los enums de prisma/schema.prisma.
// Se declaran acá como strings para validar con zod sin depender del cliente generado.

export const TIPOS_COBERTURA = ["TERCERO", "TODO_RIESGO", "TODO_RIESGO_FRANQUICIA"] as const;
export type TipoCobertura = (typeof TIPOS_COBERTURA)[number];

export const TIPOS_TRABAJO = ["PARTICULAR", "ASEGURADORA"] as const;
export type TipoTrabajo = (typeof TIPOS_TRABAJO)[number];

export const COMBUSTIBLES = ["VACIO", "UN_CUARTO", "MEDIO", "TRES_CUARTOS", "LLENO"] as const;

export const ESTADOS = [
  "INGRESADO",
  "ESPERANDO_PAPELES_SEGURO",
  "EN_REPARACION",
  "ESPERANDO_REPUESTOS",
  "CONTROL_CALIDAD",
  "LISTO_PARA_ENTREGA",
  "ENTREGADO",
] as const;
export type Estado = (typeof ESTADOS)[number];

export const TIPOS_DOCUMENTO = [
  "CARNET_CONDUCIR_FRENTE",
  "CARNET_CONDUCIR_DORSO",
  "POLIZA_SEGURO",
  "CARTA_FRANQUICIA",
  "TARJETA_AZUL_FRENTE",
  "TARJETA_AZUL_DORSO",
  "DNI_FRENTE",
  "DNI_DORSO",
  "OTRO",
] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const METODOS_PAGO = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA_DEBITO",
  "TARJETA_CREDITO",
  "CHEQUE",
] as const;

// Qué estados se pueden alcanzar desde cada uno
export const TRANSICIONES: Record<Estado, readonly Estado[]> = {
  INGRESADO: ["ESPERANDO_PAPELES_SEGURO"],
  ESPERANDO_PAPELES_SEGURO: ["EN_REPARACION"],
  EN_REPARACION: ["ESPERANDO_REPUESTOS", "CONTROL_CALIDAD"],
  ESPERANDO_REPUESTOS: ["EN_REPARACION"],
  CONTROL_CALIDAD: ["EN_REPARACION", "LISTO_PARA_ENTREGA"],
  LISTO_PARA_ENTREGA: ["ENTREGADO"],
  ENTREGADO: [],
};

// Lo mínimo que hace falta saber de un siniestro para conocer su camino en el taller
export interface Flujo {
  tipoTrabajo: TipoTrabajo;
  etapaGestionId: number | null;
}

// Un trabajo particular no espera papeles del seguro: pasa de INGRESADO directo a EN_REPARACION.
// Un trabajo por aseguradora con etapas de gestión tampoco: la espera de papeles ya se gestiona en
// las etapas, y de INGRESADO pasa a EN_REPARACION cuando la gestión llega a "Espera de turno".
// (Los siniestros anteriores a las etapas, sin etapa, siguen el camino original.)
export function transicionesDe(f: Flujo, estado: Estado): readonly Estado[] {
  if (estado === "INGRESADO" && (f.tipoTrabajo === "PARTICULAR" || f.etapaGestionId !== null)) {
    return ["EN_REPARACION"];
  }
  return TRANSICIONES[estado];
}

// Textos que ve el cliente en su portal
export const ETIQUETA_ESTADO: Record<Estado, string> = {
  INGRESADO: "Ingresó al taller",
  ESPERANDO_PAPELES_SEGURO: "Esperando papeles / autorización del seguro",
  EN_REPARACION: "En reparación",
  ESPERANDO_REPUESTOS: "Esperando repuestos",
  CONTROL_CALIDAD: "Control de calidad",
  LISTO_PARA_ENTREGA: "Listo para retirar",
  ENTREGADO: "Entregado",
};

const DOCUMENTOS_BASE: TipoDocumento[] = [
  "CARNET_CONDUCIR_FRENTE",
  "CARNET_CONDUCIR_DORSO",
  "POLIZA_SEGURO",
  "TARJETA_AZUL_FRENTE",
  "TARJETA_AZUL_DORSO",
  "DNI_FRENTE",
  "DNI_DORSO",
];

// Un trabajo particular pide solo lo que hace falta para identificar al cliente y al auto
const DOCUMENTOS_PARTICULAR: TipoDocumento[] = [
  "CARNET_CONDUCIR_FRENTE",
  "CARNET_CONDUCIR_DORSO",
  "TARJETA_AZUL_FRENTE",
  "TARJETA_AZUL_DORSO",
];

// Checklist obligatorio según el tipo de trabajo y la cobertura. Si la carta de
// franquicia también debe pedirse en TODO_RIESGO sin franquicia, se cambia solo acá.
export function documentosObligatorios(tipo: TipoTrabajo, cobertura: TipoCobertura | null): TipoDocumento[] {
  if (tipo === "PARTICULAR") return [...DOCUMENTOS_PARTICULAR];
  return cobertura === "TODO_RIESGO_FRANQUICIA"
    ? [...DOCUMENTOS_BASE, "CARTA_FRANQUICIA"]
    : [...DOCUMENTOS_BASE];
}
