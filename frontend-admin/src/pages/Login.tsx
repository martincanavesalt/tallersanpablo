import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { mensajeDeError } from "../api";
import logo from "../assets/logo.png";
import { useAuth } from "../auth";
import { Campo, Mensaje } from "../ui";

export default function Login() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <div className="login-marca">
        <img src={logo} alt="Taller San Pablo" />
        <h1>Taller San Pablo</h1>
        <p>Siniestros, reparaciones y cuentas de cada sucursal en un solo lugar.</p>
      </div>
      <div className="login-cuerpo">
        <form onSubmit={enviar}>
          <h2>Ingresar</h2>
          <Campo etiqueta="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          </Campo>
          <Campo etiqueta="Clave">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Campo>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <button className="btn grande" disabled={enviando}>
            {enviando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
