import { Link } from "react-router-dom";
import { useApi } from "../api";
import { dinero, fecha } from "../format";
import { ESTADOS, ESTADO_LABEL } from "../labels";
import type { DashboardSucursal } from "../types";
import { Cargando } from "../ui";

interface Resp {
  desde: string;
  sucursales: DashboardSucursal[];
}

export default function Dashboard() {
  const { data, error, loading } = useApi<Resp>("/dashboard");

  return (
    <>
      <h1>Dashboard</h1>
      <Cargando error={error} loading={loading && !data} />
      {data && (
        <>
          <p className="suave chico" style={{ marginTop: "-0.5rem" }}>
            Los datos “del mes” cuentan desde el {fecha(data.desde)}.
          </p>
          <div className="grilla" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))" }}>
            {data.sucursales.map((d) => (
              <TarjetaSucursal key={d.sucursal.id} d={d} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function TarjetaSucursal({ d }: { d: DashboardSucursal }) {
  const id = d.sucursal.id;
  return (
    <div className="tarjeta">
      <div className="fila entre">
        <h2 style={{ margin: 0 }}>{d.sucursal.nombre}</h2>
        <Link className="chico" to={`/siniestros?sucursalId=${id}&activos=true`}>
          Ver abiertos
        </Link>
      </div>

      <div style={{ margin: "0.75rem 0" }}>
        <div className="numero-grande">{d.activos}</div>
        <div className="suave chico">siniestros abiertos</div>
      </div>

      <div className="grilla" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
        {ESTADOS.map((e) => (
          <Link key={e} className="mini" to={`/siniestros?sucursalId=${id}&estado=${e}`}>
            <b>{d.porEstado[e]}</b>
            <span className="suave chico">{ESTADO_LABEL[e]}</span>
          </Link>
        ))}
      </div>

      <table style={{ marginTop: "0.75rem" }}>
        <tbody>
          <tr>
            <td>Ingresados este mes</td>
            <td className="derecha">
              <b>{d.ingresadosMes}</b>
            </td>
          </tr>
          <tr>
            <td>Entregados este mes</td>
            <td className="derecha">
              <b>{d.entregadosMes}</b>
            </td>
          </tr>
          {d.cobrosMes !== null && (
            <tr>
              <td>Cobrado este mes</td>
              <td className="derecha">
                <b>{dinero(d.cobrosMes)}</b>
              </td>
            </tr>
          )}
          <tr>
            <td>Abiertos con documentos pendientes</td>
            <td className="derecha">
              <b style={{ color: d.siniestrosConDocumentosPendientes > 0 ? "var(--aviso)" : undefined }}>
                {d.siniestrosConDocumentosPendientes}
              </b>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
