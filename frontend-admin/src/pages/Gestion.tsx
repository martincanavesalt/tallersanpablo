import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api, mensajeDeError, useApi } from "../api";
import { fecha } from "../format";
import { COBERTURA_LABEL, TIPO_DOC_LABEL } from "../labels";
import type { TableroResp, TipoDocumento } from "../types";
import { Cargando, Mensaje } from "../ui";

// Tablero del tramitador: cada siniestro por aseguradora en su etapa; se mueve con el selector de la tarjeta
export default function Gestion() {
  const { data, error, loading, reload } = useApi<TableroResp>("/gestion/tablero");
  const [aviso, setAviso] = useState<{ texto: string; lista?: string[] } | null>(null);
  const [moviendo, setMoviendo] = useState<number | null>(null);

  async function mover(siniestroId: number, etapaId: number) {
    setAviso(null);
    setMoviendo(siniestroId);
    try {
      await api("PATCH", `/siniestros/${siniestroId}/etapa`, { etapaId });
      reload();
    } catch (e) {
      const faltan = e instanceof ApiError ? (e.detalles?.faltan as TipoDocumento[] | undefined) : undefined;
      setAviso({ texto: mensajeDeError(e), lista: faltan?.map((t) => TIPO_DOC_LABEL[t]) });
    } finally {
      setMoviendo(null);
    }
  }

  return (
    <>
      <h1>Gestión con aseguradoras</h1>
      <p className="suave" style={{ marginTop: "-0.5rem" }}>
        Cada tarjeta es un siniestro. Movelo de etapa hasta llegar a <b>Espera de turno</b>.
      </p>
      <Cargando error={error} loading={loading && !data} />
      {aviso && (
        <Mensaje tipo="error">
          {aviso.texto}
          {aviso.lista && (
            <ul>
              {aviso.lista.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </Mensaje>
      )}
      {data && (
        <div className="tablero">
          {data.etapas.map((e) => {
            const tarjetas = data.siniestros.filter((s) => s.etapaGestionId === e.id);
            return (
              <section key={e.id} className={`columna${e.esMeta ? " meta" : ""}`} aria-label={e.nombre}>
                <h3>
                  {e.nombre}
                  <span className="cuenta">{tarjetas.length}</span>
                </h3>
                {tarjetas.length === 0 && <p className="suave chico">Sin siniestros</p>}
                {tarjetas.map((s) => (
                  <article key={s.id} className="ficha-mini">
                    <div className="fila entre">
                      <Link to={`/siniestros/${s.id}`}>
                        <b>{s.auto.patente}</b>
                      </Link>
                      <span className="suave chico">{fecha(s.fechaIngreso)}</span>
                    </div>
                    <div className="chico">
                      {s.auto.cliente.apellido}, {s.auto.cliente.nombre}
                    </div>
                    <div className="suave chico">
                      {s.aseguradora ?? "—"}
                      {s.tipoCobertura && ` · ${COBERTURA_LABEL[s.tipoCobertura]}`}
                    </div>
                    {s.documentosFaltantes > 0 && (
                      <div className="chico" style={{ color: "var(--aviso)" }}>
                        Faltan {s.documentosFaltantes} documento{s.documentosFaltantes === 1 ? "" : "s"}
                      </div>
                    )}
                    {s.tipoCobertura === "TODO_RIESGO_FRANQUICIA" && !s.franquiciaResuelta && (
                      <div className="chico" style={{ color: "var(--aviso)" }}>
                        Franquicia sin resolver
                      </div>
                    )}
                    {s.siguientes.length > 0 && (
                      <select
                        aria-label={`Mover ${s.auto.patente} a otra etapa`}
                        value=""
                        disabled={moviendo === s.id}
                        onChange={(ev) => ev.target.value && mover(s.id, Number(ev.target.value))}
                      >
                        <option value="">Mover a…</option>
                        {s.siguientes.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nombre}
                          </option>
                        ))}
                      </select>
                    )}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
