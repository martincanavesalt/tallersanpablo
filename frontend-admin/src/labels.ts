import type { Cobertura, Combustible, Estado, MetodoPago, Rol, RolPersonal, TipoDocumento, TipoTrabajo } from "./types";

export const ESTADOS: Estado[] = [
  "INGRESADO",
  "ESPERANDO_PAPELES_SEGURO",
  "EN_REPARACION",
  "ESPERANDO_REPUESTOS",
  "CONTROL_CALIDAD",
  "LISTO_PARA_ENTREGA",
  "ENTREGADO",
];

export const ESTADO_LABEL: Record<Estado, string> = {
  INGRESADO: "Ingresado",
  ESPERANDO_PAPELES_SEGURO: "Esperando papeles / OK seguro",
  EN_REPARACION: "En reparación",
  ESPERANDO_REPUESTOS: "Esperando repuestos",
  CONTROL_CALIDAD: "Control de calidad",
  LISTO_PARA_ENTREGA: "Listo para entrega",
  ENTREGADO: "Entregado",
};

export const ROL_LABEL: Record<Rol, string> = {
  ADMIN: "Administrador",
  ADMINISTRATIVO: "Administrativo",
  TALLERISTA: "Tallerista",
  ENCARGADO: "Encargado de taller",
  EMPLEADO: "Empleado (rol anterior)",
};

export const ROLES_PERSONAL: RolPersonal[] = ["ADMINISTRATIVO", "TALLERISTA", "ENCARGADO"];

export const TIPO_DOC_LABEL: Record<TipoDocumento, string> = {
  CARNET_CONDUCIR_FRENTE: "Carnet de conducir (frente)",
  CARNET_CONDUCIR_DORSO: "Carnet de conducir (dorso)",
  POLIZA_SEGURO: "Póliza de seguro",
  CARTA_FRANQUICIA: "Carta de franquicia",
  TARJETA_AZUL_FRENTE: "Tarjeta azul (frente)",
  TARJETA_AZUL_DORSO: "Tarjeta azul (dorso)",
  DNI_FRENTE: "DNI (frente)",
  DNI_DORSO: "DNI (dorso)",
  OTRO: "Otro documento",
};

export const TRABAJO_LABEL: Record<TipoTrabajo, string> = {
  PARTICULAR: "Particular",
  ASEGURADORA: "Por aseguradora",
};

export const COMBUSTIBLE_LABEL: Record<Combustible, string> = {
  VACIO: "Reserva / vacío",
  UN_CUARTO: "1/4",
  MEDIO: "1/2",
  TRES_CUARTOS: "3/4",
  LLENO: "Lleno",
};

// Lo que va en las listas: "Particular" o la cobertura del seguro
export function tipoResumen(s: { tipoTrabajo: TipoTrabajo; tipoCobertura: Cobertura | null }): string {
  return s.tipoTrabajo === "PARTICULAR" || !s.tipoCobertura ? TRABAJO_LABEL.PARTICULAR : COBERTURA_LABEL[s.tipoCobertura];
}

export const COBERTURA_LABEL: Record<Cobertura, string> = {
  TERCERO: "Tercero",
  TODO_RIESGO: "Todo riesgo",
  TODO_RIESGO_FRANQUICIA: "Todo riesgo con franquicia",
};

export const METODO_LABEL: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA_DEBITO: "Tarjeta de débito",
  TARJETA_CREDITO: "Tarjeta de crédito",
  CHEQUE: "Cheque",
};
