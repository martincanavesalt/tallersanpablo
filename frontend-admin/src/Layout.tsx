import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import logo from "./assets/logo.png";
import { useAuth, usePuede } from "./auth";
import { ROL_LABEL } from "./labels";

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icono"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const iBuscar = (
  <Icono>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icono>
);
const iSiniestros = (
  <Icono>
    <path d="M5 16v-4l1.6-4.2A2 2 0 0 1 8.5 6.5h7a2 2 0 0 1 1.9 1.3L19 12v4" />
    <path d="M3.5 12h17M5 16h14v2.5H5z" />
    <circle cx="8" cy="14" r=".6" />
    <circle cx="16" cy="14" r=".6" />
  </Icono>
);
const iGestion = (
  <Icono>
    <rect x="4" y="5" width="4.5" height="14" rx="1" />
    <rect x="10" y="5" width="4.5" height="9" rx="1" />
    <rect x="16" y="5" width="4" height="11.5" rx="1" />
  </Icono>
);
const iDashboard = (
  <Icono>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </Icono>
);
const iPersonal = (
  <Icono>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19c.4-3 2.6-4.6 5.5-4.6s5.1 1.6 5.5 4.6" />
    <path d="M16 6a3 3 0 0 1 0 5.5M17.5 14.6c1.8.5 2.8 2 3 4.4" />
  </Icono>
);

export default function Layout() {
  const { usuario, logout } = useAuth();
  const veGestion = usePuede("gestionarEtapas");
  const clase = ({ isActive }: { isActive: boolean }) => (isActive ? "activo" : undefined);

  return (
    <div className="app">
      <aside className="lateral">
        <div className="lateral-marca">
          <img src={logo} alt="" />
          <div>
            <b>Taller San Pablo</b>
            <span>Panel de gestión</span>
          </div>
        </div>

        <nav className="lateral-nav" aria-label="Secciones">
          <NavLink to="/" end className={clase}>
            {iBuscar}
            Buscar
          </NavLink>
          {veGestion && (
            <NavLink to="/gestion" className={clase}>
              {iGestion}
              Gestión
            </NavLink>
          )}
          <NavLink to="/siniestros" className={clase}>
            {iSiniestros}
            Siniestros
          </NavLink>
          <NavLink to="/dashboard" className={clase}>
            {iDashboard}
            Dashboard
          </NavLink>
          {usuario?.rol === "ADMIN" && (
            <NavLink to="/personal" className={clase}>
              {iPersonal}
              Personal
            </NavLink>
          )}
        </nav>

        <div className="lateral-usuario">
          <div className="quien">
            <b>{usuario?.nombre}</b>
            <span>
              {usuario && ROL_LABEL[usuario.rol]}
              {usuario && usuario.rol !== "ADMIN" && ` · ${usuario.sucursal}`}
            </span>
          </div>
          <div className="acciones">
            <NavLink to="/mi-clave" className={clase}>
              Mi clave
            </NavLink>
            <button onClick={logout}>Salir</button>
          </div>
        </div>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
