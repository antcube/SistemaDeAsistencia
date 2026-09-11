import { useEffect, useState } from "react";
import {
  MEETING_TYPES,
  WEEKDAYS,
} from "../../constants/meetings";

const initialForm = {
  name: "",
  circles: [],
  type: "CIRCULO DE LIDERAZGO",
  title: "",
  host: "",
  time: "",
  endTime: "",
  location: "",
  weekdays: [],
  startDate: "",
  endDate: "",
};

const ScheduleForm = ({
  open,
  circles = [],
  schedule = null,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  const isEditing = Boolean(schedule?._id);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (schedule) {
      setForm({
        name: schedule.name || "",
        circles: schedule.circles || [],
        type:
          schedule.type ||
          "CIRCULO DE LIDERAZGO",
        title: schedule.title || "",
        host: schedule.host || "",
        time: schedule.time || "",
        endTime: schedule.endTime || "",
        location: schedule.location || "",
        weekdays: schedule.weekdays || [],
        startDate: schedule.startDate || "",
        endDate: schedule.endDate || "",
      });
    } else {
      setForm(initialForm);
    }

    setError("");
  }, [open, schedule]);

  if (!open) {
    return null;
  }

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const toggleCircle = (name) => {
    setForm((previous) => {
      const exists = previous.circles.includes(name);

      return {
        ...previous,
        circles: exists
          ? previous.circles.filter(
              (item) => item !== name
            )
          : [...previous.circles, name],
      };
    });
  };

  const toggleWeekday = (value) => {
    setForm((previous) => {
      const exists = previous.weekdays.includes(value);

      return {
        ...previous,
        weekdays: exists
          ? previous.weekdays.filter(
              (item) => item !== value
            )
          : [...previous.weekdays, value],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!form.name.trim()) {
      setError(
        "El nombre de la programación es obligatorio."
      );
      return;
    }

    if (!form.title.trim()) {
      setError("El título es obligatorio.");
      return;
    }

    if (!form.circles.length) {
      setError(
        "Selecciona al menos un círculo."
      );
      return;
    }

    if (!form.weekdays.length) {
      setError(
        "Selecciona al menos un día de la semana."
      );
      return;
    }

    if (!form.startDate) {
      setError("La fecha de inicio es obligatoria.");
      return;
    }

    if (!form.time || !form.endTime) {
      setError(
        "Debes indicar hora de inicio y finalización."
      );
      return;
    }

    if (form.endTime <= form.time) {
      setError(
        "La hora de finalización debe ser posterior a la hora de inicio."
      );
      return;
    }

    if (
      form.endDate &&
      form.endDate < form.startDate
    ) {
      setError(
        "La fecha final no puede ser anterior a la fecha inicial."
      );
      return;
    }

    try {
      await onSubmit({
        ...form,
        endDate: form.endDate || null,
      });
    } catch (err) {
      setError(
        err?.message ||
          "No se pudo guardar la programación."
      );
    }
  };

  return (
    <div className="calendar-modal-backdrop">
      <div className="calendar-modal calendar-modal-large">
        <div className="calendar-modal-header">
          <div>
            <span className="calendar-modal-kicker">
              {isEditing
                ? "EDITAR PROGRAMACIÓN"
                : "NUEVA PROGRAMACIÓN"}
            </span>

            <h2>
              {isEditing
                ? "Editar programación"
                : "Crear programación recurrente"}
            </h2>
          </div>

          <button
            type="button"
            className="calendar-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form
          className="calendar-form"
          onSubmit={handleSubmit}
        >
          <div className="calendar-form-field full">
            <label htmlFor="schedule-name">
              Nombre de programación
            </label>

            <input
              id="schedule-name"
              type="text"
              value={form.name}
              onChange={(event) =>
                updateField(
                  "name",
                  event.target.value
                )
              }
              placeholder="Ej. Reunión semanal"
            />
          </div>

          <div className="calendar-form-field">
            <label htmlFor="schedule-type">
              Tipo
            </label>

            <select
              id="schedule-type"
              value={form.type}
              onChange={(event) =>
                updateField(
                  "type",
                  event.target.value
                )
              }
            >
              {MEETING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="calendar-form-field">
            <label htmlFor="schedule-title">
              Título de las reuniones
            </label>

            <input
              id="schedule-title"
              type="text"
              value={form.title}
              onChange={(event) =>
                updateField(
                  "title",
                  event.target.value
                )
              }
              placeholder="Título"
            />
          </div>

          <div className="calendar-form-field">
            <label htmlFor="schedule-time">
              Hora de inicio
            </label>

            <input
              id="schedule-time"
              type="time"
              value={form.time}
              onChange={(event) =>
                updateField(
                  "time",
                  event.target.value
                )
              }
            />
          </div>

          <div className="calendar-form-field">
            <label htmlFor="schedule-end-time">
              Hora de finalización
            </label>

            <input
              id="schedule-end-time"
              type="time"
              value={form.endTime}
              onChange={(event) =>
                updateField(
                  "endTime",
                  event.target.value
                )
              }
            />
          </div>

          <div className="calendar-form-field">
            <label htmlFor="schedule-host">
              Responsable
            </label>

            <input
              id="schedule-host"
              type="text"
              value={form.host}
              onChange={(event) =>
                updateField(
                  "host",
                  event.target.value
                )
              }
            />
          </div>

          <div className="calendar-form-field">
            <label htmlFor="schedule-location">
              Ubicación
            </label>

            <input
              id="schedule-location"
              type="text"
              value={form.location}
              onChange={(event) =>
                updateField(
                  "location",
                  event.target.value
                )
              }
            />
          </div>

          <div className="calendar-form-field">
            <label htmlFor="schedule-start-date">
              Fecha de inicio
            </label>

            <input
              id="schedule-start-date"
              type="date"
              value={form.startDate}
              onChange={(event) =>
                updateField(
                  "startDate",
                  event.target.value
                )
              }
            />
          </div>

          <div className="calendar-form-field">
            <label htmlFor="schedule-end-date">
              Fecha de finalización
              <small> Opcional</small>
            </label>

            <input
              id="schedule-end-date"
              type="date"
              value={form.endDate}
              onChange={(event) =>
                updateField(
                  "endDate",
                  event.target.value
                )
              }
            />
          </div>

          <div className="calendar-form-field full">
            <label>
              Días de la semana
            </label>

            <div className="calendar-weekday-selector">
              {WEEKDAYS.map((weekday) => {
                const selected =
                  form.weekdays.includes(
                    weekday.value
                  );

                return (
                  <label
                    key={weekday.value}
                    className={[
                      "calendar-weekday-option",
                      selected
                        ? "selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        toggleWeekday(
                          weekday.value
                        )
                      }
                    />

                    <span>{weekday.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="calendar-form-field full">
            <label>
              Círculos
            </label>

            <div className="calendar-circle-selector">
              {circles.map((circle) => {
                const name = circle.name;

                const selected =
                  form.circles.includes(name);

                return (
                  <label
                    key={circle._id || name}
                    className={[
                      "calendar-circle-option",
                      selected
                        ? "selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        toggleCircle(name)
                      }
                    />

                    <span>{name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="calendar-form-error full">
              {error}
            </div>
          )}

          <div className="calendar-form-actions full">
            <button
              type="button"
              className="secondary"
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="primary"
            >
              {isEditing
                ? "Guardar cambios"
                : "Crear programación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleForm;