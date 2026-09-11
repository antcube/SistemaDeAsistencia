import { useEffect, useMemo, useState } from "react";
import { MEETING_TYPES, WEEKDAYS } from "../../constants/meetings";

const EMPTY_FORM = {
  type: "CIRCULO DE LIDERAZGO",
  title: "",
  circles: [],
  host: "",
  scheduleMode: "DATE",
  date: "",
  weekdays: [],
  time: "09:00",
  endTime: "10:00",
  location: "Sala Magna / Enlace Virtual",
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
      title:
        type === "ANUNCIOS CORPORATIVOS"
          ? "ANUNCIOS CORPORATIVOS"
          : type === "HEALTH"
          ? "HEALTH"
          : type === "MENTORIA"
          ? "MENTORÍA"
          : type === "MASTERCLASS"
          ? "MASTERCLASS"
          : type === "CIRCULO DE LIDERAZGO"
          ? "CÍRCULO DE LIDERAZGO"
          : current.title || suggested.title,

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

    if (!form.host.trim()) {
      return "Completa el campo Moderador / Líder.";
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
    if (!form.title.trim()) {
      return "Completa el título de la reunión.";
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

        title:
          form.type === "ANUNCIOS CORPORATIVOS"
            ? "ANUNCIOS CORPORATIVOS"
            : form.type === "HEALTH"
            ? "HEALTH"
            : form.type === "MENTORIA"
            ? "MENTORÍA"
            : form.type === "MASTERCLASS"
            ? "MASTERCLASS"
            : form.type === "CIRCULO DE LIDERAZGO"
            ? "CÍRCULO DE LIDERAZGO"
            : form.title.trim(),

        host: form.host.trim(),

        location: form.location.trim(),

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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !submitting
        ) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">
            {meeting
              ? "Editar Reunión"
              : "Programar Nueva Reunión"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1 text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[calc(100vh-110px)] overflow-y-auto px-6 py-5"
        >
          <div className="space-y-4 text-xs">
            {/* TIPO */}
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Tipo de Reunión{" "}
                <span className="text-rose-500">*</span>
              </label>

              <select
                value={form.type}
                onChange={handleTypeChange}
                disabled={submitting}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none transition focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15"
              >
                {MEETING_TYPES.map((type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type === "CIRCULO DE LIDERAZGO"
                      ? "🟨 CÍRCULO DE LIDERAZGO"
                      : type === "HEALTH"
                      ? "🟩 HEALTH"
                      : type === "MENTORIA"
                      ? "🟪 MENTORÍA"
                      : type === "MASTERCLASS"
                      ? "🔵 MASTERCLASS"
                      : type ===
                        "ANUNCIOS CORPORATIVOS"
                      ? "🟣 ANUNCIOS CORPORATIVOS"
                      : "Reunión"}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-[10px] leading-4 text-slate-400">
                Las sesiones pueden programarse en cualquier día y
                hora. Los horarios habituales solo se usan como
                sugerencia.
              </p>
            </div>

            {/* TITULO */}
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Título de la Reunión{" "}
                <span className="text-rose-500">*</span>
              </label>

              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  updateField(
                    "title",
                    event.target.value
                  )
                }
                disabled={
                  submitting ||
                  form.type === "ANUNCIOS CORPORATIVOS"
                }
                placeholder="Nombre de la sesión"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15 disabled:bg-slate-50"
              />

              <p className="mt-1 text-[10px] text-slate-400">
                El nombre se establece automáticamente según el tipo
                de reunión.
              </p>
            </div>

            {/* CIRCULOS + HOST */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Círculo Convocado{" "}
                  <span className="text-rose-500">*</span>
                </label>

                <select
                  multiple
                  size={5}
                  value={
                    form.type ===
                    "ANUNCIOS CORPORATIVOS"
                      ? circleOptions
                      : form.circles
                  }
                  onChange={handleCircleChange}
                  disabled={
                    submitting ||
                    form.type ===
                      "ANUNCIOS CORPORATIVOS"
                  }
                  className="min-h-[120px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15 disabled:bg-slate-50"
                >
                  {circleOptions.map((circle) => (
                    <option
                      key={circle}
                      value={circle}
                    >
                      {circle}
                    </option>
                  ))}
                </select>

                {form.type ===
                "ANUNCIOS CORPORATIVOS" ? (
                  <p className="mt-1 text-[10px] leading-4 text-indigo-600">
                    Esta reunión se aplica automáticamente a todos los
                    círculos disponibles.
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    Puedes seleccionar uno o varios círculos.
                    Usa Ctrl/Cmd para seleccionar varios.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Moderador / Líder{" "}
                  <span className="text-rose-500">*</span>
                </label>

                <input
                  type="text"
                  value={form.host}
                  onChange={(event) =>
                    updateField(
                      "host",
                      event.target.value
                    )
                  }
                  disabled={submitting}
                  placeholder="Moderador"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none transition focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15"
                />
              </div>
            </div>

            {/* FORMA + FECHA */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none transition focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15 disabled:bg-slate-50"
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
                <label className="mb-1 block font-semibold text-slate-700">
                  {form.scheduleMode ===
                  "WEEKDAYS"
                    ? "Mes de inicio"
                    : "Fecha"}{" "}
                  <span className="text-rose-500">*</span>
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none transition focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15"
                />

                {form.scheduleMode ===
                  "WEEKDAYS" && (
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                    Se usará el mes de esta fecha para crear las
                    reuniones iniciales.
                  </p>
                )}
              </div>
            </div>

            {/* DIAS */}
            {form.scheduleMode ===
              "WEEKDAYS" && (
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Días a repetir{" "}
                  <span className="text-rose-500">*</span>
                </label>

                <select
                  multiple
                  size={4}
                  value={form.weekdays.map(
                    String
                  )}
                  onChange={
                    handleWeekdayChange
                  }
                  disabled={submitting}
                  className="min-h-[110px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15"
                >
                  {WEEKDAYS.map(
                    (weekday) => (
                      <option
                        key={
                          weekday.value
                        }
                        value={
                          weekday.value
                        }
                      >
                        {weekday.label}
                      </option>
                    )
                  )}
                </select>

                <p className="mt-1 text-[10px] leading-4 text-slate-400">
                  Selecciona uno o varios días. Se crearán las
                  reuniones correspondientes del mes y la
                  programación continuará en los meses siguientes.
                </p>
              </div>
            )}

            {/* HORAS */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Hora de inicio
                </label>

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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none transition focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Hora de término
                </label>

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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none transition focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15"
                />
              </div>
            </div>

            {/* UBICACION */}
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Ubicación o Enlace Virtual
              </label>

              <input
                type="text"
                value={form.location}
                onChange={(event) =>
                  updateField(
                    "location",
                    event.target.value
                  )
                }
                disabled={submitting}
                placeholder="Ej. Sala Magna / meet.google.com/..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15"
              />
            </div>

            {/* ERROR */}
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
                {error}
              </div>
            )}

            {/* BOTONES */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#173b7a] px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#2457c5] disabled:cursor-not-allowed disabled:opacity-60"
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
  );
};

export default MeetingForm;