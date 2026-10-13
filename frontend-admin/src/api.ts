import { useCallback, useEffect, useState } from "react";

const BASE: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public detalles?: any,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

let alVencerSesion: () => void = () => {};
export function setAlVencerSesion(fn: () => void) {
  alVencerSesion = fn;
}

export async function api<T = unknown>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (cuerpo instanceof FormData) {
    body = cuerpo; // el navegador pone el content-type con su boundary
  } else if (cuerpo !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(cuerpo);
  }

  let res: Response;
  try {
    res = await fetch(BASE + ruta, { method: metodo, headers, body });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. ¿Está corriendo la API?");
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token && ruta !== "/auth/login") alVencerSesion();
    throw new ApiError(res.status, json?.error ?? `Error ${res.status}`, json?.detalles);
  }
  return json as T;
}

export function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado";
}

// Carga un GET y permite recargarlo. Con path = null no hace nada.
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let vigente = true;
    setLoading(true);
    api<T>("GET", path)
      .then((d) => {
        if (vigente) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setLoading(false);
      });
    return () => {
      vigente = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}
