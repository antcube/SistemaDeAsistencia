import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/Login.jsx";
import Calendar from "./pages/Calendar.jsx";
import Attendance from "./pages/Attendance.jsx";
import AttendancePortal from "./pages/AttendancePortal.jsx";
import MonthlyReport from "./pages/MonthlyReport.jsx";
import Zoom from "./pages/Zoom.jsx";
import Members from "./pages/Members.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import Programaciones from "./pages/Programaciones.jsx";
import Audit from "./pages/Audit.jsx";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminLayout from "./components/AdminLayout.jsx";
import AdminOnlyRoute from "./components/AdminOnlyRoute.jsx";

import "./styles/admin.css";

const App = () => {
  return (
    <Routes>

      {/* =====================================================
          PORTAL PÚBLICO
      ===================================================== */}

      <Route
        path="/asistencia"
        element={<AttendancePortal />}
      />

      {/* =====================================================
          LOGIN ADMINISTRATIVO
      ===================================================== */}

      <Route
        path="/login"
        element={<Login />}
      />

      {/* =====================================================
          SISTEMA ADMINISTRATIVO
      ===================================================== */}

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>

          {/* =================================================
              MÓDULOS DISPONIBLES PARA ADMINISTRADOR Y GESTOR
              ================================================= */}

          <Route
            path="/calendar"
            element={<Calendar />}
          />

          <Route
            path="/reports"
            element={<MonthlyReport />}
          />

          <Route
            path="/zoom"
            element={<Zoom />}
          />

          <Route
            path="/members"
            element={<Members />}
          />

          {/*
            Esta ruta se mantiene porque la asistencia puede abrirse
            desde los módulos correspondientes. No se muestra como
            opción independiente en el menú del Gestor de Círculo.
          */}
          <Route
            path="/attendance"
            element={<Attendance />}
          />

          {/* =================================================
              MÓDULOS EXCLUSIVOS DEL ADMINISTRADOR PRINCIPAL
              ================================================= */}

          <Route element={<AdminOnlyRoute />}>

            <Route
              path="/admins"
              element={<AdminUsers />}
            />

            <Route
              path="/programaciones"
              element={<Programaciones />}
            />

            <Route
              path="/audit"
              element={<Audit />}
            />

          </Route>

          {/*
            Ya NO existe Dashboard como pantalla de inicio.
            Al entrar a / se lleva directamente al Calendario,
            que es el primer módulo real del sistema.
          */}
          <Route
            path="/"
            element={<Navigate to="/calendar" replace />}
          />

        </Route>
      </Route>

      {/* =====================================================
          RUTA NO ENCONTRADA
      ===================================================== */}

      <Route
        path="*"
        element={<Navigate to="/calendar" replace />}
      />

    </Routes>
  );
};

export default App;
