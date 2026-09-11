import { useCallback, useEffect, useState } from "react";
import dashboardService from "../services/dashboardService";
import "../styles/dashboard.css";

const CATEGORY_ORDER = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
  "ORDINARIA",
];

const formatCategory = (value) => {
  const labels = {
    "CIRCULO DE LIDERAZGO": "Círculo de Liderazgo",
    HEALTH: "Health",
    MENTORIA: "Mentoría",
    MASTERCLASS: "Masterclass",
    "ANUNCIOS CORPORATIVOS": "Anuncios Corporativos",
    ORDINARIA: "Ordinaria",
  };

  return labels[value] || value;
};

const Dashboard = () => {
  const today = new Date();

  const [year, setYear] = useState(
    today.getFullYear()
  );

  const [month, setMonth] = useState(
    today.getMonth() + 1
  );

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data =
        await dashboardService.getDashboard(
          year,
          month
        );

      setDashboard(data);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "No se pudo cargar el dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const moveMonth = (amount) => {
    let nextMonth = month + amount;
    let nextYear = year;

    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }

    setMonth(nextMonth);
    setYear(nextYear);
  };

  const summary = dashboard?.summary || {};

  return (
    <section className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">
            CÍRCULOS CONNECT
          </span>

          <h1>Panel principal</h1>

          <p>
            Resumen general de reuniones y
            asistencia.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-refresh"
          onClick={loadDashboard}
          disabled={loading}
        >
          🔄 {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="dashboard-period">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label="Mes anterior"
        >
          ‹
        </button>

        <strong>
          {dashboard?.period?.monthLabel ||
            "Cargando..."}
        </strong>

        <button
          type="button"
          onClick={() => moveMonth(1)}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}

      <div className="dashboard-summary-grid">
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon">
            👥
          </span>
          <div>
            <span>Miembros</span>
            <strong>
              {loading ? "—" : summary.members ?? 0}
            </strong>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon">
            📅
          </span>
          <div>
            <span>Reuniones</span>
            <strong>
              {loading ? "—" : summary.meetings ?? 0}
            </strong>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon">
            ✅
          </span>
          <div>
            <span>Asistencias</span>
            <strong>
              {loading ? "—" : summary.attended ?? 0}
            </strong>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon">
            📊
          </span>
          <div>
            <span>Asistencia</span>
            <strong>
              {loading
                ? "—"
                : `${summary.attendanceRate ?? 0}%`}
            </strong>
          </div>
        </article>
      </div>

      <div className="dashboard-secondary-grid">
        <article className="dashboard-secondary-card">
          <span>❌</span>
          <div>
            <small>No asistieron</small>
            <strong>
              {loading ? "—" : summary.absent ?? 0}
            </strong>
          </div>
        </article>

        <article className="dashboard-secondary-card">
          <span>📝</span>
          <div>
            <small>Justificados</small>
            <strong>
              {loading
                ? "—"
                : summary.justified ?? 0}
            </strong>
          </div>
        </article>

        <article className="dashboard-secondary-card">
          <span>⏳</span>
          <div>
            <small>Pendientes</small>
            <strong>
              {loading ? "—" : summary.pending ?? 0}
            </strong>
          </div>
        </article>
      </div>

      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2>Resumen por categoría</h2>
            <p>
              Datos correspondientes al mes
              seleccionado.
            </p>
          </div>
        </div>

        <div className="dashboard-category-grid">
          {CATEGORY_ORDER.map((category) => {
            const data =
              dashboard?.categories?.[category] || {};

            return (
              <article
                className="dashboard-category-card"
                key={category}
              >
                <div className="dashboard-category-title">
                  <h3>
                    {formatCategory(category)}
                  </h3>

                  <span>
                    {data.sessions ?? 0}{" "}
                    {data.sessions === 1
                      ? "sesión"
                      : "sesiones"}
                  </span>
                </div>

                <div className="dashboard-category-stats">
                  <div>
                    <small>Asistieron</small>
                    <strong>
                      {data.attended ?? 0}
                    </strong>
                  </div>

                  <div>
                    <small>Faltaron</small>
                    <strong>
                      {data.absent ?? 0}
                    </strong>
                  </div>

                  <div>
                    <small>Justificados</small>
                    <strong>
                      {data.justified ?? 0}
                    </strong>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2>Reuniones del mes</h2>
            <p>
              Reuniones activas registradas en el
              calendario.
            </p>
          </div>
        </div>

        <div className="dashboard-meetings">
          {loading ? (
            <div className="dashboard-empty">
              Cargando reuniones...
            </div>
          ) : !dashboard?.meetings?.length ? (
            <div className="dashboard-empty">
              No hay reuniones registradas para este
              mes.
            </div>
          ) : (
            dashboard.meetings.map((meeting) => (
              <div
                className="dashboard-meeting-row"
                key={meeting.id}
              >
                <div>
                  <strong>
                    {meeting.title ||
                      formatCategory(meeting.type)}
                  </strong>

                  <span>
                    {meeting.circle} ·{" "}
                    {meeting.date}
                  </span>
                </div>

                <div className="dashboard-meeting-time">
                  {meeting.time || "--:--"}
                  {meeting.endTime
                    ? ` - ${meeting.endTime}`
                    : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
};

export default Dashboard;