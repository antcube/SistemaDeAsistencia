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

    const normalizeMeetingCategory = (value) => {
      const normalized = String(value || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (normalized.includes("CIRCULO DE LIDERAZGO") || normalized === "MES") {
        return "CIRCULO DE LIDERAZGO";
      }

      if (normalized.includes("HEALTH")) return "HEALTH";
      if (normalized.includes("MENTORIA")) return "MENTORIA";
      if (normalized.includes("MASTERCLASS")) return "MASTERCLASS";
      if (normalized.includes("ANUNCIOS CORPORATIVOS")) return "ANUNCIOS CORPORATIVOS";
      if (normalized.includes("ORDINARIA")) return "ORDINARIA";

      return String(value || "").trim();
    };

    const getMeetingCategoryClass = (value) => {
      const category = normalizeMeetingCategory(value);

      const classes = {
        "CIRCULO DE LIDERAZGO": "audit-meeting-leadership",
        HEALTH: "audit-meeting-health",
        MENTORIA: "audit-meeting-mentoria",
        MASTERCLASS: "audit-meeting-masterclass",
        "ANUNCIOS CORPORATIVOS": "audit-meeting-corporate",
        ORDINARIA: "audit-meeting-ordinaria",
      };

      return classes[category] || "audit-meeting-default";
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
        // Toda acción de Bitácora debe mostrar Deshacer.
        // El backend valida si la operación contiene los datos necesarios
        // para restaurar realmente el estado anterior.
        return !log?.undone;
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
              <div className="admin-management-card !rounded-2xl !border !border-[#1D3557] !bg-[#071326] !shadow-[0_12px_35px_rgba(3,20,45,0.22)]">
                <div className="admin-table-wrapper audit-scroll-container !rounded-2xl !border !border-[#17385F] !bg-[#061224] !p-3 !overflow-x-auto !overflow-y-hidden">
                  <table className="admin-management-table audit-table audit-table-detailed w-full !table-fixed !border-separate !border-spacing-0 !m-0">
                    <colgroup>
                      <col className="!w-[12.5%]" />
                      <col className="!w-[13.5%]" />
                      <col className="!w-[30%]" />
                      <col className="!w-[10%]" />
                      <col className="!w-[14%]" />
                      <col className="!w-[10%]" />
                      <col className="!w-[10%]" />
                    </colgroup>

                    <thead className="!bg-transparent">
                      <tr className="!bg-gradient-to-r !from-[#071329] !via-[#102A4B] !to-[#071329] !border-b !border-[#2D5A87] !shadow-[0_2px_18px_rgba(44,126,205,0.18)]">
                        <th className="!bg-transparent !text-[#DDF4FF] !border-0 !px-4 !py-4 !text-[10px] !font-bold !uppercase !tracking-[0.09em] !leading-tight">
                          Fecha y hora del cambio
                        </th>
                        <th className="!bg-transparent !text-[#DDF4FF] !border-0 !px-4 !py-4 !text-[10px] !font-bold !uppercase !tracking-[0.09em] !leading-tight">
                          Administrador
                        </th>
                        <th className="!bg-transparent !text-[#DDF4FF] !border-0 !px-4 !py-4 !text-[10px] !font-bold !uppercase !tracking-[0.09em] !leading-tight">
                          Detalle de la acción
                        </th>
                        <th className="!bg-transparent !text-[#DDF4FF] !border-0 !px-4 !py-4 !text-[10px] !font-bold !uppercase !tracking-[0.09em] !leading-tight">
                          Fecha de la reunión
                        </th>
                        <th className="!bg-transparent !text-[#DDF4FF] !border-0 !px-4 !py-4 !text-[10px] !font-bold !uppercase !tracking-[0.09em] !leading-tight">
                          Reunión / categoría
                        </th>
                        <th className="!bg-transparent !text-[#DDF4FF] !border-0 !px-4 !py-4 !text-[10px] !font-bold !uppercase !tracking-[0.09em] !leading-tight">
                          Círculo
                        </th>
                        <th className="!bg-transparent !text-[#DDF4FF] !border-0 !px-4 !py-4 !text-[10px] !font-bold !uppercase !tracking-[0.09em] !leading-tight">
                          Acción
                        </th>
                      </tr>
                    </thead>

                    <tbody className="[&_td]:min-w-0 [&_th]:min-w-0">
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
                          const normalizedMeetingCategory =
                            meetingType !== "—"
                              ? normalizeMeetingCategory(meetingType)
                              : "—";
                          const showMeetingTitle =
                            meetingTitle !== "—" &&
                            String(meetingTitle).trim().toUpperCase() !==
                              String(normalizedMeetingCategory).trim().toUpperCase();
                          const statusChange =
                            log.module === "attendance" &&
                            metadata.previousStatus !== undefined
                              ? `${metadata.previousStatus || "Sin registro"} → ${metadata.newStatus || "—"}`
                              : "—";

                          return (
                            <tr
                              key={log._id}
                              className="group !border-b !border-[#DCE7F3] !bg-[#F8FBFF] transition-colors duration-200 hover:!bg-[#EEF7FF]"
                            >
                              <td className="!px-3.5 !py-4 !align-top !border-r !border-[#DDE8F3] !text-[#263A55] !break-words">
                                <strong className="!block !whitespace-normal !break-words !font-semibold !leading-relaxed !text-[#1B3556]">
                                  {formatAuditDateTime(log.createdAt)}
                                </strong>
                              </td>

                              <td className="!px-3.5 !py-4 !align-top !border-r !border-[#DDE8F3] !text-[#263A55] !break-words">
                                <strong className="!block !whitespace-normal !break-words !font-semibold !leading-relaxed !text-[#16345A]">
                                  {getActorLabel(log)}
                                </strong>
                                {log.adminId && (
                                  <small className="!mt-1 !block !text-[10px] !font-medium !text-[#71849D]">
                                    {log.adminId}
                                  </small>
                                )}
                              </td>

                              <td className="!px-3.5 !py-4 !align-top !border-r !border-[#DDE8F3] !text-[#344A66] !break-words !whitespace-normal">
                                <div className="audit-detail-main !text-[#344A66]">
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

                              <td className="!px-3 !py-4 !align-top !border-r !border-[#DDE8F3] !font-medium !text-[#3B526F] !whitespace-normal !break-words">
                                {formatMeetingDate(meetingDate)}
                              </td>

                              <td className="audit-meeting-cell !px-3 !py-4 !align-top !border-r !border-[#DDE8F3] !text-[#29435F] !break-words !whitespace-normal">
                                {showMeetingTitle && (
                                  <strong>{meetingTitle}</strong>
                                )}

                                {meetingType !== "—" && (
                                  <span
                                    className={`audit-meeting-badge ${getMeetingCategoryClass(
                                      meetingType
                                    )}`}
                                  >
                                    {normalizedMeetingCategory}
                                  </span>
                                )}

                                {metadata.meetingTime && (
                                  <small className="audit-meeting-time">
                                    {metadata.meetingTime}
                                  </small>
                                )}
                              </td>

                              <td className="!px-3 !py-4 !align-top !border-r !border-[#DDE8F3] !text-center !break-words">
                                <span className="audit-circle-badge !inline-flex !max-w-full !items-center !justify-center !whitespace-normal !break-words !text-center !border !border-[#B9D7F2] !bg-[#EAF5FF] !text-[#245B91] !shadow-[0_0_10px_rgba(61,145,220,0.10)]">
                                  {log.circle || "—"}
                                </span>
                              </td>

                              <td className="!px-2.5 !py-4 !align-top !text-center !whitespace-nowrap">
                                {reversible ? (
                                  <button
                                    type="button"
                                    className="audit-undo-button !inline-flex !items-center !justify-center !whitespace-nowrap !rounded-lg !border !border-[#B8CDE5] !bg-[#F4F9FF] !px-2 !py-1.5 !text-[10px] !font-semibold !text-[#245B91] transition-all duration-200 hover:!border-[#6BA8D8] hover:!bg-[#E8F4FF] hover:!text-[#123F70] hover:!shadow-[0_0_12px_rgba(65,145,220,0.16)]"
                                    onClick={() => handleUndo(log)}
                                    disabled={undoingId === log._id}
                                  >
                                    {undoingId === log._id ? "Deshaciendo..." : "↩ Deshacer cambio"}
                                  </button>
                                ) : (
                                  <span className="audit-no-action !text-[#8293A8]">—</span>
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
