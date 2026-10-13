import "dotenv/config";

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta ${nombre} en el archivo .env`);
  return valor;
}

const jwtSecret = requerida("JWT_SECRET");
if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret,
  // Los dos frontends (panel interno y portal de clientes) que pueden llamar a la API
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
