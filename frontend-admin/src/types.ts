export type Estado =
  | "INGRESADO"
  | "ESPERANDO_PAPELES_SEGURO"
  | "EN_REPARACION"
  | "ESPERANDO_REPUESTOS"
  | "CONTROL_CALIDAD"
  | "LISTO_PARA_ENTREGA"
  | "ENTREGADO";

export type TipoTrabajo = "PARTICULAR" | "ASEGURADORA";

export type Combustible = "VACIO" | "UN_CUARTO" | "MEDIO" | "TRES_CUARTOS" | "LLENO";

export type Cobertura = "TERCERO" | "TODO_RIESGO" | "TODO_RIESGO_FRANQUICIA";

export type TipoDocumento =
  | "CARNET_CONDUCIR_FRENTE"
  | "CARNET_CONDUCIR_DORSO"
  | "POLIZA_SEGURO"
  | "CARTA_FRANQUICIA"
  | "TARJETA_AZUL_FRENTE"
  | "TARJETA_AZUL_DORSO"
  | "DNI_FRENTE"
  | "DNI_DORSO"
  | "OTRO";

export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA_DEBITO" | "TARJETA_CREDITO" | "CHEQUE";

export type Rol = "ADMIN" | "ADMINISTRATIVO" | "TALLERISTA" | "ENCARGADO" | "EMPLEADO";
export type RolPersonal = "ADMINISTRATIVO" | "TALLERISTA" | "ENCARGADO";

export type Permiso =
  | "gestionarClientes"
  | "gestionarSiniestros"
  | "gestionarEtapas"
  | "verFinanzas"
  | "subirDocumentosObligatorios"
  | "quitarDocumentosObligatorios";

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  sucursalId: number;
  sucursal: string;
  permisos: Record<Permiso, boolean>;
}

export interface Empleado {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  sucursalId: number;
  sucursal: { nombre: string };
}

export interface SucursalMini {
  id: number;
  nombre: string;
}

export interface ClienteMini {
  id: number;
  dni: string;
  nombre: string;
  apellido: string;
  telefono?: string | null;
}

export interface BuscarResp {
  clientes: (ClienteMini & { _count: { autos: number } })[];
  autos: { id: number; patente: string; marca: string; modelo: string; cliente: ClienteMini }[];
}

export interface Auto {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number | null;
  color: string | null;
  chasis?: string | null;
  clienteId: number;
}

export interface SiniestroFila {
  id: number;
  numeroSiniestro: string;
  estado: Estado;
  tipoTrabajo: TipoTrabajo;
  tipoCobertura: Cobertura | null;
  aseguradora?: string | null;
  etapaGestion?: { id: number; nombre: string } | null;
  fechaIngreso: string;
  fechaEstimada?: string | null;
  sucursal: { nombre: string };
  auto: { patente: string; marca: string; modelo: string; cliente?: ClienteMini };
  documentosFaltantes?: number;
}

export interface ClienteFicha {
  id: number;
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  tienePortal: boolean;
  autos: Auto[];
  siniestros: SiniestroFila[];
  saldo: number | null;
}

export interface Movimiento {
  id: number;
  tipoMovimiento: "DEBITO" | "CREDITO";
  monto: string;
  concepto: string;
  fecha: string;
  siniestro: { numeroSiniestro: string } | null;
}

export interface DocumentoFila {
  id: number;
  tipoDocumento: TipoDocumento;
  obligatorio: boolean;
  cargado: boolean;
  formato: "JPG" | "PDF" | null;
  fechaCarga: string | null;
}

export interface BitacoraItem {
  id: string;
  tipo: "ETAPA" | "ESTADO";
  fecha: string;
  texto: string; // nombre de la etapa, o el estado de taller
  desde: string | null;
  comentario: string | null;
  usuario: string;
}

export interface TableroResp {
  etapas: { id: number; codigo: string; nombre: string; esMeta: boolean }[];
  siniestros: {
    id: number;
    numeroSiniestro: string;
    tipoCobertura: Cobertura | null;
    aseguradora: string | null;
    etapaGestionId: number;
    franquiciaResuelta: boolean;
    fechaIngreso: string;
    documentosFaltantes: number;
    sucursal: { nombre: string };
    auto: { patente: string; marca: string; modelo: string; cliente: { id: number; nombre: string; apellido: string } };
    siguientes: { id: number; nombre: string }[];
  }[];
}

export interface SiniestroDetalle {
  id: number;
  numeroSiniestro: string;
  estado: Estado;
  tipoTrabajo: TipoTrabajo;
  tipoCobertura: Cobertura | null;
  montoFranquicia: string | null;
  aseguradora: string | null;
  numeroPoliza: string | null;
  aseguradoraTercero: string | null;
  reclamoTercero: string | null;
  fechaHecho: string | null;
  relato: string | null;
  kilometraje: number | null;
  combustible: Combustible | null;
  inventario: string | null;
  estadoPrevio: string | null;
  etapaGestionId: number | null;
  etapaGestion: { id: number; nombre: string; esMeta: boolean } | null;
  franquiciaResuelta: boolean;
  etapasGestion: { id: number; nombre: string; esMeta: boolean }[];
  etapasSiguientes: { id: number; nombre: string; esMeta: boolean; requiereDocumentos: boolean }[];
  bitacora: BitacoraItem[];
  descripcion: string | null;
  fechaIngreso: string;
  fechaEstimada: string | null;
  fechaEntrega: string | null;
  sucursal: { id: number; nombre: string };
  auto: Auto & { cliente: ClienteMini & { email: string | null } };
  documentos: DocumentoFila[];
  documentosFaltantes: TipoDocumento[];
  transicionesPermitidas: Estado[];
  historialEstados: {
    id: number;
    estadoAnterior: Estado | null;
    estadoNuevo: Estado;
    fecha: string;
    comentario: string | null;
    usuario: { nombre: string };
  }[];
}

export interface DashboardSucursal {
  sucursal: { id: number; nombre: string };
  activos: number;
  porEstado: Record<Estado, number>;
  ingresadosMes: number;
  entregadosMes: number;
  cobrosMes: number | null;
  siniestrosConDocumentosPendientes: number;
}
