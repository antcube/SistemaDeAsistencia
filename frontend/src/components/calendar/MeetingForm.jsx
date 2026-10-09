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

const ALLOWED_MEETING_TYPES = MEETING_TYPES.filter(
  (type) => type !== "ORDINARIA"
);

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
        title: "CÍRCULO DE LIDERAZGO",
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

const getTypeIcon = (type) => {
  switch (type) {
    case "CIRCULO DE LIDERAZGO":
      return "🟨";

    case "HEALTH":
      return "🟩";

    case "MENTORIA":
      return "🟪";

    case "MASTERCLASS":
      return "🔵";

    case "ANUNCIOS CORPORATIVOS":
      return "🟣";

    default:
      return "";
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
        type:
          meeting.type === "ORDINARIA"
            ? "CIRCULO DE LIDERAZGO"
            : meeting.type || "CIRCULO DE LIDERAZGO",
        title: meeting.title || "",
        circles: meeting.circle ? [meeting.circle] : [],
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
              String(circleOptions[index]).trim().toUpperCase()
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

    setForm((current) => {
      const leavingCorporate =
        current.type === "ANUNCIOS CORPORATIVOS" &&
        type !== "ANUNCIOS CORPORATIVOS";

      return {
        ...current,
        type,
        circles:
          type === "ANUNCIOS CORPORATIVOS"
            ? [...circleOptions]
            : leavingCorporate
              ? []
              : current.circles,
        title: getMeetingTitle(type),
        time:
          current.time === "09:00"
            ? suggested.time
            : current.time,
        endTime:
          current.endTime === "10:00"
            ? suggested.endTime
            : current.endTime,
      };
    });

    setError("");
  };

  const toggleCircle = (circle) => {
    if (
      submitting ||
      form.type === "ANUNCIOS CORPORATIVOS"
    ) {
      return;
    }

    setForm((current) => {
      const exists = current.circles.some(
        (item) =>
          String(item).trim().toUpperCase() ===
          String(circle).trim().toUpperCase()
      );

      return {
        ...current,
        circles: exists
          ? current.circles.filter(
              (item) =>
                String(item).trim().toUpperCase() !==
                String(circle).trim().toUpperCase()
            )
          : [...current.circles, circle],
      };
    });

    setError("");
  };

  const toggleWeekday = (weekdayValue) => {
    if (submitting) {
      return;
    }

    setForm((current) => {
      const exists =
        current.weekdays.includes(weekdayValue);

      return {
        ...current,
        weekdays: exists
          ? current.weekdays.filter(
              (item) => item !== weekdayValue
            )
          : [
              ...current.weekdays,
              weekdayValue,
            ],
      };
    });

    setError("");
  };

  const validate = () => {
    if (!form.type) {
      return "Selecciona el tipo de reunión.";
    }

    const effectiveCircles =
      form.type === "ANUNCIOS CORPORATIVOS"
        ? circleOptions
        : form.circles;

    if (!effectiveCircles.length) {
      return "Selecciona al menos un círculo.";
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

      const effectiveCircles =
        form.type === "ANUNCIOS CORPORATIVOS"
          ? [...circleOptions]
          : [...new Set(form.circles)];

      await onSubmit({
        ...form,
        title: getMeetingTitle(form.type),
        host: meeting ? form.host.trim() : "",
        location: meeting
          ? form.location.trim()
          : "",
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

  const selectedCircles =
    form.type === "ANUNCIOS CORPORATIVOS"
      ? circleOptions
      : form.circles;

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/70 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !submitting
        ) {
          onClose();
        }
      }}
    >
      <div className="flex min-h-full items-start justify-center px-3 py-5 sm:px-5 sm:py-7">
        <div className="flex w-full max-w-[760px] flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]">

          <div className="relative overflow-hidden bg-gradient-to-r from-[#0b1f46] via-[#173b7a] to-[#2d5fd1] px-5 py-4 text-white sm:px-6 sm:py-5">

            <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex items-start justify-between gap-4">

              <div className="flex min-w-0 items-start gap-3.5">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xl shadow-inner">
                  {meeting ? "✎" : "+"}
                </div>

                <div className="min-w-0">

                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100/80">
                    Gestión de sesiones
                  </div>

                  <h2 className="mt-1 text-xl font-extrabold leading-tight tracking-tight text-white sm:text-2xl">
                    {meeting
                      ? "Editar Reunión"
                      : "Programar Nueva Reunión"}
                  </h2>

                  <p className="mt-1.5 max-w-xl text-xs leading-5 text-blue-100/85 sm:text-sm">
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
            className="bg-slate-50"
          >

            <div className="max-h-[calc(100vh-210px)] overflow-y-auto">

              <div className="space-y-5 px-4 py-5 sm:px-6">

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

                  <div className="mb-4 flex items-center gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-base text-[#2457c5]">
                      ◈
                    </div>

                    <div>

                      <h3 className="text-sm font-extrabold text-slate-900">
                        Información de la sesión
                      </h3>

                      <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                        Selecciona el formato principal de la reunión.
                      </p>

                    </div>

                  </div>

                  <label className="mb-1.5 block text-[11px] font-bold text-slate-600">
                    Tipo de Reunión{" "}
                    <span className="text-rose-500">
                      *
                    </span>
                  </label>

                  <div className="relative">

                    <select
                      value={form.type}
                      onChange={handleTypeChange}
                      disabled={submitting}
                      className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-xs font-bold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {ALLOWED_MEETING_TYPES.map(
                        (type) => (
                          <option
                            key={type}
                            value={type}
                          >
                            {getTypeIcon(type)}{" "}
                            {getMeetingTitle(type)}
                          </option>
                        )
                      )}
                    </select>

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      ⌄
                    </span>

                  </div>

                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2.5 text-[10px] leading-4 text-blue-700">

                    <span className="mt-px shrink-0">
                      ⓘ
                    </span>

                    <span>
                      El nombre se genera automáticamente según el tipo seleccionado. Los horarios habituales se usan únicamente como sugerencia.
                    </span>

                  </div>

                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

                  <div className="mb-4 flex items-start justify-between gap-3">

                    <div className="flex items-center gap-3">

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-base text-violet-600">
                        ◎
                      </div>

                      <div>

                        <h3 className="text-sm font-extrabold text-slate-900">
                          Círculos convocados
                        </h3>

                        <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                          Define quiénes recibirán esta sesión.
                        </p>

                      </div>

                    </div>

                    <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-700">
                      {selectedCircles.length}{" "}
                      {selectedCircles.length === 1
                        ? "seleccionado"
                        : "seleccionados"}
                    </span>

                  </div>

                  <label className="mb-2 block text-[11px] font-bold text-slate-600">
                    Círculo Convocado{" "}
                    <span className="text-rose-500">
                      *
                    </span>
                  </label>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3.5">

                    <div className="mb-3 flex items-center justify-between gap-3">

                      <div>

                        <div className="text-[11px] font-extrabold text-slate-700">
                          Círculos permitidos
                        </div>

                        <div className="mt-0.5 text-[10px] text-slate-400">
                          Selecciona uno o varios círculos para la sesión.
                        </div>

                      </div>

                      {form.type ===
                        "ANUNCIOS CORPORATIVOS" && (

                        <span className="hidden rounded-full border border-violet-100 bg-white px-2.5 py-1 text-[9px] font-bold text-violet-700 sm:inline-flex">
                          Automático
                        </span>

                      )}

                    </div>

                    {circleOptions.length > 0 ? (

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">

                        {circleOptions.map(
                          (circle) => {

                            const checked =
                              selectedCircles.some(
                                (item) =>
                                  String(item)
                                    .trim()
                                    .toUpperCase() ===
                                  String(circle)
                                    .trim()
                                    .toUpperCase()
                              );

                            return (

                              <button
                                type="button"
                                key={circle}
                                onClick={() =>
                                  toggleCircle(circle)
                                }
                                disabled={
                                  submitting ||
                                  form.type ===
                                    "ANUNCIOS CORPORATIVOS"
                                }
                                className={`flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                                  checked
                                    ? "border-blue-300 bg-blue-50 text-blue-800 shadow-sm"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/40"
                                } ${
                                  submitting ||
                                  form.type ===
                                    "ANUNCIOS CORPORATIVOS"
                                    ? "cursor-default"
                                    : "cursor-pointer"
                                }`}
                              >

                                <span
                                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border text-[11px] font-extrabold ${
                                    checked
                                      ? "border-[#2457c5] bg-[#2457c5] text-white"
                                      : "border-slate-300 bg-white text-transparent"
                                  }`}
                                >
                                  ✓
                                </span>

                                <span className="min-w-0 truncate text-[11px] font-bold">
                                  {circle}
                                </span>

                              </button>

                            );

                          }
                        )}

                      </div>

                    ) : (

                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-400">
                        No hay círculos disponibles.
                      </div>

                    )}

                    {form.type ===
                    "ANUNCIOS CORPORATIVOS" ? (

                      <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-[10px] leading-4 text-violet-700">
                        ✓ Anuncios Corporativos convoca automáticamente a todos los círculos disponibles.
                      </div>

                    ) : (

                      <p className="mt-3 text-[10px] leading-4 text-slate-400">
                        Haz clic sobre cada círculo para seleccionarlo o quitarlo.
                      </p>

                    )}

                  </div>

                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

                  <div className="mb-4 flex items-center gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-base text-emerald-600">
                      ◷
                    </div>

                    <div>

                      <h3 className="text-sm font-extrabold text-slate-900">
                        Programación y horario
                      </h3>

                      <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                        Configura cuándo se realizará la sesión.
                      </p>

                    </div>

                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div>

                      <label className="mb-1.5 block text-[11px] font-bold text-slate-600">
                        Forma de programación
                      </label>

                      <select
                        value={form.scheduleMode}
                        onChange={(event) =>
                          updateField(
                            "scheduleMode",
                            event.target.value
                          )
                        }
                        disabled={
                          submitting || !!meeting
                        }
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >

                        <option value="DATE">
                          📅 Una fecha
                        </option>

                        <option value="WEEKDAYS">
                          🔁 Días de la semana
                        </option>

                      </select>

                    </div>

                    <div>

                      <label className="mb-1.5 block text-[11px] font-bold text-slate-600">

                        {form.scheduleMode ===
                        "WEEKDAYS"
                          ? "Mes de inicio"
                          : "Fecha"}{" "}

                        <span className="text-rose-500">
                          *
                        </span>

                      </label>

                      <input
                        type="date"
                        value={form.date}
                        onChange={(event) =>
                          updateField(
                            "date",
                            event.target.value
                          )
                        }
                        disabled={submitting}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10"
                      />

                    </div>

                  </div>

                  {form.scheduleMode === "WEEKDAYS" && (

                    <div className="mt-4">

                      <label className="mb-2 block text-[11px] font-bold text-slate-600">
                        Días a repetir{" "}
                        <span className="text-rose-500">
                          *
                        </span>
                      </label>

                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4">

                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                          <div>

                            <div className="text-[11px] font-extrabold text-slate-700">
                              Días seleccionados
                            </div>

                            <div className="mt-0.5 text-[10px] text-slate-400">
                              Selecciona uno o varios días para repetir la sesión.
                            </div>

                          </div>

                          <span className="shrink-0 self-start rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[9px] font-extrabold text-emerald-700">
                            {form.weekdays.length}{" "}
                            {form.weekdays.length === 1
                              ? "día"
                              : "días"}
                          </span>

                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

                          {WEEKDAYS.map((weekday) => {

                            const selected =
                              form.weekdays.includes(
                                weekday.value
                              );

                            return (

                              <button
                                key={weekday.value}
                                type="button"
                                disabled={submitting}
                                onClick={() =>
                                  toggleWeekday(
                                    weekday.value
                                  )
                                }
                                className={`flex min-h-[56px] items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                                  selected
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/40"
                                } ${
                                  submitting
                                    ? "cursor-not-allowed opacity-60"
                                    : "cursor-pointer"
                                }`}
                              >

                                <span
                                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border text-[10px] font-extrabold ${
                                    selected
                                      ? "border-emerald-600 bg-emerald-600 text-white"
                                      : "border-slate-300 bg-white text-transparent"
                                  }`}
                                >
                                  ✓
                                </span>

                                <span className="flex-1 whitespace-normal break-words text-[11px] font-bold leading-tight">
                                  {weekday.label}
                                </span>

                              </button>

                            );

                          })}

                        </div>

                        <p className="mt-4 text-[10px] leading-4 text-slate-400">
                          Se crearán las reuniones correspondientes del mes y la programación continuará en los meses siguientes.
                        </p>

                      </div>

                    </div>

                  )}

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div>

                      <label className="mb-1.5 block text-[11px] font-bold text-slate-600">
                        Hora de inicio
                      </label>

                      <div className="relative">

                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          ◷
                        </span>

                        <input
                          type="time"
                          value={form.time}
                          onChange={(event) =>
                            updateField(
                              "time",
                              event.target.value
                            )
                          }
                          disabled={submitting}
                          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs font-bold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#2457c5] focus:bg-white focus:ring-4 focus:ring-[#2457c5]/10"
                        />

                      </div>

                    </div>

                    <div>

                      <label className="mb-1.5 block text-[11px] font-bold text-slate-600">
                        Hora de término
                      </label>

                      <div className="relative">

                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          ◷
                        </span>

                        <input
                          type="time"
                          value={form.endTime}
                          onChange={(event) =>
                            updateField(
                              "endTime",
                              event.target.value
                            )
                          }
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

                  <div className="grid gap-3 px-4 py-3.5 sm:grid-cols-4">

                    <div>

                      <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Tipo
                      </span>

                      <strong className="mt-1 block truncate text-xs text-slate-800">
                        {getTypeIcon(form.type)}{" "}
                        {getMeetingTitle(
                          form.type
                        ) || "—"}
                      </strong>

                    </div>

                    <div>

                      <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Círculos
                      </span>

                      <strong className="mt-1 block text-xs text-slate-800">
                        {selectedCircles.length}
                      </strong>

                    </div>

                    <div>

                      <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Fecha
                      </span>

                      <strong className="mt-1 block text-xs text-slate-800">
                        {form.date || "—"}
                      </strong>

                    </div>

                    <div>

                      <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Horario
                      </span>

                      <strong className="mt-1 block text-xs text-slate-800">
                        {form.time || "—"} -{" "}
                        {form.endTime || "—"}
                      </strong>

                    </div>

                  </div>

                </section>

                {error && (

                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-semibold text-rose-700">

                    <span className="mt-px">
                      !
                    </span>

                    <span>
                      {error}
                    </span>

                  </div>

                )}

              </div>

            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur sm:px-6">

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 rounded-xl bg-gradient-to-r from-[#173b7a] to-[#2457c5] px-6 text-xs font-extrabold text-white shadow-[0_8px_20px_rgba(36,87,197,0.25)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Guardando..."
                    : meeting
                      ? "Guardar Cambios"
                      : "Programar Reunión"}
                </button>

              </div>

            </div>

          </form>

        </div>
      </div>
    </div>
  );
};

export default MeetingForm;