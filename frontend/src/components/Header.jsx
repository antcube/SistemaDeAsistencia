import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Header = () => {
  const { admin, logout } = useAuth();

  const [open, setOpen] = useState(false);

  const adminName =
    admin?.name ||
    admin?.adminName ||
    "Administrador Principal";

  const role =
    admin?.role ||
    "Administrador General";

  const initials =
    adminName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((item) => item[0])
      .join("")
      .toUpperCase() || "AP";

  const isMainAdmin =
    String(admin?.adminId || "")
      .trim() === "ADM-001";

  return (
    <header className="cc-header">
      <div className="cc-header-inner">

        <div className="cc-header-brand">
          <div className="cc-logo">
            <span>▣</span>
          </div>

          <div className="cc-brand-text">
            <div className="cc-brand-title">
              Círculos{" "}
              <strong>Connect</strong>

              <span className="cc-brand-badge">
                soy.embajador
              </span>
            </div>

            <div className="cc-brand-subtitle">
              Gestión de Círculos y Control de Asistencia
            </div>
          </div>
        </div>

        <div className="cc-header-right">

          <div className="cc-admin-info">
            <strong>
              {adminName}
            </strong>

            <span>
              {role}
            </span>
          </div>

          <div className="cc-profile-wrapper">

            <button
              type="button"
              className="cc-avatar-button"
              onClick={() =>
                setOpen(
                  (value) => !value
                )
              }
              aria-label="Abrir menú de administración"
            >
              {initials}
            </button>

            {open && (
              <div className="cc-admin-menu">

                <div className="cc-admin-menu-title">
                  ADMINISTRACIÓN
                </div>

                <NavLink
                  to="/"
                  onClick={() =>
                    setOpen(false)
                  }
                >
                  <span>⌂</span>
                  General
                </NavLink>

                {isMainAdmin && (
                  <NavLink
                    to="/admins"
                    onClick={() =>
                      setOpen(false)
                    }
                  >
                    <span>♙</span>
                    Usuarios Admin
                  </NavLink>
                )}

                {isMainAdmin && (
                  <NavLink
                    to="/programaciones"
                    onClick={() =>
                      setOpen(false)
                    }
                  >
                    <span>↻</span>
                    Programaciones
                  </NavLink>
                )}

                {isMainAdmin && (
                  <NavLink
                    to="/audit"
                    onClick={() =>
                      setOpen(false)
                    }
                  >
                    <span>▤</span>
                    Bitácora
                  </NavLink>
                )}

              </div>
            )}
          </div>

          <button
            type="button"
            className="cc-logout-button"
            onClick={logout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            ⇥
          </button>

        </div>

      </div>
    </header>
  );
};

export default Header;