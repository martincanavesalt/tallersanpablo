import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, mensajeDeError, useApi } from "../api";
import { usePuede } from "../auth";
import { dinero, fecha, fechaHora } from "../format";
import { METODO_LABEL, tipoResumen } from "../labels";
import type { ClienteFicha, MetodoPago, Movimiento } from "../types";
import { Campo, Cargando, EstadoBadge, Mensaje } from "../ui";

interface CuentaResp {
  saldo: number;
  movimientos: Movimiento[];
}

export default function Cliente() {
  const { id } = useParams();
  const ficha = useApi<ClienteFicha>(`/clientes/${id}`);
  const verFinanzas = usePuede("verFinanzas");
  const gestiona = usePuede("gestionarClientes");
  const creaSiniestros = usePuede("gestionarSiniestros");
  const cuenta = useApi<CuentaResp>(verFinanzas ? `/clientes/${id}/cuenta-corriente` : null);
  const c = ficha.data;

  function recargar() {
    ficha.reload();
    cuenta.reload();
  }

  return (
    <>
      <Cargando error={ficha.error} loading={ficha.loading && !c} />
      {c && (
        <>
          <div className="fila entre">
            <h1>
              {c.apellido}, {c.nombre}
            </h1>
            <span className="suave">DNI {c.dni}</span>
          </div>

          <div className="tarjeta">
            <div className="grilla">
              <div>
                <div className="suave chico">Teléfono</div>
                {c.telefono ?? "—"}
              </div>
              <div>
                <div className="suave chico">Email</div>
                {c.email ?? "—"}
              </div>
              <div>
                <div className="suave chico">Dirección</div>
                {c.direccion ?? "—"}
              </div>
              {c.saldo !== null && (
                <div>
                  <div className="suave chico">Saldo de cuenta corriente</div>
                  <b style={{ color: c.saldo > 0 ? "var(--error)" : undefined }}>{dinero(c.saldo)}</b>
                  {c.saldo > 0 && <span className="suave chico"> (debe)</span>}
                  {c.saldo < 0 && <span className="suave chico"> (a favor)</span>}
                </div>
              )}
            </div>
          </div>

          <Autos
            clienteId={c.id}
            autos={c.autos}
            onCambio={recargar}
            puedeEditar={gestiona}
            puedeSiniestros={creaSiniestros}
          />

          <div className="tarjeta">
            <h2>Siniestros</h2>
            {c.siniestros.length === 0 ? (
              <p className="suave">Todavía no tiene ingresos. Cargá uno desde el auto correspondiente.</p>
            ) : (
              <div className="tabla-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Patente</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Sucursal</th>
                      <th>Ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.siniestros.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link to={`/siniestros/${s.id}`}>{s.numeroSiniestro}</Link>
                        </td>
                        <td>{s.auto.patente}</td>
                        <td>{tipoResumen(s)}</td>
                        <td>
                          <EstadoBadge estado={s.estado} />
                        </td>
                        <td>{s.sucursal.nombre}</td>
                        <td>{fecha(s.fechaIngreso)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {verFinanzas && <CuentaCorriente clienteId={c.id} datos={cuenta.data} onCambio={recargar} />}
          {gestiona && <Portal clienteId={c.id} tienePortal={c.tienePortal} onCambio={recargar} />}
        </>
      )}
    </>
  );
}

function Autos({
  clienteId,
  autos,
  onCambio,
  puedeEditar,
  puedeSiniestros,
}: {
  clienteId: number;
  autos: ClienteFicha["autos"];
  onCambio: () => void;
  puedeEditar: boolean;
  puedeSiniestros: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ patente: "", marca: "", modelo: "", anio: "", color: "" });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api("POST", "/autos", {
        patente: f.patente,
        marca: f.marca,
        modelo: f.modelo,
        clienteId,
        ...(f.anio ? { anio: Number(f.anio) } : {}),
        ...(f.color ? { color: f.color } : {}),
      });
      setF({ patente: "", marca: "", modelo: "", anio: "", color: "" });
      setAbierto(false);
      onCambio();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta">
      <div className="fila entre">
        <h2>Autos</h2>
        {!abierto && puedeEditar && (
          <button className="btn sec chico" onClick={() => setAbierto(true)}>
            + Agregar auto
          </button>
        )}
      </div>

      {autos.length === 0 && !abierto && <p className="suave">Este cliente no tiene autos cargados.</p>}

      {autos.length > 0 && (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Patente</th>
                <th>Vehículo</th>
                <th>Año</th>
                <th>Color</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {autos.map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>{a.patente}</b>
                  </td>
                  <td>
                    {a.marca} {a.modelo}
                  </td>
                  <td>{a.anio ?? "—"}</td>
                  <td>{a.color ?? "—"}</td>
                  <td className="derecha">
                    {puedeSiniestros && (
                      <Link className="btn chico" to={`/siniestros/nuevo?patente=${a.patente}`}>
                        Nuevo ingreso
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abierto && (
        <form onSubmit={guardar} style={{ marginTop: "0.75rem" }}>
          <div className="grilla">
            <Campo etiqueta="Patente *">
              <input value={f.patente} onChange={set("patente")} placeholder="AB123CD" required autoFocus />
            </Campo>
            <Campo etiqueta="Marca *">
              <input value={f.marca} onChange={set("marca")} required />
            </Campo>
            <Campo etiqueta="Modelo *">
              <input value={f.modelo} onChange={set("modelo")} required />
            </Campo>
            <Campo etiqueta="Año">
              <input value={f.anio} onChange={set("anio")} inputMode="numeric" />
            </Campo>
            <Campo etiqueta="Color">
              <input value={f.color} onChange={set("color")} />
            </Campo>
          </div>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div className="fila" style={{ marginTop: "0.75rem" }}>
            <button className="btn" disabled={enviando}>
              Guardar auto
            </button>
            <button type="button" className="btn sec" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function CuentaCorriente({
  clienteId,
  datos,
  onCambio,
}: {
  clienteId: number;
  datos: CuentaResp | null;
  onCambio: () => void;
}) {
  const [modo, setModo] = useState<"cargo" | "cobro" | null>(null);
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("EFECTIVO");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const valor = Number(monto.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Ingresá un monto mayor a cero");
      return;
    }
    setEnviando(true);
    try {
      if (modo === "cargo") {
        await api("POST", `/clientes/${clienteId}/cargos`, { monto: valor, concepto });
      } else {
        await api("POST", `/clientes/${clienteId}/cobros`, {
          monto: valor,
          metodoPago: metodo,
          ...(concepto ? { concepto } : {}),
        });
      }
      setModo(null);
      setMonto("");
      setConcepto("");
      onCambio();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta">
      <div className="fila entre">
        <h2>Cuenta corriente</h2>
        {modo === null && (
          <div className="fila">
            <button className="btn sec chico" onClick={() => setModo("cargo")}>
              + Cargo
            </button>
            <button className="btn chico" onClick={() => setModo("cobro")}>
              + Registrar cobro
            </button>
          </div>
        )}
      </div>

      {modo && (
        <form onSubmit={guardar} style={{ marginBottom: "1rem" }}>
          <div className="grilla">
            <Campo etiqueta="Monto ($) *">
              <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" required autoFocus />
            </Campo>
            {modo === "cobro" && (
              <Campo etiqueta="Medio de pago">
                <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                  {(Object.keys(METODO_LABEL) as MetodoPago[]).map((m) => (
                    <option key={m} value={m}>
                      {METODO_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            <Campo etiqueta={modo === "cargo" ? "Concepto *" : "Concepto (opcional)"}>
              <input value={concepto} onChange={(e) => setConcepto(e.target.value)} required={modo === "cargo"} />
            </Campo>
          </div>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div className="fila" style={{ marginTop: "0.75rem" }}>
            <button className="btn" disabled={enviando}>
              {modo === "cargo" ? "Guardar cargo" : "Guardar cobro"}
            </button>
            <button type="button" className="btn sec" onClick={() => setModo(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {datos && datos.movimientos.length === 0 && <p className="suave">Sin movimientos.</p>}
      {datos && datos.movimientos.length > 0 && (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Siniestro</th>
                <th className="derecha">Monto</th>
              </tr>
            </thead>
            <tbody>
              {datos.movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{fechaHora(m.fecha)}</td>
                  <td>{m.concepto}</td>
                  <td>{m.siniestro?.numeroSiniestro ?? "—"}</td>
                  <td className="derecha" style={{ color: m.tipoMovimiento === "CREDITO" ? "var(--ok)" : undefined }}>
                    {m.tipoMovimiento === "CREDITO" ? "−" : "+"} {dinero(m.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Portal({
  clienteId,
  tienePortal,
  onCambio,
}: {
  clienteId: number;
  tienePortal: boolean;
  onCambio: () => void;
}) {
  const [clave, setClave] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function generar() {
    if (tienePortal && !window.confirm("Esto reemplaza la clave actual del cliente. ¿Continuar?")) return;
    setError(null);
    setEnviando(true);
    try {
      const r = await api<{ passwordTemporal: string }>("POST", `/clientes/${clienteId}/portal-password`);
      setClave(r.passwordTemporal);
      onCambio();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta">
      <h2>Acceso al portal del cliente</h2>
      <p className="suave chico" style={{ marginTop: 0 }}>
        El cliente entra con su DNI y esta clave para ver el estado de sus siniestros.
        {tienePortal ? " Ya tiene acceso." : " Todavía no tiene acceso."}
      </p>
      {clave && (
        <Mensaje tipo="aviso">
          Clave temporal: <span className="clave-temporal">{clave}</span>
          <br />
          Anotala o pasásela ahora: no se vuelve a mostrar.
        </Mensaje>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <button className="btn sec" onClick={generar} disabled={enviando}>
        {tienePortal ? "Generar clave nueva" : "Dar acceso al portal"}
      </button>
    </div>
  );
}
