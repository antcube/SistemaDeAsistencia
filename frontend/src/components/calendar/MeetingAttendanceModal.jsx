import { useEffect, useMemo, useState } from "react";

import attendanceService from "../../services/attendanceService";
import meetingService from "../../services/meetingService";
import { useAuth } from "../../context/AuthContext";

const STATUS_OPTIONS = [
  { value: "No asistió", label: "❌ No asistió" },
  { value: "Asistió", label: "✅ Asistió" },
  { value: "Clase Presencial", label: "🏫 Clase Presencial" },
  { value: "Justificado", label: "📝 Justificado" },
];

const normalizeStatus = (status) =>
  String(status || "").trim() === "Faltó" ? "No asistió" : status || "No asistió";

const statusBadge = (status) => {
  const value = normalizeStatus(status);
  if (value === "Asistió") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value === "Clase Presencial") return "bg-sky-50 text-sky-700 border-sky-200";
  if (value === "Justificado") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
};

const statusIcon = (status) => {
  const value = normalizeStatus(status);
  if (value === "Asistió") return "✓";
  if (value === "Clase Presencial") return "P";
  if (value === "Justificado") return "J";
  return "✕";
};

const formatTime12 = (value) => {
  const [rawHour = "0", minutes = "00"] = String(value || "00:00").split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour)) return value || "—";
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
};

const getMember = (row) => row?.user || row;

