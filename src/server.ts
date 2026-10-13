import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config";
import { asegurarEtapasBase } from "./lib/etapas";
import { manejarErrores, noEncontrado } from "./errors";
import { requireAdmin, requireCliente, requireUsuario } from "./middleware/auth";
import { authRouter } from "./routes/auth";
import { autosRouter } from "./routes/autos";
import { busquedaRouter } from "./routes/busqueda";
import { clientesRouter } from "./routes/clientes";
import { dashboardRouter } from "./routes/dashboard";
import { documentosRouter } from "./routes/documentos";
import { gestionRouter } from "./routes/gestion";
import { portalRouter } from "./routes/portal";
import { siniestrosRouter } from "./routes/siniestros";
import { sucursalesRouter } from "./routes/sucursales";
import { usuariosRouter } from "./routes/usuarios";

const app = express();

app.set("trust proxy", 1); // detrás del proxy de Railway, para que el límite de intentos vea la IP real
app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/portal", requireCliente, portalRouter);

app.use("/usuarios", requireAdmin, usuariosRouter);
app.use("/sucursales", requireUsuario, sucursalesRouter);
app.use("/buscar", requireUsuario, busquedaRouter);
app.use("/clientes", requireUsuario, clientesRouter);
app.use("/autos", requireUsuario, autosRouter);
app.use("/siniestros", requireUsuario, siniestrosRouter);
app.use("/dashboard", requireUsuario, dashboardRouter);
app.use("/gestion", requireUsuario, gestionRouter);
app.use(documentosRouter);

app.use(noEncontrado);
app.use(manejarErrores);

// Las etapas de gestión iniciales se cargan solas la primera vez que arranca la API
asegurarEtapasBase()
  .catch((e) => console.error("No se pudieron cargar las etapas iniciales:", e))
  .finally(() => {
    app.listen(config.port, () => {
      console.log(`API escuchando en http://localhost:${config.port}`);
    });
  });
