import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, mensajeDeError, useApi } from "../api";
import { useAuth, usePuede } from "../auth";
import { COBERTURA_LABEL, COMBUSTIBLE_LABEL } from "../labels";
import type { Auto, ClienteMini, Cobertura, Combustible, SiniestroFila, SucursalMini, TipoTrabajo } from "../types";
import { Campo, Cargando, EstadoBadge, Mensaje } from "../ui";

interface AutoConTitular extends Auto {
  cliente: ClienteMini;
  siniestros: SiniestroFila[];
}

const VACIO = {
  aseguradora: "",
  cobertura: "TODO_RIESGO" as Cobertura,
  franquicia: "",
  poliza: "",
  numero: "",
  aseguradoraTercero: "",
  reclamoTercero: "",
  fechaHecho: "",
  relato: "",
  kilometraje: "",
  combustible: "" as Combustible | "",
  chasis: "",
  inventario: "",
  estadoPrevio: "",
  descripcion: "",
  estimada: "",
  sucursalId: "",
};

// Ingreso del vehículo: primero se define cómo llega el cliente (particular o aseguradora)
export default function SiniestroNuevo() {
  const [params] = useSearchParams();
  const patente = params.get("patente");
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const esAdmin = usuario?.rol === "ADMIN";
  const puede = usePuede("gestionarSiniestros");

  const auto = useApi<AutoConTitular>(patente ? `/autos/patente/${encodeURIComponent(patente)}` : null);
  const sucursales = useApi<SucursalMini[]>(esAdmin ? "/sucursales" : null);

  const [tipo, setTipo] = useState<TipoTrabajo | null>(null);
  const [f, setF] = useState(VACIO);
  const [chasisCargado, setChasisCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof VACIO) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (!puede) {
    return (
      <>
        <h1>Nuevo ingreso</h1>
        <Mensaje tipo="aviso">Tu puesto no puede registrar ingresos.</Mensaje>
      </>
    );
  }

  if (!patente) {
    return (
      <>
        <h1>Nuevo ingreso</h1>
        <Mensaje tipo="aviso">
          Primero buscá el cliente o la patente y elegí “Nuevo ingreso” desde el auto. <Link to="/">Ir al buscador</Link>
        </Mensaje>
      </>
    );
  }

  const a = auto.data;
  const activos = a?.siniestros.filter((s) => s.estado !== "ENTREGADO") ?? [];

  // El chasis del auto, si ya estaba cargado, se completa una sola vez
  if (a?.chasis && !chasisCargado) {
    setChasisCargado(true);
    setF((x) => ({ ...x, chasis: a.chasis ?? "" }));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!a || !tipo) return;
    setError(null);

    const aseg = tipo === "ASEGURADORA";
    let monto: number | undefined;
    if (aseg && f.cobertura === "TODO_RIESGO_FRANQUICIA") {
      monto = Number(f.franquicia.replace(",", "."));
      if (!Number.isFinite(monto) || monto <= 0) {
        setError("Ingresá el monto de la franquicia");
        return;
      }
    }
    if (aseg && !f.aseguradora.trim()) {
      setError("Indicá la compañía de seguros");
      return;
    }
    if (esAdmin && !f.sucursalId) {
      setError("Elegí la sucursal");
      return;
    }
    let km: number | undefined;
    if (f.kilometraje.trim()) {
      km = Number(f.kilometraje.replace(/\D/g, ""));
      if (!Number.isFinite(km)) {
        setError("El kilometraje debe ser un número");
        return;
      }
    }

    const t = (v: string) => (v.trim() ? v.trim() : undefined);
    setEnviando(true);
    try {
      const s = await api<{ id: number }>("POST", "/siniestros", {
        autoId: a.id,
        tipoTrabajo: tipo,
        ...(aseg
          ? {
              tipoCobertura: f.cobertura,
              aseguradora: t(f.aseguradora),
              numeroPoliza: t(f.poliza),
              numeroSiniestro: t(f.numero),
              ...(monto !== undefined ? { montoFranquicia: monto } : {}),
              ...(f.cobertura === "TERCERO"
                ? { aseguradoraTercero: t(f.aseguradoraTercero), reclamoTercero: t(f.reclamoTercero) }
                : {}),
            }
          : {}),
        fechaHecho: f.fechaHecho || undefined,
        relato: t(f.relato),
        kilometraje: km,
        combustible: f.combustible || undefined,
        chasis: t(f.chasis),
        inventario: t(f.inventario),
        estadoPrevio: t(f.estadoPrevio),
        descripcion: t(f.descripcion),
        fechaEstimada: f.estimada || undefined,
        ...(esAdmin ? { sucursalId: Number(f.sucursalId) } : {}),
      });
      navigate(`/siniestros/${s.id}`, { replace: true });
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Nuevo ingreso</h1>
      <Cargando error={auto.error} loading={auto.loading} />
      {a && (
        <>
          <div className="tarjeta">
            <div className="grilla">
              <div>
                <div className="suave chico">Vehículo</div>
                <b>{a.patente}</b> · {a.marca} {a.modelo}
              </div>
              <div>
                <div className="suave chico">Titular</div>
                <Link to={`/clientes/${a.cliente.id}`}>
                  {a.cliente.apellido}, {a.cliente.nombre}
                </Link>{" "}
                <span className="suave chico">DNI {a.cliente.dni}</span>
              </div>
            </div>
          </div>

          {activos.length > 0 && (
            <Mensaje tipo="aviso">
              Este auto ya tiene {activos.length === 1 ? "un ingreso abierto" : `${activos.length} ingresos abiertos`}:{" "}
              {activos.map((s) => (
                <span key={s.id} style={{ marginRight: 8 }}>
                  <Link to={`/siniestros/${s.id}`}>{s.numeroSiniestro}</Link> <EstadoBadge estado={s.estado} />
                </span>
              ))}
            </Mensaje>
          )}

          {!tipo && (
            <div className="tarjeta">
              <h2>¿Cómo llega el cliente?</h2>
              <div className="opciones">
                <button type="button" className="opcion" onClick={() => setTipo("PARTICULAR")}>
                  <b>Particular</b>
                  <span>Paga el cliente. Sin trámite con aseguradora.</span>
                </button>
                <button type="button" className="opcion" onClick={() => setTipo("ASEGURADORA")}>
                  <b>Por aseguradora</b>
                  <span>Tercero, todo riesgo o todo riesgo con franquicia.</span>
                </button>
              </div>
            </div>
          )}

          {tipo && (
            <form onSubmit={enviar}>
              <div className="fila entre" style={{ marginBottom: "0.75rem" }}>
                <span className="badge e-INGRESADO">{tipo === "PARTICULAR" ? "Trabajo particular" : "Trabajo por aseguradora"}</span>
                <button type="button" className="btn sec chico" onClick={() => setTipo(null)}>
                  Cambiar
                </button>
              </div>

              {tipo === "ASEGURADORA" && (
                <div className="tarjeta">
                  <h2>Seguro</h2>
                  <div className="grilla">
                    <Campo etiqueta="Compañía de seguros *">
                      <input value={f.aseguradora} onChange={set("aseguradora")} required />
                    </Campo>
                    <Campo etiqueta="Tipo de cobertura *">
                      <select value={f.cobertura} onChange={set("cobertura")}>
                        {(Object.keys(COBERTURA_LABEL) as Cobertura[]).map((c) => (
                          <option key={c} value={c}>
                            {COBERTURA_LABEL[c]}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    {f.cobertura === "TODO_RIESGO_FRANQUICIA" && (
                      <Campo etiqueta="Monto de la franquicia ($) *">
                        <input value={f.franquicia} onChange={set("franquicia")} inputMode="decimal" />
                      </Campo>
                    )}
                    <Campo etiqueta="N° de póliza">
                      <input value={f.poliza} onChange={set("poliza")} />
                    </Campo>
                    <Campo etiqueta="N° de denuncia / siniestro">
                      <input value={f.numero} onChange={set("numero")} placeholder="Si lo dejás vacío, se genera uno" />
                    </Campo>
                    {f.cobertura === "TERCERO" && (
                      <>
                        <Campo etiqueta="Compañía del tercero">
                          <input value={f.aseguradoraTercero} onChange={set("aseguradoraTercero")} />
                        </Campo>
                        <Campo etiqueta="N° de reclamo ante el tercero">
                          <input value={f.reclamoTercero} onChange={set("reclamoTercero")} />
                        </Campo>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="tarjeta">
                <h2>{tipo === "ASEGURADORA" ? "El siniestro" : "El trabajo"}</h2>
                <div className="grilla">
                  {tipo === "ASEGURADORA" && (
                    <Campo etiqueta="Fecha del hecho">
                      <input type="date" value={f.fechaHecho} onChange={set("fechaHecho")} />
                    </Campo>
                  )}
                  <Campo etiqueta="Fecha estimada de entrega">
                    <input type="date" value={f.estimada} onChange={set("estimada")} />
                  </Campo>
                  {esAdmin && (
                    <Campo etiqueta="Sucursal *">
                      <select value={f.sucursalId} onChange={set("sucursalId")}>
                        <option value="">Elegir…</option>
                        {sucursales.data?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                </div>
                {tipo === "ASEGURADORA" && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <Campo etiqueta="Breve relato del hecho">
                      <textarea rows={2} value={f.relato} onChange={set("relato")} />
                    </Campo>
                  </div>
                )}
                <div style={{ marginTop: "0.75rem" }}>
                  <Campo etiqueta={tipo === "ASEGURADORA" ? "Descripción del daño" : "Qué se necesita hacer"}>
                    <textarea rows={3} value={f.descripcion} onChange={set("descripcion")} />
                  </Campo>
                </div>
              </div>

              <div className="tarjeta">
                <h2>Recepción del vehículo</h2>
                <div className="grilla">
                  <Campo etiqueta="Kilometraje">
                    <input value={f.kilometraje} onChange={set("kilometraje")} inputMode="numeric" />
                  </Campo>
                  <Campo etiqueta="Combustible">
                    <select value={f.combustible} onChange={set("combustible")}>
                      <option value="">Sin dato</option>
                      {(Object.keys(COMBUSTIBLE_LABEL) as Combustible[]).map((c) => (
                        <option key={c} value={c}>
                          {COMBUSTIBLE_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Chasis / VIN">
                    <input value={f.chasis} onChange={set("chasis")} />
                  </Campo>
                </div>
                <div className="grilla" style={{ marginTop: "0.75rem" }}>
                  <Campo etiqueta="Pertenencias que quedan en el auto">
                    <textarea rows={2} value={f.inventario} onChange={set("inventario")} />
                  </Campo>
                  <Campo etiqueta="Estado previo (rayones o golpes ajenos al trabajo)">
                    <textarea rows={2} value={f.estadoPrevio} onChange={set("estadoPrevio")} />
                  </Campo>
                </div>
                <p className="suave chico">
                  Las fotos de recepción y los documentos se cargan en la ficha, apenas se crea el ingreso.
                </p>
              </div>

              {error && <Mensaje tipo="error">{error}</Mensaje>}
              <div className="fila">
                <button className="btn" disabled={enviando}>
                  {enviando ? "Guardando…" : "Crear ingreso"}
                </button>
                <Link className="btn sec" to={`/clientes/${a.cliente.id}`}>
                  Cancelar
                </Link>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
}
