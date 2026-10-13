import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, api, mensajeDeError } from "../api";
import { usePuede } from "../auth";
import type { ClienteMini } from "../types";
import { Campo, Mensaje } from "../ui";

export default function ClienteNuevo() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const puede = usePuede("gestionarClientes");
  const [f, setF] = useState({
    dni: params.get("dni") ?? "",
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    direccion: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [existenteId, setExistenteId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  const set = (campo: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [campo]: e.target.value }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setExistenteId(null);
    setEnviando(true);
    try {
      const c = await api<ClienteMini>("POST", "/clientes", f);
      navigate(`/clientes/${c.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.detalles?.clienteId) {
        setExistenteId(err.detalles.clienteId as number);
      }
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!puede) {
    return (
      <>
        <h1>Cliente nuevo</h1>
        <Mensaje tipo="aviso">Tu puesto no puede cargar clientes.</Mensaje>
      </>
    );
  }

  return (
    <>
      <h1>Cliente nuevo</h1>
      <form className="tarjeta" onSubmit={enviar}>
        <div className="grilla">
          <Campo etiqueta="DNI *">
            <input value={f.dni} onChange={set("dni")} inputMode="numeric" required autoFocus />
          </Campo>
          <Campo etiqueta="Nombre *">
            <input value={f.nombre} onChange={set("nombre")} required />
          </Campo>
          <Campo etiqueta="Apellido *">
            <input value={f.apellido} onChange={set("apellido")} required />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input value={f.telefono} onChange={set("telefono")} inputMode="tel" />
          </Campo>
          <Campo etiqueta="Email">
            <input type="email" value={f.email} onChange={set("email")} />
          </Campo>
          <Campo etiqueta="Dirección">
            <input value={f.direccion} onChange={set("direccion")} />
          </Campo>
        </div>
        {error && (
          <Mensaje tipo="error">
            {error}
            {existenteId && (
              <>
                {" "}
                <Link to={`/clientes/${existenteId}`}>Abrir el cliente existente</Link>
              </>
            )}
          </Mensaje>
        )}
        <div className="fila" style={{ marginTop: "1rem" }}>
          <button className="btn" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar cliente"}
          </button>
          <Link className="btn sec" to="/">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
