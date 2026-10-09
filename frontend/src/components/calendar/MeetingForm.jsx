import { useEffect, useMemo, useState } from "react";
import { MEETING_TYPES, WEEKDAYS } from "../../constants/meetings";

const EMPTY_FORM = {
  type: "CIRCULO DE LIDERAZGO",
  title: "CÍRCULO DE LIDERAZGO",
  circles: [],
  host: "",
  scheduleMode: "DATE",
  date: "",
  weekdays: [],
  time: "09:00",
  endTime: "10:00",
  location: "",
};

const getCircleName = (circle) => {
  if (typeof circle === "string") return circle;
  return circle?.name || "";
};

const getToday = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getMeetingTitle = (type) => {
  switch (type) {
    case "HEALTH":
      return "HEALTH";
    case "MENTORIA":
      return "MENTORÍA";
    case "MASTERCLASS":
      return "MASTERCLASS";
    case "ANUNCIOS CORPORATIVOS":
      return "ANUNCIOS CORPORATIVOS";
    case "CIRCULO DE LIDERAZGO":
      return "CÍRCULO DE LIDERAZGO";
    default:
      return String(type || "").trim();
  }
};

const getSuggestedValues = (type) => {
  switch (type) {
    case "HEALTH":
      return {
        title: "HEALTH",
        time: "19:00",
        endTime: "20:00",
      };

    case "MENTORIA":
      return {
        title: "MENTORÍA",
        time: "20:00",
        endTime: "21:00",
      };

    case "MASTERCLASS":
      return {
        title: "MASTERCLASS",
        time: "19:00",
        endTime: "20:00",
      };

    case "ANUNCIOS CORPORATIVOS":
      return {
        title: "ANUNCIOS CORPORATIVOS",
        time: "09:00",
        endTime: "10:00",
      };

    case "CIRCULO DE LIDERAZGO":
      return {
        title: "",
        time: "09:00",
        endTime: "10:00",
      };

    default:
      return {
        title: "",
        time: "09:00",
        endTime: "10:00",
      };
  }
};

