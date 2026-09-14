import { useEffect, useState } from "react";

import auditService from "../services/auditService";
import circleService from "../services/circleService";

const formatAuditDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const formatMeetingDate = (value) => {
  if (!value) return "—";

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getMetadata = (log) =>
  log?.metadata && typeof log.metadata === "object"
    ? log.metadata
    : {};

const getActorLabel = (log) => {
  const id = String(log?.adminId || "").trim();
  const role = String(log?.adminRole || "").trim();
  const name = String(log?.adminName || "").trim();

  if (id && role) return `${id} — ${role}`;
  if (id && name) return `${id} — ${name}`;
  return name || id || "Administrador";
};

const getDetailedDescription = (log) => {
  const metadata = getMetadata(log);
  const memberName = metadata.memberName || log.targetName || "el miembro";
  const meetingTitle = metadata.meetingTitle || "Reunión";
  const meetingType = metadata.meetingType || "";
  const meetingDate = metadata.meetingDate || "";
  const meetingTime = metadata.meetingTime || "";
  const circle = log.circle || "";
  const previous = metadata.previousStatus || "Sin registro";
  const next = metadata.newStatus || "—";
  const actor = String(log.adminId || log.adminName || "Administrador").trim();

  if (log.module === "attendance") {
    if (log.action === "CREATE_ATTENDANCE") {
      return `${actor} registró a ${memberName} con estado "${next}" para la reunión ${meetingTitle}${meetingType ? ` (${meetingType})` : ""} del ${formatMeetingDate(meetingDate)}${meetingTime ? ` a las ${meetingTime}` : ""}${circle ? `, en el círculo ${circle}` : ""}.`;
    }

    return `${actor} cambió el estado de ${memberName} de "${previous}" a "${next}" para la reunión ${meetingTitle}${meetingType ? ` (${meetingType})` : ""} del ${formatMeetingDate(meetingDate)}${meetingTime ? ` a las ${meetingTime}` : ""}${circle ? `, en el círculo ${circle}` : ""}.`;
  }

  return log.description || "Movimiento registrado.";
};

const Audit = () => {
  const [logs, setLogs] = useState([]);
  const [circles, setCircles] = useState([]);
  const [circle, setCircle] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [undoingId, setUndoingId] = useState("");

  const loadCircles = async () => {
    try {
      const response = await circleService.getCircles();
      const circleList = Array.isArray(response)
        ? response
        : response?.data || response?.circles || [];

      const normalizedCircles = circleList
        .map((item) =>
          typeof item === "string" ? item.trim() : String(item?.name || "").trim()
        )
        .filter(Boolean);

      const uniqueCircles = [...new Set(normalizedCircles)];
      uniqueCircles.sort((a, b) =>
        a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
      );

      setCircles(uniqueCircles);
    } catch (err) {
      console.error("Error cargando círculos:", err);
      setCircles([]);
    }
  };

  const loadLogs = async ({ requestedPage = 1, selectedCircle = "" } = {}) => {
    try {
      setLoading(true);
      setError("");

      const response = await auditService.getLogs({
        page: requestedPage,
        limit: 50,
        circle: selectedCircle,
      });

      setLogs(Array.isArray(response?.data) ? response.data : []);
      setPagination(
        response?.pagination || {
          page: requestedPage,
          limit: 50,
          total: 0,
          totalPages: 1,
        }
      );
      setPage(Number(response?.pagination?.page || requestedPage));
    } catch (err) {
      console.error("Error cargando bitácora:", err);
      setLogs([]);
      setPagination({ page: 1, limit: 50, total: 0, totalPages: 1 });
      setError(err?.message || "No se pudo cargar la bitácora.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCircles();
    loadLogs({ requestedPage: 1, selectedCircle: "" });
  }, []);

  const handleCircleChange = async (event) => {
    const selectedCircle = event.target.value;
    setCircle(selectedCircle);
    setPage(1);

    await loadLogs({
      requestedPage: 1,
      selectedCircle,
    });
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setPage(1);

    await loadLogs({
      requestedPage: 1,
      selectedCircle: circle,
    });
  };

  const clearFilters = async () => {
    setCircle("");
    setPage(1);
    await loadLogs({ requestedPage: 1, selectedCircle: "" });
  };

  const previousPage = async () => {
    if (page <= 1) return;

    await loadLogs({
      requestedPage: page - 1,
      selectedCircle: circle,
    });
  };

  const nextPage = async () => {
    if (page >= pagination.totalPages) return;

    await loadLogs({
      requestedPage: page + 1,
      selectedCircle: circle,
    });
  };

  const canUndoLog = (log) => {
    const metadata = getMetadata(log);
    return !log?.undone && (
      Boolean(log?.reversible) ||
      (log?.module === "attendance" && Boolean(metadata.attendanceId || log.targetId))
    );
  };

  const handleUndo = async (log) => {
    if (!log?._id || !canUndoLog(log)) return;

    const metadata = getMetadata(log);
    const memberName = metadata.memberName || log.targetName || "el miembro";
    const meetingDate = formatMeetingDate(metadata.meetingDate);
    const nextStatus = metadata.newStatus || "el estado registrado";

    const confirmed = window.confirm(
      `¿Deseas deshacer esta acción?\n\n${getDetailedDescription(log)}\n\nEl sistema restaurará el estado anterior si nadie realizó cambios posteriores sobre esa asistencia.`
    );

    if (!confirmed) return;

    try {
      setUndoingId(log._id);
      setError("");

      const response = await auditService.undoLog(log._id);

      if (response?.changedLater) {
        window.alert(
          `La acción de ${memberName} del ${meetingDate} fue retirada de la Bitácora, pero el estado actual se conservó porque hubo un cambio posterior.`
        );
      }

      await loadLogs({
        requestedPage: page,
        selectedCircle: circle,
      });
    } catch (err) {
      console.error("Error deshaciendo acción:", err);
      setError(err?.message || `No se pudo deshacer el cambio a "${nextStatus}".`);
    } finally {
      setUndoingId("");
    }
  };

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <span className="cc-section-kicker">SEGURIDAD</span>
          <h1>Bitácora</h1>
          <p>Historial detallado de cambios realizados en los círculos.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            loadLogs({ requestedPage: page, selectedCircle: circle })
          }
          disabled={loading}
        >
          🔄 Actualizar
        </button>
      </div>

      {error && <div className="module-error">{error}</div>}

      <form className="audit-filters audit-filters-circle-only" onSubmit={handleSearch}>
        <div className="audit-circle-field">
          <label htmlFor="audit-circle">Círculo</label>
          <select id="audit-circle" value={circle} onChange={handleCircleChange}>
            <option value="">Todos los círculos</option>
            {circles.map((circleName) => (
              <option key={circleName} value={circleName}>
                {circleName}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="primary-button">
          🔎 Buscar
        </button>

        <button type="button" className="secondary-button" onClick={clearFilters}>
          Limpiar
        </button>
      </form>

      {loading ? (
        <div className="table-empty">
          <span>⏳</span>
          <strong>Cargando bitácora...</strong>
        </div>
      ) : (
        <>
          <div className="admin-management-card">
            <div className="admin-table-wrapper">
              <table className="admin-management-table audit-table audit-table-detailed">
                <thead>
                  <tr>
                    <th>Fecha y hora del cambio</th>
                    <th>Administrador</th>
                    <th>Detalle de la acción</th>
                    <th>Fecha de la reunión</th>
                    <th>Reunión / categoría</th>
                    <th>Círculo</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="audit-empty-cell">
                        {circle
                          ? `No hay registros para ${circle}.`
                          : "No hay registros en la bitácora."}
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const metadata = getMetadata(log);
                      const reversible = canUndoLog(log);
                      const meetingDate = metadata.meetingDate;
                      const meetingType = metadata.meetingType || "—";
                      const meetingTitle = metadata.meetingTitle || log.action || "—";
                      const statusChange =
                        log.module === "attendance" &&
                        metadata.previousStatus !== undefined
                          ? `${metadata.previousStatus || "Sin registro"} → ${metadata.newStatus || "—"}`
                          : "—";

                      return (
                        <tr key={log._id}>
                          <td>
                            <strong>{formatAuditDateTime(log.createdAt)}</strong>
                          </td>

                          <td>
                            <strong>{getActorLabel(log)}</strong>
                            {log.adminId && <small>{log.adminId}</small>}
                          </td>

                          <td>
                            <div className="audit-detail-main">
                              {getDetailedDescription(log)}
                            </div>

                            {log.module === "attendance" && (
                              <div className="audit-status-change">
                                Estado: <strong>{statusChange}</strong>
                              </div>
                            )}

                            {log.undone && (
                              <span className="audit-undone-badge">
                                ↩ Acción deshecha
                              </span>
                            )}

                            {log.undone && log.undoMessage && (
                              <div className="audit-undo-message">
                                {log.undoMessage}
                              </div>
                            )}
                          </td>

                          <td>{formatMeetingDate(meetingDate)}</td>

                          <td>
                            <strong>{meetingTitle}</strong>
                            <small>{meetingType}</small>
                            {metadata.meetingTime && (
                              <small>{metadata.meetingTime}</small>
                            )}
                          </td>

                          <td>
                            <span className="audit-circle-badge">
                              {log.circle || "—"}
                            </span>
                          </td>

                          <td>
                            {reversible ? (
                              <button
                                type="button"
                                className="audit-undo-button"
                                onClick={() => handleUndo(log)}
                                disabled={undoingId === log._id}
                              >
                                {undoingId === log._id ? "Deshaciendo..." : "↩ Deshacer"}
                              </button>
                            ) : (
                              <span className="audit-no-action">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="audit-pagination">
            <button
              type="button"
              className="secondary-button"
              onClick={previousPage}
              disabled={page <= 1 || loading}
            >
              ← Anterior
            </button>

            <span>
              Página <strong>{page}</strong> de <strong>{pagination.totalPages}</strong>
            </span>

            <button
              type="button"
              className="secondary-button"
              onClick={nextPage}
              disabled={page >= pagination.totalPages || loading}
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default Audit;
