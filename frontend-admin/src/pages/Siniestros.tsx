import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../api";
import { fecha } from "../format";
import { ESTADOS, ESTADO_LABEL, TRABAJO_LABEL, tipoResumen } from "../labels";
import type { Estado, SiniestroFila, TipoTrabajo } from "../types";
import { Cargando, EstadoBadge } from "../ui";

interface Lista {
  total: number;
  pagina: number;
  porPagina: number;
  siniestros: SiniestroFila[];
}

// Los filtros viven en la URL: se pueden compartir y el botón “atrás” funciona
export default function Siniestros() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const estado = params.get("estado") ?? "";
  const activos = params.get("activos") === "true";
  const sucursalId = params.get("sucursalId") ?? "";
  const tipoTrabajo = params.get("tipoTrabajo") ?? "";
  const pagina = Number(params.get("pagina") ?? "1") || 1;

  const query = new URLSearchParams();
  if (q.trim()) query.set("q", q.trim());
  if (estado) query.set("estado", estado);
  if (activos && !estado) query.set("activos", "true");
  if (sucursalId) query.set("sucursalId", sucursalId);
  if (tipoTrabajo) query.set("tipoTrabajo", tipoTrabajo);
  query.set("pagina", String(pagina));

  const { data, error, loading } = useApi<Lista>(`/siniestros?${query.toString()}`);

  function cambiar(cambios: Record<string, string | null>) {
    const nuevo = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) nuevo.set(k, v);
      else nuevo.delete(k);
    }
    if (!("pagina" in cambios)) nuevo.delete("pagina");
    setParams(nuevo, { replace: true });
  }

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <>
      <h1>Siniestros</h1>
      <div className="tarjeta">
        <div className="fila">
          <input
            style={{ flex: 1, minWidth: 220 }}
            placeholder="N° de siniestro, patente, DNI o apellido"
            value={q}
            onChange={(e) => cambiar({ q: e.target.value })}
          />
          <select style={{ width: "auto" }} value={tipoTrabajo} onChange={(e) => cambiar({ tipoTrabajo: e.target.value })}>
            <option value="">Particulares y seguros</option>
            {(Object.keys(TRABAJO_LABEL) as TipoTrabajo[]).map((t) => (
              <option key={t} value={t}>
                {TRABAJO_LABEL[t]}
              </option>
            ))}
          </select>
          <select style={{ width: "auto" }} value={estado} onChange={(e) => cambiar({ estado: e.target.value })}>
            <option value="">Todos los estados</option>
            {ESTADOS.map((e: Estado) => (
              <option key={e} value={e}>
                {ESTADO_LABEL[e]}
              </option>
            ))}
          </select>
          <label className="fila chico" style={{ gap: "0.35rem" }}>
            <input
              type="checkbox"
              checked={activos}
              onChange={(e) => cambiar({ activos: e.target.checked ? "true" : null })}
            />
            Solo abiertos
          </label>
        </div>
      </div>

      <Cargando error={error} loading={loading && !data} />
      {data && (
        <div className="tarjeta">
          {data.siniestros.length === 0 ? (
            <p className="suave">No hay siniestros con esos filtros.</p>
          ) : (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Patente</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Sucursal</th>
                    <th>Ingreso</th>
                    <th>Docs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.siniestros.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link to={`/siniestros/${s.id}`}>{s.numeroSiniestro}</Link>
                      </td>
                      <td>
                        <b>{s.auto.patente}</b>
                        <div className="suave chico">
                          {s.auto.marca} {s.auto.modelo}
                        </div>
                      </td>
                      <td>
                        {s.auto.cliente && (
                          <Link to={`/clientes/${s.auto.cliente.id}`}>
                            {s.auto.cliente.apellido}, {s.auto.cliente.nombre}
                          </Link>
                        )}
                      </td>
                      <td>
                        {tipoResumen(s)}
                        {s.aseguradora && <div className="suave chico">{s.aseguradora}</div>}
                      </td>
                      <td>
                        <EstadoBadge estado={s.estado} />
                        {s.etapaGestion && s.estado === "INGRESADO" && (
                          <div className="suave chico">{s.etapaGestion.nombre}</div>
                        )}
                      </td>
                      <td>{s.sucursal.nombre}</td>
                      <td>{fecha(s.fechaIngreso)}</td>
                      <td>
                        {s.documentosFaltantes ? (
                          <span className="badge pendiente">Faltan {s.documentosFaltantes}</span>
                        ) : (
                          <span className="badge cargado">Completos</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="fila entre" style={{ marginTop: "0.75rem" }}>
            <span className="suave chico">
              {data.total} siniestro{data.total === 1 ? "" : "s"}
            </span>
            {totalPaginas > 1 && (
              <div className="fila">
                <button
                  className="btn sec chico"
                  disabled={pagina <= 1}
                  onClick={() => cambiar({ pagina: String(pagina - 1) })}
                >
                  ← Anterior
                </button>
                <span className="chico">
                  {pagina} / {totalPaginas}
                </span>
                <button
                  className="btn sec chico"
                  disabled={pagina >= totalPaginas}
                  onClick={() => cambiar({ pagina: String(pagina + 1) })}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
