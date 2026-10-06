import { useEffect, useMemo, useState } from "react";
import auditService from "../services/auditService";
import circleService from "../services/circleService";

const formatDateTime = (value) => {
  if (!value) return { date: "—", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "" };
  return {
    date: date.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
};

const formatMeetingDate = (value) => {
  if (!value) return "—";
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return raw;
};

const meta = (log) =>
  log?.metadata && typeof log.metadata === "object" ? log.metadata : {};

const actorLabel = (log) => {
  const name = String(log?.adminName || "").trim();
  const id = String(log?.adminId || "").trim();
  return name || id || "Administrador";
};

const actorRole = (log) =>
  String(log?.adminRole || "Administrador").trim();

const moduleInfo = (moduleName) => {
  const key = String(moduleName || "").toLowerCase();
  const map = {
    attendance: [
      "Asistencia",
      "bg-emerald-50 text-emerald-700 border-emerald-200",
    ],
    zoom: ["Zoom", "bg-violet-50 text-violet-700 border-violet-200"],
    members: ["Miembros", "bg-sky-50 text-sky-700 border-sky-200"],
    admins: [
      "Usuarios admin",
      "bg-indigo-50 text-indigo-700 border-indigo-200",
    ],
    meetings: ["Reuniones", "bg-cyan-50 text-cyan-700 border-cyan-200"],
    schedules: [
      "Programaciones",
      "bg-amber-50 text-amber-700 border-amber-200",
    ],
    circles: ["Círculos", "bg-blue-50 text-blue-700 border-blue-200"],
    member_migrations: [
      "Migraciones",
      "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    ],
  };
  return (
    map[key] || [
      moduleName || "Sistema",
      "bg-slate-50 text-slate-700 border-slate-200",
    ]
  );
};

const actionLabel = (action) => {
  const map = {
    CREATE_MEETING: "Creó reunión",
    CREATE_MEETINGS_BATCH: "Creó reuniones",
    UPDATE_MEETING: "Editó reunión",
    DELETE_MEETING: "Eliminó reunión",
    RESTORE_MEETING: "Restauró reunión",
    MOVE_MEETING: "Reprogramó reunión",
    ACTIVATE_QR: "Activó QR",
    DEACTIVATE_QR: "Desactivó QR",
    DELETE_ALL_CORPORATE_ANNOUNCEMENTS: "Eliminó anuncios corporativos",
    CREATE_SCHEDULE: "Creó programación",
    UPDATE_SCHEDULE: "Editó programación",
    TERMINATE_SCHEDULE: "Eliminó programación",
    RESTORE_SCHEDULE: "Restauró programación",
    MIGRATE_SCHEDULE: "Migró programación",
    GENERATE_SCHEDULE_MONTH: "Generó mes",
    CREATE_CIRCLE: "Creó círculo",
    UPDATE_CIRCLE: "Editó círculo",
    DELETE_CIRCLE: "Eliminó círculo",
    RESTORE_CIRCLE: "Restauró círculo",
    CREATE_MEMBER: "Creó miembro",
    UPDATE_MEMBER: "Editó miembro",
    DELETE_MEMBER: "Eliminó miembro",
    CREATE_ATTENDANCE: "Registró asistencia",
    UPDATE_ATTENDANCE: "Cambió asistencia",
    MIGRATE_MEMBER: "Migró miembro",
  };
  return map[action] || String(action || "Acción").replaceAll("_", " ");
};

const detailedDescription = (log) => {
  const metadata = meta(log);

  if (log.module === "attendance") {
    const member = metadata.memberName || log.targetName || "Miembro";
    const meeting = metadata.meetingTitle || metadata.meetingType || "reunión";
    const previous = metadata.previousStatus || "Sin registro";
    const next = metadata.newStatus || "—";
    if (log.action === "CREATE_ATTENDANCE") {
      return `Se registró a ${member} como “${next}” en ${meeting}.`;
    }
    return `${member}: “${previous}” → “${next}” en ${meeting}.`;
  }


  if (log.module === "member_migrations") {
    const member = metadata.memberName || log.targetName || "Miembro";
    const source = metadata.sourceCircle || "círculo origen";
    const target = metadata.targetCircle || "círculo destino";
    const period = metadata.effectivePeriod || "período seleccionado";
    const scheduled = Boolean(metadata.scheduled);

    return scheduled
      ? `${member}: migración programada de ${source} a ${target} desde ${period}. Los meses anteriores permanecen en sus círculos históricos.`
      : `${member}: migración de ${source} a ${target} efectiva desde ${period}. Los meses anteriores permanecen en sus círculos históricos.`;
  }

  if (log.module === "zoom") {
    const createdMeetings = Array.isArray(metadata.meetingChanges)
      ? metadata.meetingChanges.filter((item) => item?.wasCreated).length
      : 0;
    const base =
      log.description ||
      `Se procesó Zoom para ${metadata.sessionType || "la sesión"}.`;
    if (createdMeetings > 0 && !base.includes("crearon automáticamente")) {
      return `${base} El sistema creó automáticamente ${createdMeetings} reunión(es) que no existían en el calendario.`;
    }
    return base;
  }

  if (log._groupedLogIds?.length > 1) {
    const metadataType = metadata.meetingType || log.targetName || "reunión";
    const scope = log._groupedAllCircles
      ? "todos los círculos"
      : `${log._groupedCircles.length} círculos`;
    return `Se creó ${metadataType} para ${scope} como una única acción operativa.`;
  }

  return log.description || "Movimiento registrado en el sistema.";
};

const groupLegacyGlobalMeetingLogs = (logs, knownCircles) => {
  const groups = [];
  const used = new Set();
  const totalKnownCircles = knownCircles.length;

  for (let index = 0; index < logs.length; index += 1) {
    if (used.has(index)) continue;
    const current = logs[index];
    const currentMeta = meta(current);

    const isCandidate =
      current?.module === "meetings" &&
      current?.action === "CREATE_MEETING" &&
      String(currentMeta.meetingType || "").toUpperCase() ===
        "ANUNCIOS CORPORATIVOS";

    if (!isCandidate) {
      groups.push(current);
      used.add(index);
      continue;
    }

    const currentTime = new Date(current.createdAt).getTime();
    const matches = [];

    for (let otherIndex = index; otherIndex < logs.length; otherIndex += 1) {
      if (used.has(otherIndex)) continue;
      const item = logs[otherIndex];
      const itemMeta = meta(item);
      const itemTime = new Date(item.createdAt).getTime();

      const sameOperation =
        item?.module === "meetings" &&
        item?.action === "CREATE_MEETING" &&
        item?.adminId === current?.adminId &&
        String(itemMeta.meetingType || "").toUpperCase() ===
          "ANUNCIOS CORPORATIVOS" &&
        itemMeta.meetingDate === currentMeta.meetingDate &&
        String(itemMeta.meetingTime || "") ===
          String(currentMeta.meetingTime || "") &&
        Math.abs(itemTime - currentTime) <= 15000;

      if (sameOperation) matches.push({ item, index: otherIndex });
    }

    if (matches.length <= 1) {
      groups.push(current);
      used.add(index);
      continue;
    }

    matches.forEach((entry) => used.add(entry.index));
    const groupedCircles = [
      ...new Set(matches.map((entry) => entry.item.circle).filter(Boolean)),
    ];
    const allCircles =
      totalKnownCircles > 0 && groupedCircles.length >= totalKnownCircles;
    const allUndone = matches.every((entry) => entry.item.undone);
    const anyReversible = matches.some(
      (entry) => entry.item.reversible && !entry.item.undone
    );

    groups.push({
      ...current,
      _id: `legacy-group:${matches.map((entry) => entry.item._id).join("|")}`,
      _groupedLogIds: matches.map((entry) => entry.item._id),
      _groupedCircles: groupedCircles,
      _groupedAllCircles: allCircles,
      circle: allCircles ? "GLOBAL" : groupedCircles.join(", "),
      reversible: anyReversible,
      undone: allUndone,
      targetName: current.targetName || "ANUNCIOS CORPORATIVOS",
      description: `Se creó ANUNCIOS CORPORATIVOS para ${
        allCircles ? "todos los círculos" : `${groupedCircles.length} círculos`
      }.`,
      metadata: {
        ...currentMeta,
        circles: groupedCircles,
        affectedCount: matches.length,
        scope: allCircles ? "ALL_CIRCLES" : "MULTI_CIRCLE",
      },
    });
  }

  return groups;
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
      const list = Array.isArray(response)
        ? response
        : response?.data || response?.circles || [];
      const names = [
        ...new Set(
          list
            .map((item) => (typeof item === "string" ? item : item?.name))
            .filter(Boolean)
        ),
      ];
      names.sort((a, b) =>
        a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
      );
      setCircles(names);
    } catch {
      setCircles([]);
    }
  };

  const loadLogs = async ({ requestedPage = 1, selectedCircle = circle } = {}) => {
    try {
      setLoading(true);
      setError("");
      const response = await auditService.getLogs({
        page: requestedPage,
        limit: 50,
        circle: selectedCircle,
      });
      setLogs(Array.isArray(response?.data) ? response.data : []);
      const nextPagination = response?.pagination || {
        page: requestedPage,
        limit: 50,
        total: 0,
        totalPages: 1,
      };
      setPagination(nextPagination);
      setPage(Number(nextPagination.page || requestedPage));
    } catch (err) {
      setError(err?.message || "No se pudo cargar la bitácora.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeAudit = async () => {
      await Promise.all([
        loadCircles(),
        loadLogs({ requestedPage: 1, selectedCircle: "" }),
      ]);
    };

    void initializeAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayedLogs = useMemo(
    () => groupLegacyGlobalMeetingLogs(logs, circles),
    [logs, circles]
  );

  const stats = useMemo(
    () => ({
      visible: displayedLogs.length,
      reversible: displayedLogs.filter(
        (item) => item.reversible && !item.undone
      ).length,
      undone: displayedLogs.filter((item) => item.undone).length,
    }),
    [displayedLogs]
  );

  const changeCircle = async (event) => {
    const value = event.target.value;
    setCircle(value);
    await loadLogs({ requestedPage: 1, selectedCircle: value });
  };

  const canUndo = (log) => Boolean(log?.reversible && !log?.undone);

  const handleUndo = async (log) => {
    if (!log?._id || !canUndo(log)) return;

    const confirmed = window.confirm(
      `¿Deshacer esta acción?\n\n${detailedDescription(
        log
      )}\n\nSe restaurará el estado anterior siempre que no existan cambios posteriores.`
    );
    if (!confirmed) return;

    try {
      setUndoingId(log._id);
      setError("");

      if (Array.isArray(log._groupedLogIds) && log._groupedLogIds.length > 1) {
        let preserved = 0;
        for (const logId of log._groupedLogIds) {
          try {
            const response = await auditService.undoLog(logId);
            if (response?.changedLater) preserved += 1;
          } catch (err) {
            const message = String(err?.message || "");
            if (!message.toLowerCase().includes("ya fue deshecha")) throw err;
          }
        }
        if (preserved) {
          window.alert(
            `La acción global se deshizo, pero ${preserved} registro(s) conservaron cambios posteriores.`
          );
        }
      } else {
        const response = await auditService.undoLog(log._id);
        if (response?.changedLater) {
          window.alert(
            response?.message || "Se conservaron cambios posteriores."
          );
        }
      }

      await loadLogs({ requestedPage: page, selectedCircle: circle });
    } catch (err) {
      setError(err?.message || "No se pudo deshacer esta acción.");
    } finally {
      setUndoingId("");
    }
  };

  return (
    <section
      className="module-page !h-[calc(100vh-132px)] !min-h-[620px] !overflow-hidden !space-y-3 flex flex-col"
    >
      <div className="shrink-0 rounded-2xl border border-[#DCE7F5] bg-gradient-to-r from-white to-[#F3F8FF] px-5 py-4 shadow-[0_12px_28px_rgba(20,55,95,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#1F5FBF]">
              Seguridad · Auditoría
            </span>
            <h1 className="mt-0.5 text-[22px] font-extrabold tracking-tight text-[#071A35]">
              Bitácora de actividad
            </h1>
            <p className="mt-0.5 text-xs text-[#61738C]">
              Cada tarjeta representa una acción operativa; las acciones globales se muestran una sola vez.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden gap-2 md:flex">
              <div className="rounded-xl border border-[#DCE7F5] bg-white px-3 py-2 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#8291A7]">
                  Visibles
                </span>
                <strong className="text-sm text-[#102A4D]">{stats.visible}</strong>
              </div>
              <div className="rounded-xl border border-[#CFE6DD] bg-[#F4FBF8] px-3 py-2 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#4D806B]">
                  Deshacer
                </span>
                <strong className="text-sm text-[#0B7A55]">{stats.reversible}</strong>
              </div>
            </div>
            <button
              type="button"
              className="secondary-button !rounded-xl !px-4 !py-2.5"
              onClick={() =>
                loadLogs({ requestedPage: page, selectedCircle: circle })
              }
              disabled={loading}
            >
              ↻ {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#DCE7F5] bg-white shadow-[0_10px_30px_rgba(20,55,95,0.08)] flex flex-col">
        <div className="shrink-0 flex flex-wrap items-end justify-between gap-3 border-b border-[#E5EDF6] bg-[#FBFDFF] px-4 py-3">
          <div className="min-w-[260px] flex-1 sm:max-w-[390px]">
            <label
              htmlFor="audit-circle"
              className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[#586E8A]"
            >
              Filtrar por círculo
            </label>
            <select
              id="audit-circle"
              value={circle}
              onChange={changeCircle}
              className="w-full rounded-xl border border-[#C9D8EA] bg-white px-3 py-2.5 text-sm font-semibold text-[#193657] outline-none transition focus:border-[#4D8FE8] focus:ring-2 focus:ring-[#4D8FE8]/15"
            >
              <option value="">Todos los círculos</option>
              {circles.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-right text-xs text-[#71839A]">
            <span className="block">
              Página {page} de {pagination.totalPages}
            </span>
            <strong className="text-[#234B78]">
              {pagination.total} registros de auditoría
            </strong>
          </div>
        </div>

        {error && (
          <div className="mx-3 mt-3 shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]">
          {loading ? (
            <div className="flex h-full min-h-[220px] items-center justify-center text-[#6A7C93]">
              Cargando bitácora...
            </div>
          ) : displayedLogs.length === 0 ? (
            <div className="flex h-full min-h-[220px] items-center justify-center text-[#6A7C93]">
              No hay movimientos para el filtro seleccionado.
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayedLogs.map((log) => {
                const metadata = meta(log);
                const [moduleLabel, moduleClass] = moduleInfo(log.module);
                const stamp = formatDateTime(log.createdAt);
                const meetingDate =
                  metadata.meetingDate || metadata.effectiveDate || "";
                const meetingType = metadata.meetingType || "";
                const reversible = canUndo(log);
                const isGlobal =
                  log.circle === "GLOBAL" || metadata.scope === "ALL_CIRCLES";

                return (
                  <article
                    key={log._id}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-[0_5px_16px_rgba(19,56,98,0.05)] transition hover:shadow-[0_9px_22px_rgba(19,56,98,0.09)] ${
                      log.undone ? "border-[#F0D5AC]" : "border-[#D9E5F2]"
                    }`}
                  >
                    <div className="grid gap-0 xl:grid-cols-[130px_170px_minmax(0,1fr)_190px]">
                      <div className="border-b border-[#E4ECF5] bg-[#F7FAFE] px-3.5 py-3 xl:border-b-0 xl:border-r">
                        <span className="block text-[10px] font-extrabold uppercase tracking-wide text-[#24486F]">
                          {stamp.date}
                        </span>
                        <span className="mt-1 block text-[11px] font-semibold text-[#71839A]">
                          {stamp.time}
                        </span>
                      </div>

                      <div className="border-b border-[#E4ECF5] px-3.5 py-3 xl:border-b-0 xl:border-r">
                        <strong className="block truncate text-[13px] text-[#122C4E]">
                          {actorLabel(log)}
                        </strong>
                        <span className="mt-1 block text-[11px] text-[#68809B]">
                          {actorRole(log)}
                        </span>
                        {log.adminId && (
                          <span className="mt-1 block text-[9px] font-semibold text-[#91A0B2]">
                            {log.adminId}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 border-b border-[#E4ECF5] px-3.5 py-3 xl:border-b-0 xl:border-r">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide ${moduleClass}`}
                          >
                            {moduleLabel}
                          </span>
                          <span className="text-[12px] font-extrabold text-[#24486F]">
                            {actionLabel(log.action)}
                          </span>
                          {isGlobal && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[9px] font-extrabold text-blue-700">
                              Todos los círculos
                            </span>
                          )}
                          {log.undone && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-extrabold text-amber-700">
                              ↩ Deshecha
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[12px] leading-[18px] text-[#405670]">
                          {detailedDescription(log)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#6E8198]">
                          {log.circle && (
                            <span>
                              <b className="text-[#395877]">Ámbito:</b>{" "}
                              {isGlobal ? "Todos los círculos" : log.circle}
                            </span>
                          )}
                          {meetingDate && (
                            <span>
                              <b className="text-[#395877]">Fecha:</b>{" "}
                              {formatMeetingDate(meetingDate)}
                            </span>
                          )}
                          {meetingType && (
                            <span>
                              <b className="text-[#395877]">Categoría:</b>{" "}
                              {meetingType}
                            </span>
                          )}
                          {metadata.meetingTime && (
                            <span>
                              <b className="text-[#395877]">Hora:</b>{" "}
                              {metadata.meetingTime}
                            </span>
                          )}
                          {metadata.affectedCount > 1 && (
                            <span>
                              <b className="text-[#395877]">Afectados:</b>{" "}
                              {metadata.affectedCount} reuniones
                            </span>
                          )}
                        </div>
                        {log.undoMessage && (
                          <p className="mt-2 rounded-lg bg-[#FFF8E9] px-3 py-1.5 text-[10px] leading-4 text-[#8A621E]">
                            {log.undoMessage}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 bg-[#FBFDFF] px-3.5 py-3 xl:flex-col xl:items-stretch xl:justify-center">
                        <div className="min-w-0">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#8A9AAF]">
                            Elemento afectado
                          </span>
                          <strong className="mt-1 block truncate text-[11px] text-[#294C72]">
                            {log.targetName ||
                              metadata.meetingTitle ||
                              actionLabel(log.action)}
                          </strong>
                        </div>
                        {reversible ? (
                          <button
                            type="button"
                            onClick={() => handleUndo(log)}
                            disabled={undoingId === log._id}
                            className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-[#BCD4EE] bg-[#EEF6FF] px-3 py-2 text-[11px] font-extrabold text-[#245B91] transition hover:border-[#6EA6DA] hover:bg-[#E2F1FF] disabled:cursor-wait disabled:opacity-60"
                          >
                            {undoingId === log._id ? "Deshaciendo..." : "↩ Deshacer"}
                          </button>
                        ) : (
                          <span className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[10px] font-semibold text-[#94A3B8]">
                            {log.undone ? "Acción restaurada" : "Sin reversión"}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-between border-t border-[#E5EDF6] bg-[#FBFDFF] px-4 py-2.5">
          <button
            type="button"
            className="secondary-button !py-2"
            onClick={() =>
              loadLogs({ requestedPage: page - 1, selectedCircle: circle })
            }
            disabled={page <= 1 || loading}
          >
            ← Anterior
          </button>
          <span className="text-[11px] font-semibold text-[#60758F]">
            Página <strong className="text-[#173C67]">{page}</strong> de{" "}
            <strong className="text-[#173C67]">{pagination.totalPages}</strong>
          </span>
          <button
            type="button"
            className="secondary-button !py-2"
            onClick={() =>
              loadLogs({ requestedPage: page + 1, selectedCircle: circle })
            }
            disabled={page >= pagination.totalPages || loading}
          >
            Siguiente →
          </button>
        </div>
      </div>
    </section>
  );
};

export default Audit;
