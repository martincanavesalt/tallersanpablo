import type { ReactNode } from "react";
import { ESTADO_LABEL } from "./labels";
import type { Estado } from "./types";

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="campo">
      {etiqueta}
      {children}
    </label>
  );
}

export function EstadoBadge({ estado }: { estado: Estado }) {
  return <span className={`badge e-${estado}`}>{ESTADO_LABEL[estado]}</span>;
}

export function Mensaje({
  tipo,
  children,
}: {
  tipo: "error" | "ok" | "aviso";
  children: ReactNode;
}) {
  return <div className={`msg ${tipo}`}>{children}</div>;
}

export function Cargando({ error, loading }: { error: string | null; loading: boolean }) {
  if (error) return <Mensaje tipo="error">{error}</Mensaje>;
  if (loading) return <p className="suave">Cargando…</p>;
  return null;
}
