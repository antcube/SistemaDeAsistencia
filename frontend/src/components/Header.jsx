import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BookText,
  CalendarClock,
  ChartColumnBig,
  House,
  LogOut,
  ShieldUser,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import seLogo from "../assets/se.svg";

const Header = () => {
  const {
    admin,
    logout,
  } = useAuth();

  const [open, setOpen] =
    useState(false);

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
      .map(
        (item) =>
          item[0]
      )
      .join("")
      .toUpperCase() ||
    "AP";

  const isMainAdmin =
    String(
      admin?.adminId || ""
    ).trim() ===
    "ADM-001";

  const isCircleManager =
    String(
      admin?.role || ""
    ).trim() ===
    "Gestor de Círculo";

  const menuItems = [
    {
      to: "/",
      label: "General",
      icon: House,
      end: true,
    },
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: ChartColumnBig,
    },
    {
      to: "/admins",
      label: "Admins",
      icon: ShieldUser,
    },
    {
      to: "/programaciones",
      label: "Programaciones",
      icon: CalendarClock,
    },
    {
      to: "/audit",
      label: "Bitácora",
      icon: BookText,
    },
  ];

  return (
    <header className="cc-header">

      <div className="cc-header-inner">

        <div className="cc-header-brand">

          <div className="cc-logo">
            <img
              src={seLogo}
              alt="SE"
              className="cc-logo-image"
            />
          </div>

          <div className="cc-brand-text">

            <div className="cc-brand-title">

              Círculos De

              <strong>
                Liderazgo
              </strong>

            </div>

            <div className="cc-brand-subtitle">
              Gestión de Círculos y Control de Asistencia
            </div>

          </div>

        </div>

        <div className="cc-department-badge">
          <span className="cc-department-dot" />
          <span>Departamento de Ventas Pariscorp</span>
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

            {isCircleManager ? (

              <div
                className="cc-avatar-button"
                aria-label="Perfil del Gestor de Círculo"
                aria-hidden="true"
              >
                {initials}
              </div>

            ) : (

              <>

                <button
                  type="button"
                  className={`cc-avatar-button ${open ? "is-open" : ""}`}
                  onClick={() =>
                    setOpen(
                      (value) =>
                        !value
                    )
                  }
                  aria-label="Abrir menú"
                  aria-expanded={open}
                >
                  {initials}
                </button>

                {open && isMainAdmin && (

                  <div className="cc-admin-menu">

                    <div className="cc-admin-menu-glow" />

                    <div className="cc-admin-menu-list">

                      {menuItems.map((item) => {
                        const Icon = item.icon;

                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            onClick={() =>
                              setOpen(false)
                            }
                            className={({ isActive }) =>
                              isActive
                                ? "cc-admin-menu-link active"
                                : "cc-admin-menu-link"
                            }
                          >
                            <span className="cc-menu-icon">
                              <Icon
                                className="h-[16px] w-[16px]"
                                strokeWidth={1.9}
                              />
                            </span>

                            <span className="cc-menu-label">
                              {item.label}
                            </span>
                          </NavLink>
                        );
                      })}

                    </div>

                  </div>

                )}

              </>

            )}

          </div>

          <button
            type="button"
            className="cc-logout-button"
            onClick={logout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut
              className="h-[17px] w-[17px]"
              strokeWidth={1.9}
            />
          </button>

        </div>

      </div>

    </header>
  );
};

export default Header;
