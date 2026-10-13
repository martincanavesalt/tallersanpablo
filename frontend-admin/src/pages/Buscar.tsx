import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, mensajeDeError } from "../api";
import { usePuede } from "../auth";
import type { BuscarResp } from "../types";
import { Mensaje } from "../ui";

export default function Buscar() {
  const gestiona = usePuede("gestionarClientes");
  const creaSiniestros = usePuede("gestionarSiniestros");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<BuscarResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  // Busca mientras se escribe, con una pequeña espera para no saturar la API
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setRes(null);
      setError(null);
      return;
    }
    let vigente = true;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await api<BuscarResp>("GET", `/buscar?q=${encodeURIComponent(t)}`);
        if (vigente) {
          setRes(r);
          setError(null);
        }
      } catch (e) {
        if (vigente) setError(mensajeDeError(e));
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [q]);

  const soloDigitos = q.replace(/\D/g, "");
  const pareceDni = soloDigitos.length >= 6 && /^[\d.\s]+$/.test(q.trim());
  const sinResultados = res !== null && res.clientes.length === 0 && res.autos.length === 0;

  return (
    <>
      <h1>Buscar cliente o patente</h1>
      <div className="tarjeta">
        <div className="fila">
          <input
            style={{ flex: 1, minWidth: 240 }}
            placeholder="DNI, patente o apellido"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          {gestiona && (
            <Link className="btn sec" to="/clientes/nuevo">
              + Cliente nuevo
            </Link>
          )}
        </div>
        {buscando && <p className="suave chico">Buscando…</p>}
        {error && <Mensaje tipo="error">{error}</Mensaje>}
      </div>

      {sinResultados && (
        <div className="tarjeta">
          <p>No se encontró nada para “{q.trim()}”.</p>
          {gestiona && (
          <Link
            className="btn"
            to={pareceDni ? `/clientes/nuevo?dni=${encodeURIComponent(soloDigitos)}` : "/clientes/nuevo"}
          >
            {pareceDni ? `Crear cliente con DNI ${soloDigitos}` : "Crear cliente nuevo"}
          </Link>
          )}
        </div>
      )}

      {res && res.autos.length > 0 && (
        <div className="tarjeta">
          <h2>Autos</h2>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Patente</th>
                  <th>Vehículo</th>
                  <th>Titular</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {res.autos.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <b>{a.patente}</b>
                    </td>
                    <td>
                      {a.marca} {a.modelo}
                    </td>
                    <td>
                      <Link to={`/clientes/${a.cliente.id}`}>
                        {a.cliente.apellido}, {a.cliente.nombre}
                      </Link>{" "}
                      <span className="suave chico">DNI {a.cliente.dni}</span>
                    </td>
                    <td className="derecha">
                      {creaSiniestros && (
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
        </div>
      )}

      {res && res.clientes.length > 0 && (
        <div className="tarjeta">
          <h2>Clientes</h2>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>DNI</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Autos</th>
                </tr>
              </thead>
              <tbody>
                {res.clientes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.dni}</td>
                    <td>
                      <Link to={`/clientes/${c.id}`}>
                        {c.apellido}, {c.nombre}
                      </Link>
                    </td>
                    <td>{c.telefono ?? "—"}</td>
                    <td>{c._count.autos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
