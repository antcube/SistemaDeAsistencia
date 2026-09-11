import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
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
        element={
          <AttendancePortal />
        }
      />

      {/* =====================================================
          LOGIN ADMINISTRATIVO
      ===================================================== */}

      <Route
        path="/login"
        element={
          <Login />
        }
      />

      {/* =====================================================
          SISTEMA ADMINISTRATIVO
      ===================================================== */}

      <Route
        element={
          <ProtectedRoute />
        }
      >
        <Route
          element={
            <AdminLayout />
          }
        >

          {/* =================================================
              MÓDULOS DISPONIBLES PARA ADMINISTRADOR Y GESTOR
              ================================================= */}

          <Route
            path="/attendance"
            element={
              <Attendance />
            }
          />

          <Route
            path="/reports"
            element={
              <MonthlyReport />
            }
          />

          <Route
            path="/zoom"
            element={
              <Zoom />
            }
          />

          <Route
            path="/members"
            element={
              <Members />
            }
          />

          {/* =================================================
              MÓDULOS EXCLUSIVOS DEL ADMINISTRADOR GENERAL
              ================================================= */}

          <Route
            path="/calendar"
            element={
              <Calendar />
            }
          />

          <Route element={<AdminOnlyRoute />}>

            <Route
              path="/"
              element={
                <Dashboard />
              }
            />

            <Route
              path="/admins"
              element={
                <AdminUsers />
              }
            />

            <Route
              path="/programaciones"
              element={
                <Programaciones />
              }
            />

            <Route
              path="/audit"
              element={
                <Audit />
              }
            />

          </Route>

        </Route>
      </Route>

      {/* =====================================================
          RUTA NO ENCONTRADA
      ===================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/asistencia"
            replace
          />
        }
      />

    </Routes>
  );
};

export default App;