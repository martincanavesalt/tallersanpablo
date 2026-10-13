const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export const dinero = (n: number | string | null | undefined) => pesos.format(Number(n ?? 0));

const TZ = "America/Argentina/Buenos_Aires";

export const fecha = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("es-AR", { timeZone: TZ }) : "—";

export const fechaHora = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("es-AR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }) : "—";