const MeetingAttendanceModal = ({
  meeting,
  open,
  onClose,
  onRefresh,
}) => {
  const { admin } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editingRow, setEditingRow] = useState(null);
  const [newStatus, setNewStatus] = useState("No asistió");
  const [note, setNote] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrMeeting, setQrMeeting] = useState(meeting);
  const [qrTick, setQrTick] = useState(Date.now());

  const isModerator = String(admin?.role || "").trim() === "Moderador";
  const isMainAdmin = String(admin?.adminId || "").trim() === "ADM-001";
  const isCircleManager = String(admin?.role || "").trim() === "Gestor de Círculo";
  const canManageAttendance = isMainAdmin || isCircleManager;

  const loadAttendance = async () => {
    if (!meeting?._id) return;
    try {
      setLoading(true);
      setError("");
      const response = await attendanceService.getMeetingAttendance(meeting._id);
      const data = response?.data || response;
      setRows(Array.isArray(data?.attendance) ? data.attendance : Array.isArray(data) ? data : []);
      if (data?.meeting) setQrMeeting(data.meeting);
    } catch (err) {
      console.error("Error cargando acta:", err);
      setError(err?.message || "No se pudo cargar la asistencia de la reunión.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !meeting?._id) return;
    setSearch("");
    setEditingRow(null);
    setQrOpen(false);
    setQrMeeting(meeting);
    loadAttendance();
  }, [open, meeting?._id]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setInterval(() => setQrTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const member = getMember(row);
      return [member?.name, member?.doc, member?.username, member?.job]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let justified = 0;
    rows.forEach((row) => {
      const status = normalizeStatus(row.status);
      if (status === "Asistió" || status === "Clase Presencial") present += 1;
      else if (status === "Justificado") justified += 1;
      else absent += 1;
    });
    return { total: rows.length, present, absent, justified };
  }, [rows]);

  const qrIsActive = Boolean(
    qrMeeting?.qrActive &&
    qrMeeting?.qrEndTimestamp &&
    new Date(qrMeeting.qrEndTimestamp).getTime() > qrTick
  );

  const qrRemaining = qrIsActive
    ? Math.max(0, new Date(qrMeeting.qrEndTimestamp).getTime() - qrTick)
    : 0;

  const qrMinutes = Math.floor(qrRemaining / 60000);
  const qrSeconds = Math.floor((qrRemaining % 60000) / 1000);
  const qrTime = `${String(qrMinutes).padStart(2, "0")}:${String(qrSeconds).padStart(2, "0")}`;

  const publicUrl = meeting?._id
    ? `${window.location.origin}/asistencia?asistencia_qr=${encodeURIComponent(meeting._id)}`
    : "";

  const openStatusEditor = (row) => {
    setEditingRow(row);
    setNewStatus(normalizeStatus(row.status));
    setNote(row.justificationReason || row.note || "");
    setError("");
  };

  const saveStatus = async () => {
    if (!editingRow || !meeting?._id || !canManageAttendance) return;
    const member = getMember(editingRow);
    const userId = member?._id || member?.id;
    if (!userId) {
      setError("No se encontró el identificador del miembro.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await attendanceService.registerAttendance({
        meetingId: meeting._id,
        userId,
        status: newStatus,
        note: note.trim(),
        justificationReason: newStatus === "Justificado" ? note.trim() : "",
        source: "ADMIN",
        attendanceMode: newStatus === "Clase Presencial" ? "PRESENCIAL" : "MANUAL",
      });
      setEditingRow(null);
      setNote("");
      await loadAttendance();
      onRefresh?.();
    } catch (err) {
      console.error("Error actualizando asistencia:", err);
      setError(err?.message || "No se pudo actualizar la asistencia.");
    } finally {
      setSaving(false);
    }
  };

  const activateQr = async () => {
    if (!meeting?._id || !canManageAttendance) return;
    try {
      setQrLoading(true);
      setError("");
      const response = await meetingService.activateQr(meeting._id, 10);
      const data = response?.data || response;
      setQrMeeting(data?.meeting || { ...meeting, qrActive: true, qrEndTimestamp: new Date(Date.now() + 10 * 60000).toISOString() });
      setQrOpen(true);
      await loadAttendance();
      onRefresh?.();
    } catch (err) {
      console.error("Error activando QR:", err);
      setError(err?.message || "No se pudo activar el QR de asistencia.");
    } finally {
      setQrLoading(false);
    }
  };

  const deactivateQr = async () => {
    if (!meeting?._id || !canManageAttendance) return;
    try {
      setQrLoading(true);
      await meetingService.deactivateQr(meeting._id);
      setQrMeeting((current) => ({ ...current, qrActive: false, qrEndTimestamp: new Date().toISOString() }));
      await loadAttendance();
      onRefresh?.();
    } catch (err) {
      setError(err?.message || "No se pudo desactivar el QR.");
    } finally {
      setQrLoading(false);
    }
  };

  const copyQr = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      // El enlace también está visible para copiarlo manualmente.
    }
  };

  if (!open || !meeting) return null;

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
        <div className="flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                  {meeting.circle || "Círculo"}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {meeting.date} · {formatTime12(meeting.time)}
                </span>
              </div>
              <h3 className="mt-1 text-lg font-bold text-slate-900">{meeting.title || meeting.type}</h3>
              <p className="text-xs text-slate-500">
                Moderador: {meeting.host || "-"} | Ubicación: {meeting.location || "-"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={loadAttendance}
                disabled={loading || saving}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                🔄 Actualizar
              </button>
              {isMainAdmin && (
                <button
                  type="button"
                  onClick={() => meetingService.deleteMeeting(meeting._id).then(() => { onClose?.(); onRefresh?.(); }).catch((err) => setError(err?.message || "No se pudo eliminar la sesión."))}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  🗑️ Eliminar Sesión
                </button>
              )}
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 text-center">
            <div><span className="block text-[11px] font-semibold uppercase text-slate-500">Inscritos</span><span className="text-base font-bold text-slate-800">{stats.total}</span></div>
            <div><span className="block text-[11px] font-semibold uppercase text-emerald-600">Asistieron</span><span className="text-base font-bold text-emerald-600">{stats.present}</span></div>
            <div><span className="block text-[11px] font-semibold uppercase text-rose-600">No asistieron</span><span className="text-base font-bold text-rose-600">{stats.absent}</span></div>
            <div><span className="block text-[11px] font-semibold uppercase text-amber-600">Justificados</span><span className="text-base font-bold text-amber-600">{stats.justified}</span></div>
          </div>

          {canManageAttendance && (
            <div className={`mx-6 mt-4 rounded-xl border p-3 ${qrIsActive ? "border-emerald-200 bg-emerald-50/90" : "border-indigo-100 bg-indigo-50"}`}>
              {qrIsActive ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-emerald-950">📱 QR Activo · Tiempo disponible: <span className="font-mono text-sm text-emerald-700">{qrTime}</span></div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="min-w-0 truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600">{publicUrl}</span>
                      <button type="button" onClick={copyQr} className="shrink-0 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800">📋 Copiar</button>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setQrOpen(true)} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700">🔍 Ver QR</button>
                    <button type="button" onClick={deactivateQr} disabled={qrLoading} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Desactivar</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-medium text-indigo-950"><strong>📱 Control Autónomo por QR:</strong> Mientras no se use el QR, todos figuran como “No asistió”.</div>
                  <button type="button" onClick={activateQr} disabled={qrLoading} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{qrLoading ? "Activando..." : "📱 Generar QR de Asistencia"}</button>
                </div>
              )}
            </div>
          )}

          <div className="px-6 pt-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, DNI, usuario o rango..."
                className="h-10 w-full rounded-lg border border-[#c8d4e5] bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15"
              />
            </div>
          </div>

          {error && <div className="mx-6 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <table className="w-full border border-slate-200 text-left text-xs text-slate-600">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 font-semibold text-slate-700">
                <tr><th className="p-3">Miembro</th><th className="p-3">Estado de Asistencia</th><th className="p-3">Observación / Sustento</th><th className="p-3 text-right">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="4" className="p-10 text-center">Cargando asistencia...</td></tr>
                ) : !filteredRows.length ? (
                  <tr><td colSpan="4" className="p-10 text-center text-slate-400">No se encontraron miembros.</td></tr>
                ) : filteredRows.map((row) => {
                  const member = getMember(row);
                  return (
                    <tr key={String(member?._id || member?.id || row._id)} className="hover:bg-slate-50">
                      <td className="p-3"><div className="font-bold text-slate-900">{member?.name || "Sin nombre"}</div><div className="font-mono text-[11px] text-slate-400">DNI: {member?.doc || "S/D"} · Rango: {member?.job || "Miembro"}</div></td>
                      <td className="p-3"><span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold ${statusBadge(row.status)}`}><span>{statusIcon(row.status)}</span>{normalizeStatus(row.status)}</span>{row.attendanceMode === "QR" && <div className="mt-1 text-[10px] font-bold text-emerald-600">QR</div>}</td>
                      <td className="p-3 text-xs text-slate-500">{row.justificationReason || row.note || "-"}</td>
                      <td className="p-3 text-right">{!canManageAttendance ? <span className="text-xs text-slate-400">Lectura</span> : <button type="button" onClick={() => openStatusEditor(row)} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">✏️ Cambiar Estado</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t border-slate-100 px-6 py-3">
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900">Cerrar Acta</button>
          </div>
        </div>
      </div>

      {editingRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between"><div><h3 className="text-base font-bold text-slate-900">Cambiar Estado de Asistencia</h3><p className="mt-1 text-xs text-slate-500">{getMember(editingRow)?.name || "Miembro"}</p></div><button type="button" onClick={() => setEditingRow(null)} className="text-slate-400">✕</button></div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Estado de Asistencia</label>
            <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)} className="mb-4 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium outline-none focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15">
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label className="mb-1 block text-xs font-semibold text-slate-700">{newStatus === "Justificado" ? "Motivo / Sustento" : "Observación"}</label>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={newStatus === "Justificado" ? "Ej. permiso laboral, descanso médico..." : "Observación opcional..."} rows={3} className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15" />
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditingRow(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Cancelar</button><button type="button" onClick={saveStatus} disabled={saving} className="rounded-lg bg-[#173b7a] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar Cambio"}</button></div>
          </div>
        </div>
      )}

      {qrOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><h3 className="text-base font-bold text-slate-900">QR de Asistencia</h3><p className="mt-1 text-xs text-slate-500">{meeting.title || meeting.type} · {meeting.circle}</p></div><button type="button" onClick={() => setQrOpen(false)} className="text-slate-400">✕</button></div>
            {qrIsActive ? <div className="mt-4 text-center"><div className="mx-auto mb-3 flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white p-3"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}`} alt="QR de asistencia" className="h-[200px] w-[200px]" /></div><div className="text-sm font-extrabold text-emerald-700">⏱️ Tiempo restante: {qrTime}</div><div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[10px] text-slate-600 break-all">{publicUrl}</div><button type="button" onClick={copyQr} className="mt-3 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800">📋 Copiar enlace</button></div> : <div className="py-10 text-center text-sm text-slate-500">El QR está inactivo o expirado.</div>}
            <div className="mt-5 flex justify-end"><button type="button" onClick={() => setQrOpen(false)} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white">Cerrar</button></div>
          </div>
        </div>
      )}
    </>
  );
};

export default MeetingAttendanceModal;
