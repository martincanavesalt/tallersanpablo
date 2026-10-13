import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api, setAlVencerSesion } from "./api";
import type { Permiso, Usuario } from "./types";

interface AuthCtx {
  usuario: Usuario | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

function leerUsuario(): Usuario | null {
  try {
    const raw = localStorage.getItem("usuario");
    return raw ? (JSON.parse(raw) as Usuario) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(leerUsuario);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
    } catch {
      // sin acceso a localStorage: solo se limpia el estado
    }
    setUsuario(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; usuario: Usuario }>("POST", "/auth/login", { email, password });
    try {
      localStorage.setItem("token", r.token);
      localStorage.setItem("usuario", JSON.stringify(r.usuario));
    } catch {
      // si el navegador no deja guardar, la sesión dura hasta recargar
    }
    setUsuario(r.usuario);
  }, []);

  useEffect(() => {
    setAlVencerSesion(logout);
  }, [logout]);

  // Al abrir el panel se pide de nuevo el usuario: si le cambiaron el puesto o la sucursal, se nota enseguida
  const hayUsuario = usuario !== null;
  useEffect(() => {
    if (!hayUsuario) return;
    api<Usuario>("GET", "/auth/me")
      .then((u) => {
        try {
          localStorage.setItem("usuario", JSON.stringify(u));
        } catch {
          // sin acceso a localStorage
        }
        setUsuario(u);
      })
      .catch(() => {
        // si falla por sesión vencida, api() ya cierra la sesión; otros errores no molestan
      });
  }, [hayUsuario]);

  const valor = useMemo(() => ({ usuario, login, logout }), [usuario, login, logout]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return c;
}

export function usePuede(permiso: Permiso): boolean {
  const { usuario } = useAuth();
  return usuario?.permisos?.[permiso] ?? false;
}

export function RequireAuth() {
  const { usuario } = useAuth();
  return usuario ? <Outlet /> : <Navigate to="/login" replace />;
}