const MeetingForm = ({
  open,
  circles = [],
  meeting = null,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const circleOptions = useMemo(
    () =>
      circles
        .map(getCircleName)
        .map((name) => String(name).trim())
        .filter(Boolean)
        .filter(
          (name, index, array) =>
            array.findIndex(
              (item) =>
                String(item).trim().toUpperCase() ===
                String(name).trim().toUpperCase()
            ) === index
        ),
    [circles]
  );

  useEffect(() => {
    if (!open) return;

    if (meeting) {
      setForm({
        type: meeting.type || "CIRCULO DE LIDERAZGO",
        title: meeting.title || "",
        circles: meeting.circle
          ? [meeting.circle]
          : [],
        host: meeting.host || "",
        scheduleMode: "DATE",
        date: meeting.date || getToday(),
        weekdays: [],
        time: meeting.time || "09:00",
        endTime: meeting.endTime || "10:00",
        location:
          meeting.location ||
          "Sala Magna / Enlace Virtual",
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        date: getToday(),
      });
    }

    setError("");
    setSubmitting(false);
  }, [open, meeting]);

  /*
   * ============================================================
   * ANUNCIOS CORPORATIVOS
   * ============================================================
   *
   * Cuando el tipo es corporativo, todos los círculos disponibles
   * quedan seleccionados automáticamente.
   *
   * Esto también cubre el caso en que el formulario se abre antes
   * de que los círculos terminen de cargarse desde MongoDB.
   */
  useEffect(() => {
    if (!open || meeting) return;

    if (
      form.type === "ANUNCIOS CORPORATIVOS" &&
      circleOptions.length > 0
    ) {
      setForm((current) => {
        const sameCircles =
          current.circles.length === circleOptions.length &&
          current.circles.every(
            (circle, index) =>
              String(circle).trim().toUpperCase() ===
              String(circleOptions[index])
                .trim()
                .toUpperCase()
          );

        if (sameCircles) {
          return current;
        }

        return {
          ...current,
          circles: [...circleOptions],
        };
      });
    }
  }, [
    open,
    meeting,
    form.type,
    circleOptions,
  ]);

  if (!open) return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleTypeChange = (event) => {
    const type = event.target.value;
    const suggested = getSuggestedValues(type);

    setForm((current) => ({
      ...current,

      type,

      /*
       * ANUNCIOS CORPORATIVOS:
       * automáticamente todos los círculos.
       */
      circles:
        type === "ANUNCIOS CORPORATIVOS"
          ? [...circleOptions]
          : current.circles,

      /*
       * El título queda automáticamente definido
       * según el tipo.
       */
      title: getMeetingTitle(type),

      time:
        current.time === "09:00"
          ? suggested.time
          : current.time,

      endTime:
        current.endTime === "10:00"
          ? suggested.endTime
          : current.endTime,
    }));
  };

  const handleCircleChange = (event) => {
    const selected = Array.from(
      event.target.selectedOptions
    ).map((option) => option.value);

    updateField("circles", selected);
  };

  const handleWeekdayChange = (event) => {
    const selected = Array.from(
      event.target.selectedOptions
    )
      .map((option) => Number(option.value))
      .filter(Number.isInteger);

    updateField("weekdays", selected);
  };

  const validate = () => {
    if (!form.type) {
      return "Selecciona el tipo de reunión.";
    }

    /*
     * Para ANUNCIOS CORPORATIVOS no exigimos una selección
     * manual porque el sistema utiliza automáticamente todos
     * los círculos disponibles.
     */
    const effectiveCircles =
      form.type === "ANUNCIOS CORPORATIVOS"
        ? circleOptions
        : form.circles;

    if (!effectiveCircles.length) {
      return "No hay círculos disponibles.";
    }

    if (!form.date) {
      return "Selecciona la fecha o el mes de la programación.";
    }

    if (
      form.scheduleMode === "WEEKDAYS" &&
      !form.weekdays.length
    ) {
      return "Selecciona al menos un día de la semana.";
    }

    if (!form.time) {
      return "Selecciona la hora de inicio.";
    }

    if (
      form.endTime &&
      form.time &&
      form.endTime <= form.time
    ) {
      return "La hora de término debe ser posterior a la hora de inicio.";
    }

    /*
     * Todos los tipos tienen título automático.
     */

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      /*
       * ANUNCIOS CORPORATIVOS:
       * siempre enviamos TODOS los círculos actuales.
       */
      const effectiveCircles =
        form.type === "ANUNCIOS CORPORATIVOS"
          ? [...circleOptions]
          : [...new Set(form.circles)];

      await onSubmit({
        ...form,

        // El nombre se obtiene automáticamente del tipo de reunión.
        title: getMeetingTitle(form.type),

        // En una nueva reunión estos campos quedan vacíos.
        // Si se edita una reunión existente, se conservan.
        host: meeting ? form.host.trim() : "",
        location: meeting ? form.location.trim() : "",

        circles: effectiveCircles,

        weekdays: [
          ...new Set(form.weekdays),
        ].sort((a, b) => a - b),
      });
    } catch (err) {
      setError(
        err?.message ||
          "No se pudo programar la reunión."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[94px] z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[calc(100vh-118px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.30)]">
        <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-r from-[#0b1f46] via-[#153a78] to-[#2457c5] px-6 py-5 text-white sm:px-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 left-28 h-40 w-40 rounded-full bg-cyan-300/10 blur-2xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl shadow-inner">
                {meeting ? "✎" : "+"}
              </div>

              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100/80">
                  Gestión de sesiones
                </div>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight text-white sm:text-xl">
                  {meeting ? "Editar Reunión" : "Programar Nueva Reunión"}
                </h2>
                <p className="mt-1 max-w-xl text-[11px] leading-5 text-blue-100/80 sm:text-xs">
                  Define el tipo, los círculos convocados y el horario de la sesión.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-xl leading-none text-white/80 transition hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto bg-slate-50/70"
        >
          <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-base text-[#2457c5]">
                  ◈
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Información de la sesión</h3>
                  <p className="mt-0.5 text-[10px] text-slate-400">Selecciona el formato principal de la reunión.</p>
                </div>
              </div>

              <label className="mb-1.5 block text-[11px] font-bold text-slate-600">
                Tipo de Reunión <span className="text-rose-500">*</span>
              </label>

              <div className="relative">
                <select
                  value={form.type}
                  onChange={handleTypeChange}
                  disabled={submitting}
                  className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-xs font-bold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {MEETING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type === "CIRCULO DE LIDERAZGO"
                        ? "🟨 CÍRCULO DE LIDERAZGO"
                        : type === "HEALTH"
                        ? "🟩 HEALTH"
                        : type === "MENTORIA"
                        ? "🟪 MENTORÍA"
                        : type === "MASTERCLASS"
                        ? "🔵 MASTERCLASS"
                        : type === "ANUNCIOS CORPORATIVOS"
                        ? "🟣 ANUNCIOS CORPORATIVOS"
                        : "Reunión"}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">⌄</span>
              </div>

              <div className="mt-2 flex items-start gap-2 rounded-xl bg-blue-50/70 px-3 py-2.5 text-[10px] leading-4 text-blue-700">
                <span className="mt-px">ⓘ</span>
                <span>El nombre se genera automáticamente según el tipo seleccionado. Los horarios habituales se usan únicamente como sugerencia.</span>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-base text-violet-600">
                    ◎
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Círculos convocados</h3>
                    <p className="mt-0.5 text-[10px] text-slate-400">Define quiénes recibirán esta sesión.</p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-700">
                  {form.type === "ANUNCIOS CORPORATIVOS" ? circleOptions.length : form.circles.length} seleccionados
                </span>
              </div>

              <label className="mb-1.5 block text-[11px] font-bold text-slate-600">
                Círculo Convocado <span className="text-rose-500">*</span>
              </label>

              <select
                multiple
                size={5}
                value={form.type === "ANUNCIOS CORPORATIVOS" ? circleOptions : form.circles}
                onChange={handleCircleChange}
                disabled={submitting || form.type === "ANUNCIOS CORPORATIVOS"}
                className="min-h-[132px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              >
                {circleOptions.map((circle) => (
                  <option key={circle} value={circle} className="rounded-md py-1.5">
                    {circle}
                  </option>
                ))}
              </select>

              {form.type === "ANUNCIOS CORPORATIVOS" ? (
                <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-[10px] font-medium leading-4 text-indigo-700">
                  ✓ Anuncios Corporativos se aplica automáticamente a todos los círculos disponibles.
                </div>
              ) : (
                <p className="mt-2 text-[10px] leading-4 text-slate-400">
                  Mantén Ctrl en Windows o Cmd en Mac para seleccionar varios círculos.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-base text-emerald-600">
                  ◷
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Programación y horario</h3>
                  <p className="mt-0.5 text-[10px] text-slate-400">Configura cuándo se realizará la sesión.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-slate-600">Forma de programación</label>
                  <select
                    value={form.scheduleMode}
                    onChange={(event) => updateField("scheduleMode", event.target.value)}
                    disabled={submitting || !!meeting}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="DATE">📅 Una fecha</option>
                    <option value="WEEKDAYS">🔁 Días de la semana</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-slate-600">
                    {form.scheduleMode === "WEEKDAYS" ? "Mes de inicio" : "Fecha"} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => updateField("date", event.target.value)}
                    disabled={submitting}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10"
                  />
                </div>
              </div>

              {form.scheduleMode === "WEEKDAYS" && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-[11px] font-bold text-slate-600">
                    Días a repetir <span className="text-rose-500">*</span>
                  </label>
                  <select
                    multiple
                    size={4}
                    value={form.weekdays.map(String)}
                    onChange={handleWeekdayChange}
                    disabled={submitting}
                    className="min-h-[112px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10"
                  >
                    {WEEKDAYS.map((weekday) => (
                      <option key={weekday.value} value={weekday.value} className="py-1.5">
                        {weekday.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[10px] leading-4 text-slate-400">
                    Se crearán las reuniones correspondientes del mes y la programación continuará en los meses siguientes.
                  </p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-slate-600">Hora de inicio</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">◷</span>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(event) => updateField("time", event.target.value)}
                      disabled={submitting}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs font-bold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-slate-600">Hora de término</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">◷</span>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(event) => updateField("endTime", event.target.value)}
                      disabled={submitting}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs font-bold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="border-b border-blue-100/70 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-blue-700">
                Resumen de la sesión
              </div>
              <div className="grid gap-3 px-4 py-3.5 sm:grid-cols-3">
                <div>
                  <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">Tipo</span>
                  <strong className="mt-1 block truncate text-xs text-slate-800">{getMeetingTitle(form.type) || "—"}</strong>
                </div>
                <div>
                  <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">Fecha</span>
                  <strong className="mt-1 block text-xs text-slate-800">{form.date || "—"}</strong>
                </div>
                <div>
                  <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">Horario</span>
                  <strong className="mt-1 block text-xs text-slate-800">{form.time || "—"} - {form.endTime || "—"}</strong>
                </div>
              </div>
            </section>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-semibold text-rose-700">
                <span className="mt-px">!</span>
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-7">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-xl bg-gradient-to-r from-[#173b7a] to-[#2457c5] px-6 text-xs font-extrabold text-white shadow-[0_8px_20px_rgba(36,87,197,0.25)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Guardando..." : meeting ? "Guardar Cambios" : "Programar Reunión"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingForm;