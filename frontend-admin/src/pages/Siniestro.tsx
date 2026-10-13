import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api, mensajeDeError, useApi } from "../api";
import { dinero, fecha, fechaHora } from "../format";
import { usePuede } from "../auth";
import { COBERTURA_LABEL, COMBUSTIBLE_LABEL, ESTADOS, ESTADO_LABEL, TIPO_DOC_LABEL, TRABAJO_LABEL } from "../labels";
import type { DocumentoFila, Estado, SiniestroDetalle, TipoDocumento } from "../types";
import { Cargando, EstadoBadge, Mensaje } from "../ui";

const MAX_MB = 10;

interface Aviso {
  tipo: "error" | "ok";
  texto: string;
  lista?: string[];
}

export default function Siniestro() {
  const { id } = useParams();
  const { data: s, error, loading, reload } = useApi<SiniestroDetalle>(`/siniestros/${id}`);
  const [comentario, setComentario] = useState("");
  const [comentarioEtapa, setComentarioEtapa] = useState("");
  const puedeEtapas = usePuede("gestionarEtapas");
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const puedeSubirObligatorios = usePuede("subirDocumentosObligatorios");
  const puedeQuitarObligatorios = usePuede("quitarDocumentosObligatorios");

  async function cambiarEstado(estado: Estado) {
    setAviso(null);
    setOcupado(true);
    try {
      await api("PATCH", `/siniestros/${id}/estado`, {
        estado,
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      });
      setComentario("");
      reload();
    } catch (e) {
      const faltan = e instanceof ApiError ? (e.detalles?.faltan as TipoDocumento[] | undefined) : undefined;
      setAviso({
        tipo: "error",
        texto: mensajeDeError(e),
        lista: faltan?.map((t) => TIPO_DOC_LABEL[t]),
      });
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarEtapa(etapaId: number) {
    setAviso(null);
    setOcupado(true);
    try {
      await api("PATCH", `/siniestros/${id}/etapa`, {
        etapaId,
        ...(comentarioEtapa.trim() ? { comentario: comentarioEtapa.trim() } : {}),
      });
      setComentarioEtapa("");
      reload();
    } catch (e) {
      const faltan = e instanceof ApiError ? (e.detalles?.faltan as TipoDocumento[] | undefined) : undefined;
      setAviso({ tipo: "error", texto: mensajeDeError(e), lista: faltan?.map((t) => TIPO_DOC_LABEL[t]) });
    } finally {
      setOcupado(false);
    }
  }

  async function marcarFranquicia(resuelta: boolean) {
    setAviso(null);
    setOcupado(true);
    try {
      await api("PATCH", `/siniestros/${id}`, { franquiciaResuelta: resuelta });
      reload();
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado(false);
    }
  }

  async function subir(tipo: TipoDocumento, archivo: File) {
    setAviso(null);
    if (archivo.size > MAX_MB * 1024 * 1024) {
      setAviso({ tipo: "error", texto: `El archivo supera los ${MAX_MB} MB` });
      return;
    }
    if (!["image/jpeg", "application/pdf"].includes(archivo.type)) {
      setAviso({ tipo: "error", texto: "Solo se aceptan archivos JPG o PDF" });
      return;
    }
    setOcupado(true);
    try {
      const fd = new FormData();
      fd.append("tipoDocumento", tipo); // los campos de texto van antes que el archivo
      fd.append("archivo", archivo);
      await api("POST", `/siniestros/${id}/documentos`, fd);
      reload();
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado(false);
    }
  }

  async function ver(doc: DocumentoFila) {
    // Se abre la pestaña antes del pedido para que el navegador no la bloquee
    const ventana = window.open("", "_blank");
    try {
      const r = await api<{ url: string }>("GET", `/documentos/${doc.id}/url`);
      if (ventana) ventana.location.href = r.url;
    } catch (e) {
      ventana?.close();
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    }
  }

  async function quitar(doc: DocumentoFila) {
    const nombre = TIPO_DOC_LABEL[doc.tipoDocumento];
    if (!window.confirm(`¿Quitar el archivo de “${nombre}”?`)) return;
    setAviso(null);
    setOcupado(true);
    try {
      await api("DELETE", `/documentos/${doc.id}`);
      reload();
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado(false);
    }
  }

  if (!s) return <Cargando error={error} loading={loading} />;

  const obligatorios = s.documentos.filter((d) => d.tipoDocumento !== "OTRO");
  const otros = s.documentos.filter((d) => d.tipoDocumento === "OTRO");
  const cargados = obligatorios.filter((d) => d.cargado).length;
  const siguientes = s.transicionesPermitidas; // la API ya filtra por el puesto de quien mira
  const particular = s.tipoTrabajo === "PARTICULAR";
  // Un trabajo particular no pasa por "esperando papeles del seguro"
  const enGestion = s.etapaGestion !== null;
  const gestionPendiente = enGestion && !s.etapaGestion!.esMeta && s.estado === "INGRESADO";
  const idxEtapa = s.etapasGestion.findIndex((e) => e.id === s.etapaGestionId);
  const pasos = particular || enGestion ? ESTADOS.filter((e) => e !== "ESPERANDO_PAPELES_SEGURO") : ESTADOS;
  const indiceActual = pasos.indexOf(s.estado);
  const cli = s.auto.cliente;

  return (
    <>
      <div className="fila entre">
        <h1>Siniestro {s.numeroSiniestro}</h1>
        <EstadoBadge estado={s.estado} />
      </div>

      <div className="tarjeta">
        <div className="grilla">
          <div>
            <div className="suave chico">Vehículo</div>
            <b>{s.auto.patente}</b> · {s.auto.marca} {s.auto.modelo}
          </div>
          <div>
            <div className="suave chico">Cliente</div>
            <Link to={`/clientes/${cli.id}`}>
              {cli.apellido}, {cli.nombre}
            </Link>{" "}
            <span className="suave chico">DNI {cli.dni}</span>
            {cli.telefono && <div className="chico">{cli.telefono}</div>}
          </div>
          <div>
            <div className="suave chico">Tipo de trabajo</div>
            {TRABAJO_LABEL[s.tipoTrabajo]}
            {s.tipoCobertura && <div className="chico">{COBERTURA_LABEL[s.tipoCobertura]}</div>}
            {s.montoFranquicia !== null && <div className="chico">Franquicia {dinero(s.montoFranquicia)}</div>}
          </div>
          {s.aseguradora && (
            <div>
              <div className="suave chico">Compañía</div>
              {s.aseguradora}
              {s.numeroPoliza && <div className="chico">Póliza {s.numeroPoliza}</div>}
            </div>
          )}
          {s.aseguradoraTercero && (
            <div>
              <div className="suave chico">Compañía del tercero</div>
              {s.aseguradoraTercero}
              {s.reclamoTercero && <div className="chico">Reclamo {s.reclamoTercero}</div>}
            </div>
          )}
          {!s.aseguradoraTercero && s.reclamoTercero && (
            <div>
              <div className="suave chico">Reclamo ante el tercero</div>
              {s.reclamoTercero}
            </div>
          )}
          {s.fechaHecho && (
            <div>
              <div className="suave chico">Fecha del hecho</div>
              {fecha(s.fechaHecho)}
            </div>
          )}
          <div>
            <div className="suave chico">Sucursal</div>
            {s.sucursal.nombre}
          </div>
          <div>
            <div className="suave chico">Ingreso</div>
            {fecha(s.fechaIngreso)}
          </div>
          <div>
            <div className="suave chico">Entrega estimada</div>
            {fecha(s.fechaEstimada)}
          </div>
          {s.fechaEntrega && (
            <div>
              <div className="suave chico">Entregado</div>
              {fecha(s.fechaEntrega)}
            </div>
          )}
        </div>
        {s.relato && (
          <p style={{ marginBottom: 0 }}>
            <span className="suave chico">Hecho: </span>
            {s.relato}
          </p>
        )}
        {s.descripcion && (
          <p style={{ marginBottom: 0 }}>
            <span className="suave chico">{particular ? "Trabajo: " : "Daño: "}</span>
            {s.descripcion}
          </p>
        )}
      </div>

      {(s.kilometraje !== null || s.combustible || s.inventario || s.estadoPrevio || s.auto.chasis) && (
        <div className="tarjeta">
          <h2>Recepción del vehículo</h2>
          <div className="grilla">
            {s.kilometraje !== null && (
              <div>
                <div className="suave chico">Kilometraje</div>
                {s.kilometraje.toLocaleString("es-AR")} km
              </div>
            )}
            {s.combustible && (
              <div>
                <div className="suave chico">Combustible</div>
                {COMBUSTIBLE_LABEL[s.combustible]}
              </div>
            )}
            {s.auto.chasis && (
              <div>
                <div className="suave chico">Chasis / VIN</div>
                {s.auto.chasis}
              </div>
            )}
            {s.inventario && (
              <div>
                <div className="suave chico">Pertenencias en el auto</div>
                {s.inventario}
              </div>
            )}
            {s.estadoPrevio && (
              <div>
                <div className="suave chico">Estado previo</div>
                {s.estadoPrevio}
              </div>
            )}
          </div>
        </div>
      )}

      {aviso && (
        <Mensaje tipo={aviso.tipo}>
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

      {enGestion && (
        <div className="tarjeta">
          <h2>Gestión con la aseguradora</h2>
          <div className="pasos" style={{ ["--n" as string]: s.etapasGestion.length }}>
            {s.etapasGestion.map((e, i) => (
              <span key={e.id} className={`paso ${i < idxEtapa ? "hecho" : i === idxEtapa ? "actual" : ""}`}>
                {e.nombre}
              </span>
            ))}
          </div>
          {s.tipoCobertura === "TODO_RIESGO_FRANQUICIA" && (
            <label className="fila chico" style={{ gap: "0.4rem", marginBottom: "0.75rem" }}>
              <input
                type="checkbox"
                checked={s.franquiciaResuelta}
                disabled={ocupado || !puedeEtapas || s.estado === "ENTREGADO"}
                onChange={(e) => marcarFranquicia(e.target.checked)}
              />
              Franquicia autorizada por la otra compañía o abonada por el cliente
            </label>
          )}
          {s.etapasSiguientes.length > 0 ? (
            <>
              <input
                placeholder="Comentario (opcional, queda en la bitácora)"
                value={comentarioEtapa}
                onChange={(e) => setComentarioEtapa(e.target.value)}
                maxLength={500}
                style={{ marginBottom: "0.6rem" }}
              />
              <div className="fila">
                {s.etapasSiguientes.map((e) => (
                  <button key={e.id} className={`btn${e.esMeta ? "" : " sec"}`} disabled={ocupado} onClick={() => cambiarEtapa(e.id)}>
                    Pasar a: {e.nombre}
                  </button>
                ))}
              </div>
            </>
          ) : s.etapaGestion!.esMeta ? (
            <p className="suave">La gestión terminó: el auto espera turno.</p>
          ) : (
            <p className="suave">{puedeEtapas ? "No hay etapas siguientes." : "Tu puesto no mueve etapas de la gestión."}</p>
          )}
        </div>
      )}

      <div className="tarjeta">
        <h2>{enGestion ? "Taller" : "Estado"}</h2>
        <div className="pasos">
          {pasos.map((e, i) => (
            <span key={e} className={`paso ${i < indiceActual ? "hecho" : i === indiceActual ? "actual" : ""}`}>
              {ESTADO_LABEL[e]}
            </span>
          ))}
        </div>
        {siguientes.length > 0 ? (
          <>
            <input
              placeholder="Comentario (opcional, es interno: el cliente no lo ve)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={500}
              style={{ marginBottom: "0.6rem" }}
            />
            <div className="fila">
              {siguientes.map((e) => (
                <button key={e} className="btn" disabled={ocupado} onClick={() => cambiarEstado(e)}>
                  Pasar a: {ESTADO_LABEL[e]}
                </button>
              ))}
            </div>
            {s.estado === "INGRESADO" && s.documentosFaltantes.length > 0 && (
              <p className="suave chico">
                Para avanzar faltan {s.documentosFaltantes.length} documento
                {s.documentosFaltantes.length === 1 ? "" : "s"} obligatorio
                {s.documentosFaltantes.length === 1 ? "" : "s"}.
              </p>
            )}
          </>
        ) : s.estado === "ENTREGADO" ? (
          <p className="suave">El auto ya fue entregado.</p>
        ) : gestionPendiente ? (
          <p className="suave">El auto pasa a reparación cuando la gestión llegue a “Espera de turno”.</p>
        ) : (
          <p className="suave">Tu puesto no tiene pasos para hacer desde este estado.</p>
        )}
      </div>

      <div className="tarjeta">
        <div className="fila entre">
          <h2>Documentación obligatoria</h2>
          <span className="suave chico">
            {cargados} de {obligatorios.length} cargados · JPG o PDF, hasta {MAX_MB} MB
          </span>
        </div>
        <div className="tabla-scroll">
          <table>
            <tbody>
              {obligatorios.map((d) => (
                <FilaDoc
                  key={d.id}
                  doc={d}
                  ocupado={ocupado}
                  puedeSubir={puedeSubirObligatorios}
                  puedeQuitar={puedeQuitarObligatorios}
                  onSubir={subir}
                  onVer={ver}
                  onQuitar={quitar}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tarjeta">
        <div className="fila entre">
          <h2>Otros documentos y fotos</h2>
          <SelectorArchivo etiqueta="+ Agregar" deshabilitado={ocupado} onElegir={(f) => subir("OTRO", f)} />
        </div>
        {otros.length === 0 ? (
          <p className="suave">Fotos del daño, presupuestos, denuncia, etc. Podés agregar todos los que necesites.</p>
        ) : (
          <div className="tabla-scroll">
            <table>
              <tbody>
                {otros.map((d, i) => (
                  <FilaDoc
                    key={d.id}
                    doc={d}
                    titulo={`Documento adicional ${i + 1}`}
                    ocupado={ocupado}
                    puedeSubir
                    puedeQuitar
                    onSubir={subir}
                    onVer={ver}
                    onQuitar={quitar}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="tarjeta">
        <h2>Bitácora</h2>
        <ul className="linea-tiempo">
          {[...s.bitacora].reverse().map((h) => (
            <li key={h.id}>
              <b>{h.tipo === "ESTADO" ? ESTADO_LABEL[h.texto as Estado] : h.texto}</b>
              <span className="suave chico">
                {" "}
                · {h.tipo === "ESTADO" ? "taller" : "gestión"} · {fechaHora(h.fecha)} · {h.usuario}
              </span>
              {h.comentario && <div className="chico">{h.comentario}</div>}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function SelectorArchivo({
  etiqueta,
  deshabilitado,
  onElegir,
}: {
  etiqueta: string;
  deshabilitado: boolean;
  onElegir: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn sec chico" disabled={deshabilitado} onClick={() => ref.current?.click()}>
        {etiqueta}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // permite volver a elegir el mismo archivo
          if (f) onElegir(f);
        }}
      />
    </>
  );
}

function FilaDoc({
  doc,
  titulo,
  ocupado,
  puedeSubir,
  puedeQuitar,
  onSubir,
  onVer,
  onQuitar,
}: {
  doc: DocumentoFila;
  titulo?: string;
  ocupado: boolean;
  puedeSubir: boolean;
  puedeQuitar: boolean;
  onSubir: (tipo: TipoDocumento, f: File) => void;
  onVer: (d: DocumentoFila) => void;
  onQuitar: (d: DocumentoFila) => void;
}) {
  return (
    <tr>
      <td>
        {titulo ?? TIPO_DOC_LABEL[doc.tipoDocumento]}
        {doc.cargado && (
          <div className="suave chico">
            {doc.formato} · {fechaHora(doc.fechaCarga)}
          </div>
        )}
      </td>
      <td>
        <span className={`badge ${doc.cargado ? "cargado" : "pendiente"}`}>{doc.cargado ? "Cargado" : "Pendiente"}</span>
      </td>
      <td className="derecha">
        <div className="fila" style={{ justifyContent: "flex-end" }}>
          {doc.cargado && (
            <button className="btn sec chico" onClick={() => onVer(doc)}>
              Ver
            </button>
          )}
          {doc.tipoDocumento !== "OTRO" && puedeSubir && (
            <SelectorArchivo
              etiqueta={doc.cargado ? "Reemplazar" : "Subir"}
              deshabilitado={ocupado}
              onElegir={(f) => onSubir(doc.tipoDocumento, f)}
            />
          )}
          {doc.cargado && puedeQuitar && (
            <button className="btn peligro chico" disabled={ocupado} onClick={() => onQuitar(doc)}>
              Quitar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
