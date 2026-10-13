import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth";
import Layout from "./Layout";
import Buscar from "./pages/Buscar";
import Cliente from "./pages/Cliente";
import ClienteNuevo from "./pages/ClienteNuevo";
import Dashboard from "./pages/Dashboard";
import Gestion from "./pages/Gestion";
import Login from "./pages/Login";
import MiClave from "./pages/MiClave";
import Siniestro from "./pages/Siniestro";
import SiniestroNuevo from "./pages/SiniestroNuevo";
import Siniestros from "./pages/Siniestros";
import Usuarios from "./pages/Usuarios";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Buscar />} />
          <Route path="clientes/nuevo" element={<ClienteNuevo />} />
          <Route path="clientes/:id" element={<Cliente />} />
          <Route path="gestion" element={<Gestion />} />
          <Route path="siniestros" element={<Siniestros />} />
          <Route path="siniestros/nuevo" element={<SiniestroNuevo />} />
          <Route path="siniestros/:id" element={<Siniestro />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="mi-clave" element={<MiClave />} />
          <Route path="personal" element={<Usuarios />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
