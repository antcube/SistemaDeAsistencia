import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const CalendarIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-[16px] w-[16px]"
  >
    <rect
      x="3"
      y="4.5"
      width="18"
      height="16"
      rx="2.5"
    />

    <path d="M7 2.5v4M17 2.5v4M3 9h18" />
  </svg>
);

const ChartIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-[16px] w-[16px]"
  >
    <path d="M4 19V5M4 19h16" />

    <rect
      x="7"
      y="12"
      width="3"
      height="5"
      rx=".5"
    />

    <rect
      x="12"
      y="9"
      width="3"
      height="8"
      rx=".5"
    />

    <rect
      x="17"
      y="6"
      width="3"
      height="11"
      rx=".5"
    />
  </svg>
);

const VideoIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-[16px] w-[16px]"
  >
    <rect
      x="3"
      y="6"
      width="12"
      height="12"
      rx="2"
    />

    <path d="M15 10l6-3v10l-6-3" />
  </svg>
);

const MembersIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-[16px] w-[16px]"
  >
    <circle
      cx="9"
      cy="8"
      r="3"
    />

    <path d="M3.5 19c.7-3.1 2.5-4.5 5.5-4.5s4.8 1.4 5.5 4.5" />

    <path d="M16 11c2.2 0 4 1.2 4.5 3.5" />

    <path d="M16 5.5a2.7 2.7 0 0 1 0 5.2" />
  </svg>
);

const adminItems = [
  {
    to: "/calendar",
    label: "Calendario de Reuniones",
    icon: CalendarIcon,
  },

  {
    to: "/reports",
    label: "Reporte Mensual",
    icon: ChartIcon,
  },

  {
    to: "/zoom",
    label: "Procesar Zoom",
    icon: VideoIcon,
  },

  {
    to: "/members",
    label: "Directorio de Miembros",
    icon: MembersIcon,
  },
];

const managerItems = [
  {
    to: "/calendar",
    label: "Calendario de Reuniones",
    icon: CalendarIcon,
  },

  {
    to: "/reports",
    label: "Reporte Mensual",
    icon: ChartIcon,
  },

  {
    to: "/zoom",
    label: "Procesar Zoom",
    icon: VideoIcon,
  },

  {
    to: "/members",
    label: "Directorio de Miembros",
    icon: MembersIcon,
  },
];

const Sidebar = () => {
  const { admin } =
    useAuth();

  const isCircleManager =
    String(
      admin?.role || ""
    ).trim() ===
    "Gestor de Círculo";

  const items =
    isCircleManager
      ? managerItems
      : adminItems;

  return (
    <nav className="relative z-40 w-full border-b border-[#102657]/14 bg-white/[0.985] shadow-[0_5px_20px_rgba(0,0,0,0.12)]">

      <div className="mx-auto grid h-[59px] w-full max-w-[1216px] grid-cols-4 gap-2">

        {items.map(
          ({
            to,
            label,
            icon: Icon,
          }) => (
            <NavLink
              key={to}
              to={to}
              className={({
                isActive,
              }) =>
                [
                  "relative mx-0 my-[10px] flex min-h-[39px] items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition duration-200",

                  isActive
                    ? "bg-[linear-gradient(135deg,#2457c5,#102657)] text-white shadow-[0_5px_16px_rgba(36,87,197,0.28)]"
                    : "text-[#263b62] hover:-translate-y-px hover:bg-[#edf3ff] hover:text-[#102657]",
                ].join(" ")
              }
            >
              {({
                isActive,
              }) => (
                <>
                  <Icon />

                  <span>
                    {label}
                  </span>

                  {isActive && (
                    <span className="absolute bottom-[3px] left-[14%] right-[14%] h-[2px] rounded-full bg-[linear-gradient(90deg,#2457c5,#5f8ff5)]" />
                  )}
                </>
              )}
            </NavLink>
          )
        )}

      </div>

    </nav>
  );
};

export default Sidebar;