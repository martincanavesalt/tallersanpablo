import { useState, type FormEvent } from "react";
import { api, mensajeDeError } from "../api";
import { Campo, Mensaje } from "../ui";

export default function MiClave() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setListo(false);
    if (nueva.length < 8) return setError("La clave nueva debe tener al menos 8 caracteres");
    if (nueva !== repetir) return setError("Las dos claves nuevas no coinciden");
    setEnviando(true);
    try {
      await api("POST", "/auth/cambiar-clave", { actual, nueva });
      setActual("");
      setNueva("");
      setRepetir("");
      setListo(true);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Cambiar mi clave</h1>
      <form className="tarjeta" onSubmit={enviar} style={{ maxWidth: 420 }}>
        <Campo etiqueta="Clave actual">
          <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
        </Campo>
        <Campo etiqueta="Clave nueva (mínimo 8 caracteres)">
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required />
        </Campo>
        <Campo etiqueta="Repetir clave nueva">
          <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required />
        </Campo>
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {listo && <Mensaje tipo="ok">Listo, tu clave fue cambiada.</Mensaje>}
        <button className="btn" disabled={enviando}>
          {enviando ? "Guardando…" : "Cambiar clave"}
        </button>
      </form>
    </>
  );
}
