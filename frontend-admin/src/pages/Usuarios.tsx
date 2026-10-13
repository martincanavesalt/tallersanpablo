import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { api, mensajeDeError, useApi } from "../api";
import { useAuth } from "../auth";
import { ROLES_PERSONAL, ROL_LABEL } from "../labels";
import type { Empleado, RolPersonal, SucursalMini } from "../types";
import { Campo, Cargando, Mensaje } from "../ui";

interface Form {
  id: number | null;
  nombre: string;
  email: string;
  rol: RolPersonal;
  sucursalId: string;
  password: string;
}

const VACIO: Form = { id: null, nombre: "", email: "", rol: "TALLERISTA", sucursalId: "", password: "" };

// Clave provisoria legible, sin caracteres que se confundan (0/O, 1/l/I)
function generarClave(): string {
  const letras = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => letras[b % letras.length]).join("");
}

export default function Usuarios() {
  const { usuario } = useAuth();
  const lista = useApi<Empleado[]>("/usuarios");
  const sucursales = useApi<SucursalMini[]>("/sucursales");
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [fSucursal, setFSucursal] = useState("");
  const [fRol, setFRol] = useState("");
  const [verBajas, setVerBajas] = useState(false);

  if (usuario?.rol !== "ADMIN") return <Navigate to="/" replace />;

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const filas = (lista.data ?? []).filter(
    (u) =>
      (verBajas || u.activo) &&
      (!fSucursal || String(u.sucursalId) === fSucursal) &&
      (!fRol || u.rol === fRol),
  );

  function nuevo() {
    setError(null);
    setOk(null);
    setForm({ ...VACIO, sucursalId: sucursales.data?.[0] ? String(sucursales.data[0].id) : "" });
  }

  function editar(u: Empleado) {
    setError(null);
    setOk(null);
    setForm({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      // el rol anterior (EMPLEADO) se muestra como Encargado: al guardar queda migrado
      rol: (u.rol === "EMPLEADO" ? "ENCARGADO" : u.rol) as RolPersonal,
      sucursalId: String(u.sucursalId),
      password: "",
    });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setOk(null);
    if (!form.sucursalId) return setError("Elegí la sucursal");
    if (form.id === null && form.password.length < 8) return setError("La clave debe tener al menos 8 caracteres");
    if (form.id !== null && form.password && form.password.length < 8) {
      return setError("La clave nueva debe tener al menos 8 caracteres");
    }
    setEnviando(true);
    try {
      const base = {
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        rol: form.rol,
        sucursalId: Number(form.sucursalId),
        ...(form.password ? { password: form.password } : {}),
      };
      if (form.id === null) await api("POST", "/usuarios", base);
      else await api("PATCH", `/usuarios/${form.id}`, base);
      setOk(
        form.password
          ? `Guardado. Clave ${form.id === null ? "inicial" : "nueva"} de ${form.nombre.trim()}: ${form.password} (anotala ahora: después no se puede ver).`
          : "Cambios guardados.",
      );
      setForm(null);
      lista.reload();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarActivo(u: Empleado) {
    const accion = u.activo ? "dar de baja" : "reactivar";
    const aviso = u.activo ? " No va a poder ingresar al sistema, pero su historial se conserva." : "";
    if (!window.confirm(`¿Querés ${accion} a ${u.nombre}?${aviso}`)) return;
    setError(null);
    setOk(null);
    try {
      await api("PATCH", `/usuarios/${u.id}`, { activo: !u.activo });
      lista.reload();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  return (
    <>
      <div className="fila entre">
        <h1>Personal</h1>
        {!form && (
          <button className="btn" onClick={nuevo}>
            + Nuevo empleado
          </button>
        )}
      </div>
      <p className="suave chico" style={{ marginTop: "-0.5rem" }}>
        Administrativos, talleristas y encargados de taller. Cada uno ve y trabaja solo en su sucursal.
      </p>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {ok && <Mensaje tipo="ok">{ok}</Mensaje>}

      {form && (
        <form className="tarjeta" onSubmit={guardar}>
          <h2>{form.id === null ? "Nuevo empleado" : "Editar empleado"}</h2>
          <div className="grilla">
            <Campo etiqueta="Nombre y apellido *">
              <input value={form.nombre} onChange={set("nombre")} required minLength={2} autoFocus />
            </Campo>
            <Campo etiqueta="Email (para ingresar) *">
              <input type="email" value={form.email} onChange={set("email")} required />
            </Campo>
            <Campo etiqueta="Puesto *">
              <select value={form.rol} onChange={set("rol")}>
                {ROLES_PERSONAL.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABEL[r]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Sucursal *">
              <select value={form.sucursalId} onChange={set("sucursalId")} required>
                <option value="">Elegir…</option>
                {sucursales.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta={form.id === null ? "Clave inicial * (mínimo 8)" : "Clave nueva (dejar vacío para no cambiarla)"}>
              <div className="fila" style={{ flexWrap: "nowrap" }}>
                <input
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="off"
                  required={form.id === null}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn sec chico"
                  onClick={() => setForm((f) => (f ? { ...f, password: generarClave() } : f))}
                >
                  Generar
                </button>
              </div>
            </Campo>
          </div>
          {form.id !== null && (
            <p className="suave chico">
              Si cambiás la sucursal, desde el próximo ingreso o recarga la persona pasa a ver los siniestros de la nueva sucursal.
            </p>
          )}
          <div className="fila">
            <button className="btn" disabled={enviando}>
              {enviando ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="btn sec" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="tarjeta">
        <div className="fila">
          <select value={fSucursal} onChange={(e) => setFSucursal(e.target.value)} style={{ width: "auto" }}>
            <option value="">Todas las sucursales</option>
            {sucursales.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          <select value={fRol} onChange={(e) => setFRol(e.target.value)} style={{ width: "auto" }}>
            <option value="">Todos los puestos</option>
            {ROLES_PERSONAL.map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
              </option>
            ))}
          </select>
          <label className="fila chico" style={{ gap: "0.35rem" }}>
            <input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
            Ver dados de baja
          </label>
        </div>

        <Cargando error={lista.error} loading={lista.loading && !lista.data} />
        {lista.data && filas.length === 0 && <p className="suave">No hay empleados con esos filtros.</p>}
        {filas.length > 0 && (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Puesto</th>
                  <th>Sucursal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filas.map((u) => (
                  <tr key={u.id} style={u.activo ? undefined : { opacity: 0.55 }}>
                    <td>
                      {u.nombre}
                      {!u.activo && <span className="suave chico"> (de baja)</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>{ROL_LABEL[u.rol]}</td>
                    <td>{u.sucursal.nombre}</td>
                    <td className="derecha">
                      <div className="fila" style={{ justifyContent: "flex-end" }}>
                        <button className="btn sec chico" onClick={() => editar(u)}>
                          Editar
                        </button>
                        <button className={`btn chico ${u.activo ? "peligro" : "sec"}`} onClick={() => cambiarActivo(u)}>
                          {u.activo ? "Dar de baja" : "Reactivar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
