import { transicionesDe, type Estado, type Flujo } from "./constants";
import { HttpError } from "./errors";

// Roles que se pueden crear desde el ABM de personal. ADMIN se maneja aparte.
export const ROLES_PERSONAL = ["ADMINISTRATIVO", "TALLERISTA", "ENCARGADO"] as const;

export type Rol = "ADMIN" | "ADMINISTRATIVO" | "TALLERISTA" | "ENCARGADO" | "EMPLEADO";
type RolEfectivo = Exclude<Rol, "EMPLEADO">;

// EMPLEADO es el rol que existía antes de separar por puestos: conserva lo que
// podía hacer entonces, que equivale a ENCARGADO.
const efectivo = (rol: Rol): RolEfectivo => (rol === "EMPLEADO" ? "ENCARGADO" : rol);

// ─────────────────────────────────────────────────────────────────
// QUÉ PUEDE HACER CADA ROL — para cambiar un permiso se edita solo este archivo.
// ADMIN ve todas las sucursales; el resto opera únicamente en la suya
// (eso se aplica en sucursalFiltro, no depende de esta tabla).
// ─────────────────────────────────────────────────────────────────

const OFICINA: RolEfectivo[] = ["ADMIN", "ENCARGADO", "ADMINISTRATIVO"];

export const PERMISOS = {
  // Alta y edición de clientes y autos; dar acceso al portal
  gestionarClientes: OFICINA,
  // Crear siniestros y editar sus datos (cobertura, franquicia, descripción…)
  gestionarSiniestros: OFICINA,
  // Ver saldos y movimientos, cargar cargos y registrar cobros, ver lo cobrado en el dashboard
  verFinanzas: OFICINA,
  // Mover los siniestros de etapa en la gestión con la aseguradora (el tramitador)
  gestionarEtapas: OFICINA,
  // Subir o reemplazar los documentos obligatorios (el tallerista solo sube fotos "OTRO")
  subirDocumentosObligatorios: OFICINA,
  // Quitar documentos obligatorios (los "OTRO" los puede quitar cualquiera)
  quitarDocumentosObligatorios: OFICINA,
} as const satisfies Record<string, readonly RolEfectivo[]>;

export type Permiso = keyof typeof PERMISOS;

export function tiene(rol: Rol, permiso: Permiso): boolean {
  return (PERMISOS[permiso] as readonly string[]).includes(efectivo(rol));
}

export function exigir(rol: Rol, permiso: Permiso): void {
  if (!tiene(rol, permiso)) throw new HttpError(403, "Tu puesto no tiene permiso para esta acción");
}

export function permisosDe(rol: Rol): Record<Permiso, boolean> {
  return Object.fromEntries(
    (Object.keys(PERMISOS) as Permiso[]).map((p) => [p, tiene(rol, p)]),
  ) as Record<Permiso, boolean>;
}

// Cambios de estado que puede hacer cada puesto ("desde>hasta").
// El flujo válido sigue siendo el de transicionesDe() en constants.ts.
const PASOS_POR_ROL: Record<RolEfectivo, "todos" | readonly string[]> = {
  ADMIN: "todos",
  ENCARGADO: "todos", // incluye el control de calidad y la vuelta a reparación
  ADMINISTRATIVO: [
    "INGRESADO>ESPERANDO_PAPELES_SEGURO",
    "INGRESADO>EN_REPARACION", // trabajos particulares
    "ESPERANDO_PAPELES_SEGURO>EN_REPARACION",
    "LISTO_PARA_ENTREGA>ENTREGADO",
  ],
  TALLERISTA: [
    "EN_REPARACION>ESPERANDO_REPUESTOS",
    "EN_REPARACION>CONTROL_CALIDAD",
    "ESPERANDO_REPUESTOS>EN_REPARACION",
  ],
};

export function puedeTransicionar(rol: Rol, desde: Estado, hasta: Estado, flujo: Flujo): boolean {
  if (!transicionesDe(flujo, desde).includes(hasta)) return false;
  const pasos = PASOS_POR_ROL[efectivo(rol)];
  return pasos === "todos" || pasos.includes(`${desde}>${hasta}`);
}

export function transicionesPermitidas(rol: Rol, desde: Estado, flujo: Flujo): Estado[] {
  return transicionesDe(flujo, desde).filter((h) => puedeTransicionar(rol, desde, h, flujo));
}
