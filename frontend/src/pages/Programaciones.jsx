import { useEffect, useMemo, useState } from "react";

import scheduleService from "../services/scheduleService";
import circleService from "../services/circleService";

const WEEKDAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const MEETING_TYPES = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
  "ORDINARIA",
];

const EMPTY_FORM = {
  name: "",
  circles: [],
  type: "CIRCULO DE LIDERAZGO",
  title: "",
  host: "",
  time: "",
  endTime: "",
  location: "",
  weekdays: [],
};

const getList = (response, keys = []) => {
  if (Array.isArray(response)) {
    return response;
  }

  for (const key of keys) {
    if (Array.isArray(response?.[key])) {
      return response[key];
    }
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
};

const formatDate = (dateString) => {
  if (!dateString) {
    return "—";
  }

  const parts = String(dateString).split("-");

  if (parts.length !== 3) {
    return dateString;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatWeekdays = (weekdays = []) => {
  return WEEKDAYS.filter((day) =>
    weekdays.includes(day.value)
  )
    .map((day) => day.label)
    .join(", ");
};

const getMonthStart = (offset = 0) => {
  const today = new Date();

  const date = new Date(
    today.getFullYear(),
    today.getMonth() + offset,
    1
  );

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    "01",
  ].join("-");
};

const getChangeTypeLabel = (changeType) => {
  if (changeType === "MIGRATED") {
    return "Migrada";
  }

  if (changeType === "TERMINATED") {
    return "Terminada";
  }

  return "Creada";
};

const getStatusClasses = (active) => {
  if (active) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  return "bg-slate-100 text-slate-500 border-slate-200";
};

const Programaciones = () => {
  const [schedules, setSchedules] = useState([]);
  const [circles, setCircles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [circleFilter, setCircleFilter] = useState("");

  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const [migrationSchedule, setMigrationSchedule] =
    useState(null);

  const [migrationOpen, setMigrationOpen] =
    useState(false);

  const [terminationSchedule, setTerminationSchedule] =
    useState(null);

  const [terminationOpen, setTerminationOpen] =
    useState(false);

  const [effectiveMode, setEffectiveMode] =
    useState("NEXT_MONTH");

  const [specificDate, setSpecificDate] =
    useState("");

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [migrationForm, setMigrationForm] =
    useState({
      name: "",
      circles: [],
      type: "CIRCULO DE LIDERAZGO",
      title: "",
      host: "",
      time: "",
      endTime: "",
      location: "",
      weekdays: [],
    });

  const [terminationDate, setTerminationDate] =
    useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        scheduleResponse,
        circleResponse,
      ] = await Promise.all([
        scheduleService.getSchedules(),
        circleService.getCircles(),
      ]);

      setSchedules(
        getList(scheduleResponse, [
          "schedules",
          "data",
        ])
      );

      setCircles(
        getList(circleResponse, [
          "circles",
          "data",
        ])
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "No se pudieron cargar las programaciones."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSchedules = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return schedules.filter((schedule) => {
      const searchableText = [
        schedule.name,
        schedule.title,
        schedule.type,
        schedule.host,
        ...(schedule.circles || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        searchableText.includes(
          normalizedSearch
        );

      const matchesCircle =
        !circleFilter ||
        (schedule.circles || []).some(
          (circle) =>
            String(circle).toUpperCase() ===
            String(circleFilter).toUpperCase()
        );

      return (
        matchesSearch &&
        matchesCircle
      );
    });
  }, [
    schedules,
    search,
    circleFilter,
  ]);

  const updateFormField = (
    field,
    value
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateMigrationField = (
    field,
    value
  ) => {
    setMigrationForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleCircle = (
    field,
    circle
  ) => {
    const setter =
      field === "migration"
        ? setMigrationForm
        : setForm;

    setter((current) => {
      const exists =
        current.circles.includes(circle);

      return {
        ...current,
        circles: exists
          ? current.circles.filter(
              (item) => item !== circle
            )
          : [
              ...current.circles,
              circle,
            ],
      };
    });
  };

  const toggleWeekday = (
    field,
    weekday
  ) => {
    const setter =
      field === "migration"
        ? setMigrationForm
        : setForm;

    setter((current) => {
      const exists =
        current.weekdays.includes(weekday);

      const nextWeekdays = exists
        ? current.weekdays.filter(
            (item) => item !== weekday
          )
        : [
            ...current.weekdays,
            weekday,
          ];

      return {
        ...current,
        weekdays: nextWeekdays,
      };
    });
  };

  const openEdit = (schedule) => {
    setError("");
    setMessage("");

    setEditingSchedule(schedule);

    setForm({
      name: schedule.name || "",
      circles: Array.isArray(
        schedule.circles
      )
        ? schedule.circles
        : [],
      type:
        schedule.type ||
        "CIRCULO DE LIDERAZGO",
      title: schedule.title || "",
      host: schedule.host || "",
      time: schedule.time || "",
      endTime:
        schedule.endTime || "",
      location:
        schedule.location || "",
      weekdays: Array.isArray(
        schedule.weekdays
      )
        ? schedule.weekdays
        : [],
    });

    setEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) {
      return;
    }

    setEditOpen(false);
    setEditingSchedule(null);
    setForm(EMPTY_FORM);
  };

  const handleEditSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (!editingSchedule?._id) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (
        !form.name.trim() ||
        !form.title.trim()
      ) {
        throw new Error(
          "El nombre y el título son obligatorios."
        );
      }

      if (
        !form.circles.length
      ) {
        throw new Error(
          "Selecciona al menos un círculo."
        );
      }

      if (
        !form.weekdays.length
      ) {
        throw new Error(
          "Selecciona al menos un día de la semana."
        );
      }

      if (
        !form.time ||
        !form.endTime
      ) {
        throw new Error(
          "Indica la hora de inicio y la hora de término."
        );
      }

      if (
        form.endTime <= form.time
      ) {
        throw new Error(
          "La hora de término debe ser posterior a la hora de inicio."
        );
      }

      await scheduleService.updateSchedule(
        editingSchedule._id,
        {
          name: form.name.trim(),
          circles: form.circles,
          type: form.type,
          title: form.title.trim(),
          host: form.host.trim(),
          time: form.time,
          endTime: form.endTime,
          location:
            form.location.trim(),
          weekdays: form.weekdays,
        }
      );

      setMessage(
        "Programación actualizada correctamente."
      );

      closeEdit();
      await loadData();
    } catch (err) {
      console.error(err);

      if (
        err?.message?.includes(
          "debes realizar una migración"
        )
      ) {
        setError(
          "Esta programación ya tiene reuniones generadas. Para cambiar días, horarios o círculos debes utilizar «Migrar programación», así conservamos el historial."
        );
      } else {
        setError(
          err?.message ||
            "No se pudo actualizar la programación."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const openMigration = (
    schedule
  ) => {
    setError("");
    setMessage("");

    setMigrationSchedule(schedule);

    setMigrationForm({
      name:
        schedule.name || "",
      circles:
        Array.isArray(
          schedule.circles
        )
          ? schedule.circles
          : [],
      type:
        schedule.type ||
        "CIRCULO DE LIDERAZGO",
      title:
        schedule.title || "",
      host:
        schedule.host || "",
      time:
        schedule.time || "",
      endTime:
        schedule.endTime || "",
      location:
        schedule.location || "",
      weekdays:
        Array.isArray(
          schedule.weekdays
        )
          ? schedule.weekdays
          : [],
    });

    setEffectiveMode(
      "NEXT_MONTH"
    );

    setSpecificDate("");

    setMigrationOpen(true);
  };

  const closeMigration = () => {
    if (saving) {
      return;
    }

    setMigrationOpen(false);
    setMigrationSchedule(null);
  };

  const getEffectiveDate = () => {
    if (
      effectiveMode ===
      "THIS_MONTH"
    ) {
      return getMonthStart(0);
    }

    if (
      effectiveMode ===
      "NEXT_MONTH"
    ) {
      return getMonthStart(1);
    }

    return specificDate;
  };

  const handleMigrationSubmit =
    async (event) => {
      event.preventDefault();

      if (!migrationSchedule?._id) {
        return;
      }

      try {
        setSaving(true);
        setError("");
        setMessage("");

        const effectiveDate =
          getEffectiveDate();

        if (!effectiveDate) {
          throw new Error(
            "Selecciona la fecha desde la cual comenzará la nueva programación."
          );
        }

        if (
          !migrationForm.circles.length
        ) {
          throw new Error(
            "Selecciona al menos un círculo."
          );
        }

        if (
          !migrationForm.weekdays.length
        ) {
          throw new Error(
            "Selecciona al menos un día de la semana."
          );
        }

        if (
          !migrationForm.time ||
          !migrationForm.endTime
        ) {
          throw new Error(
            "Indica la hora de inicio y la hora de término."
          );
        }

        if (
          migrationForm.endTime <=
          migrationForm.time
        ) {
          throw new Error(
            "La hora de término debe ser posterior a la hora de inicio."
          );
        }

        if (
          effectiveDate <=
          migrationSchedule.startDate
        ) {
          throw new Error(
            `La fecha efectiva debe ser posterior al inicio actual (${formatDate(
              migrationSchedule.startDate
            )}).`
          );
        }

        await scheduleService.migrateSchedule(
          migrationSchedule._id,
          {
            effectiveDate,
            name:
              migrationForm.name.trim(),
            circles:
              migrationForm.circles,
            type:
              migrationForm.type,
            title:
              migrationForm.title.trim(),
            host:
              migrationForm.host.trim(),
            time:
              migrationForm.time,
            endTime:
              migrationForm.endTime,
            location:
              migrationForm.location.trim(),
            weekdays:
              migrationForm.weekdays,
          }
        );

        setMessage(
          "Programación migrada correctamente. El historial anterior se conserva."
        );

        closeMigration();
        await loadData();
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "No se pudo migrar la programación."
        );
      } finally {
        setSaving(false);
      }
    };

  const openTermination = (
    schedule
  ) => {
    setError("");
    setMessage("");

    setTerminationSchedule(
      schedule
    );

    setTerminationDate(
      getMonthStart(1)
    );

    setTerminationOpen(true);
  };

  const closeTermination = () => {
    if (saving) {
      return;
    }

    setTerminationOpen(false);
    setTerminationSchedule(null);
    setTerminationDate("");
  };

  const handleTerminationSubmit =
    async (event) => {
      event.preventDefault();

      if (
        !terminationSchedule?._id
      ) {
        return;
      }

      try {
        setSaving(true);
        setError("");
        setMessage("");

        if (!terminationDate) {
          throw new Error(
            "Selecciona la fecha desde la cual terminará la programación."
          );
        }

        if (
          terminationDate <=
          terminationSchedule.startDate
        ) {
          throw new Error(
            `La fecha debe ser posterior al inicio de la programación (${formatDate(
              terminationSchedule.startDate
            )}).`
          );
        }

        const confirmed =
          window.confirm(
            `¿Deseas terminar "${terminationSchedule.name}" desde el ${formatDate(
              terminationDate
            )} en adelante?`
          );

        if (!confirmed) {
          return;
        }

        await scheduleService.terminateFromDate(
          terminationSchedule._id,
          terminationDate
        );

        setMessage(
          "La programación fue terminada desde la fecha indicada."
        );

        closeTermination();
        await loadData();
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "No se pudo terminar la programación."
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* =====================================================
            ENCABEZADO
        ===================================================== */}

        <div className="mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Programaciones
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Administra las programaciones oficiales de los círculos.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ↻ Actualizar
            </button>
          </div>
        </div>

        {/* =====================================================
            MENSAJES
        ===================================================== */}

        {error && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {/* =====================================================
            FILTROS
        ===================================================== */}

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Buscar programación, reunión, círculo..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              value={circleFilter}
              onChange={(event) =>
                setCircleFilter(
                  event.target.value
                )
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">
                Todos los círculos
              </option>

              {circles.map((circle) => {
                const name =
                  typeof circle ===
                  "string"
                    ? circle
                    : circle?.name;

                if (!name) {
                  return null;
                }

                return (
                  <option
                    key={name}
                    value={name}
                  >
                    {name}
                  </option>
                );
              })}
            </select>

          </div>
        </div>

        {/* =====================================================
            TABLA
        ===================================================== */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Programación
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Reunión
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Círculos
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Día(s)
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Horario
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Desde
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Estado
                  </th>

                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-14 text-center text-sm text-slate-500"
                    >
                      Cargando programaciones...
                    </td>
                  </tr>
                ) : filteredSchedules.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-14 text-center"
                    >
                      <div className="text-sm font-semibold text-slate-700">
                        No hay programaciones
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        No se encontraron programaciones con los filtros seleccionados.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map(
                    (schedule) => (
                      <tr
                        key={schedule._id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-4 align-top">
                          <div className="max-w-[210px]">
                            <div className="truncate text-sm font-bold text-slate-800">
                              {schedule.name}
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              Versión {schedule.version || 1}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="text-sm font-semibold text-slate-700">
                            {schedule.type}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {schedule.title}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="flex max-w-[220px] flex-wrap gap-1.5">
                            {(schedule.circles || []).map(
                              (circle) => (
                                <span
                                  key={circle}
                                  className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700"
                                >
                                  {circle}
                                </span>
                              )
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="max-w-[150px] text-sm font-medium text-slate-700">
                            {formatWeekdays(
                              schedule.weekdays || []
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="text-sm font-semibold text-slate-700">
                            {schedule.time} -{" "}
                            {schedule.endTime}
                          </div>

                          {schedule.location && (
                            <div className="mt-1 max-w-[150px] truncate text-xs text-slate-400">
                              {schedule.location}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="text-sm font-medium text-slate-700">
                            {formatDate(
                              schedule.startDate
                            )}
                          </div>

                          {schedule.endDate && (
                            <div className="mt-1 text-xs text-slate-400">
                              Hasta{" "}
                              {formatDate(
                                schedule.endDate
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col items-start gap-1.5">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusClasses(
                                schedule.active
                              )}`}
                            >
                              {schedule.active
                                ? "Activa"
                                : "Inactiva"}
                            </span>

                            <span className="text-[11px] text-slate-400">
                              {getChangeTypeLabel(
                                schedule.changeType
                              )}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="flex justify-end">
                            <div className="relative">
                              <details className="group">
                                <summary className="flex h-9 cursor-pointer list-none items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700">
                                  Gestionar
                                  <span className="ml-2 text-slate-400 group-open:rotate-180">
                                    ▾
                                  </span>
                                </summary>

                                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEdit(
                                        schedule
                                      )
                                    }
                                    className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    ✎
                                    <span className="ml-2">
                                      Editar
                                    </span>
                                  </button>

                                  {schedule.active && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openMigration(
                                            schedule
                                          )
                                        }
                                        className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                      >
                                        ↻
                                        <span className="ml-2">
                                          Migrar programación
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          openTermination(
                                            schedule
                                          )
                                        }
                                        className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                      >
                                        ⏹
                                        <span className="ml-2">
                                          Terminar programación
                                        </span>
                                      </button>
                                    </>
                                  )}

                                </div>
                              </details>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          {!loading && (
            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs font-medium text-slate-400">
              {filteredSchedules.length} programación
              {filteredSchedules.length === 1
                ? ""
                : "es"}
            </div>
          )}

        </div>
      </div>

      {/* =======================================================
          MODAL EDITAR
      ======================================================= */}

      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Editar programación
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Los cambios que alteren reuniones generadas requieren una migración.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="text-xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleEditSubmit
              }
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Nombre de la programación
                </label>

                <input
                  value={form.name}
                  onChange={(event) =>
                    updateFormField(
                      "name",
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Tipo de reunión
                  </label>

                  <select
                    value={form.type}
                    onChange={(event) =>
                      updateFormField(
                        "type",
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {MEETING_TYPES.map(
                      (type) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {type}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Título
                  </label>

                  <input
                    value={form.title}
                    onChange={(event) =>
                      updateFormField(
                        "title",
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-slate-600">
                  Círculos
                </label>

                <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                  {circles.map(
                    (circle) => {
                      const name =
                        typeof circle ===
                        "string"
                          ? circle
                          : circle?.name;

                      if (!name) {
                        return null;
                      }

                      const selected =
                        form.circles.includes(
                          name
                        );

                      return (
                        <button
                          type="button"
                          key={name}
                          onClick={() =>
                            toggleCircle(
                              "edit",
                              name
                            )
                          }
                          className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                            selected
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
                          }`}
                        >
                          {selected
                            ? "✓ "
                            : ""}
                          {name}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-slate-600">
                  Día(s) de la semana
                </label>

                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(
                    (day) => {
                      const selected =
                        form.weekdays.includes(
                          day.value
                        );

                      return (
                        <button
                          type="button"
                          key={day.value}
                          onClick={() =>
                            toggleWeekday(
                              "edit",
                              day.value
                            )
                          }
                          className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                            selected
                              ? "border-blue-500 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Hora de inicio
                  </label>

                  <input
                    type="time"
                    value={form.time}
                    onChange={(event) =>
                      updateFormField(
                        "time",
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Hora de término
                  </label>

                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      updateFormField(
                        "endTime",
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Moderador / Líder
                  </label>

                  <input
                    value={form.host}
                    onChange={(event) =>
                      updateFormField(
                        "host",
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Ubicación / Enlace
                  </label>

                  <input
                    value={form.location}
                    onChange={(event) =>
                      updateFormField(
                        "location",
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-xl bg-[#163878] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#102d61] disabled:opacity-60"
                >
                  {saving
                    ? "Guardando..."
                    : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL MIGRAR
      ======================================================= */}

      {migrationOpen &&
        migrationSchedule && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">

              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Migrar programación
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      La programación actual conservará su historial y la nueva comenzará en la fecha efectiva.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeMigration
                    }
                    disabled={saving}
                    className="text-xl text-slate-400 hover:text-slate-700"
                  >
                    ×
                  </button>
                </div>
              </div>

              <form
                onSubmit={
                  handleMigrationSubmit
                }
                className="space-y-6 p-6"
              >
                {/* PROGRAMACIÓN ACTUAL */}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Programación actual
                  </div>

                  <div className="grid gap-4 sm:grid-cols-4">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400">
                        Reunión
                      </div>

                      <div className="mt-1 text-sm font-bold text-slate-700">
                        {migrationSchedule.type}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-400">
                        Día(s)
                      </div>

                      <div className="mt-1 text-sm font-semibold text-slate-700">
                        {formatWeekdays(
                          migrationSchedule.weekdays ||
                            []
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-400">
                        Horario
                      </div>

                      <div className="mt-1 text-sm font-semibold text-slate-700">
                        {migrationSchedule.time} -{" "}
                        {
                          migrationSchedule.endTime
                        }
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-400">
                        Desde
                      </div>

                      <div className="mt-1 text-sm font-semibold text-slate-700">
                        {formatDate(
                          migrationSchedule.startDate
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* FECHA EFECTIVA */}

                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">
                    ¿Desde cuándo aplicar el cambio?
                  </label>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() =>
                        setEffectiveMode(
                          "THIS_MONTH"
                        )
                      }
                      className={`rounded-xl border p-3 text-left transition ${
                        effectiveMode ===
                        "THIS_MONTH"
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-blue-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-800">
                        Desde este mes
                      </div>

                      <div className="mt-1 text-[11px] text-slate-400">
                        {formatDate(
                          getMonthStart(0)
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEffectiveMode(
                          "NEXT_MONTH"
                        )
                      }
                      className={`rounded-xl border p-3 text-left transition ${
                        effectiveMode ===
                        "NEXT_MONTH"
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-blue-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-800">
                        Desde el próximo mes
                      </div>

                      <div className="mt-1 text-[11px] text-slate-400">
                        {formatDate(
                          getMonthStart(1)
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEffectiveMode(
                          "SPECIFIC_DATE"
                        )
                      }
                      className={`rounded-xl border p-3 text-left transition ${
                        effectiveMode ===
                        "SPECIFIC_DATE"
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-blue-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-800">
                        Desde una fecha
                      </div>

                      <div className="mt-1 text-[11px] text-slate-400">
                        Elegir manualmente
                      </div>
                    </button>
                  </div>

                  {effectiveMode ===
                    "SPECIFIC_DATE" && (
                    <input
                      type="date"
                      value={
                        specificDate
                      }
                      min={
                        migrationSchedule.startDate
                      }
                      onChange={(event) =>
                        setSpecificDate(
                          event.target.value
                        )
                      }
                      className="mt-3 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  )}
                </div>

                {/* NUEVA PROGRAMACIÓN */}

                <div className="border-t border-slate-100 pt-5">
                  <div className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Nueva programación
                  </div>

                  <div className="space-y-5">

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">
                        Nombre de la programación
                      </label>

                      <input
                        value={
                          migrationForm.name
                        }
                        onChange={(event) =>
                          updateMigrationField(
                            "name",
                            event.target.value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">
                          Tipo de reunión
                        </label>

                        <select
                          value={
                            migrationForm.type
                          }
                          onChange={(event) =>
                            updateMigrationField(
                              "type",
                              event.target.value
                            )
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          {MEETING_TYPES.map(
                            (type) => (
                              <option
                                key={type}
                                value={type}
                              >
                                {type}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">
                          Título
                        </label>

                        <input
                          value={
                            migrationForm.title
                          }
                          onChange={(event) =>
                            updateMigrationField(
                              "title",
                              event.target.value
                            )
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold text-slate-600">
                        Círculos
                      </label>

                      <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                        {circles.map(
                          (circle) => {
                            const name =
                              typeof circle ===
                              "string"
                                ? circle
                                : circle?.name;

                            if (!name) {
                              return null;
                            }

                            const selected =
                              migrationForm.circles.includes(
                                name
                              );

                            return (
                              <button
                                type="button"
                                key={name}
                                onClick={() =>
                                  toggleCircle(
                                    "migration",
                                    name
                                  )
                                }
                                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                                  selected
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
                                }`}
                              >
                                {selected
                                  ? "✓ "
                                  : ""}
                                {name}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold text-slate-600">
                        Nuevo día o días
                      </label>

                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map(
                          (day) => {
                            const selected =
                              migrationForm.weekdays.includes(
                                day.value
                              );

                            return (
                              <button
                                type="button"
                                key={day.value}
                                onClick={() =>
                                  toggleWeekday(
                                    "migration",
                                    day.value
                                  )
                                }
                                className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                                  selected
                                    ? "border-blue-500 bg-blue-600 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">
                          Hora de inicio
                        </label>

                        <input
                          type="time"
                          value={
                            migrationForm.time
                          }
                          onChange={(event) =>
                            updateMigrationField(
                              "time",
                              event.target.value
                            )
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">
                          Hora de término
                        </label>

                        <input
                          type="time"
                          value={
                            migrationForm.endTime
                          }
                          onChange={(event) =>
                            updateMigrationField(
                              "endTime",
                              event.target.value
                            )
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">
                          Moderador / Líder
                        </label>

                        <input
                          value={
                            migrationForm.host
                          }
                          onChange={(event) =>
                            updateMigrationField(
                              "host",
                              event.target.value
                            )
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">
                          Ubicación / Enlace
                        </label>

                        <input
                          value={
                            migrationForm.location
                          }
                          onChange={(event) =>
                            updateMigrationField(
                              "location",
                              event.target.value
                            )
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                  </div>
                </div>

                {/* RESUMEN */}

                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <div className="text-xs font-bold text-blue-800">
                    La programación actual no será modificada en su historial.
                  </div>

                  <div className="mt-1 text-xs leading-5 text-blue-700">
                    La versión anterior terminará el día anterior a la fecha efectiva y la nueva versión comenzará desde la fecha seleccionada.
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={
                      closeMigration
                    }
                    disabled={saving}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-xl bg-[#2457c5] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#1d49a6] disabled:opacity-60"
                  >
                    {saving
                      ? "Migrando..."
                      : "Migrar programación"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* =======================================================
          MODAL TERMINAR
      ======================================================= */}

      {terminationOpen &&
        terminationSchedule && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">

              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Terminar programación
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Las reuniones anteriores permanecerán en el historial.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeTermination
                  }
                  disabled={saving}
                  className="text-xl text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={
                  handleTerminationSubmit
                }
                className="space-y-5 p-6"
              >
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Programación
                  </div>

                  <div className="mt-1 text-sm font-bold text-slate-800">
                    {terminationSchedule.name}
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    {terminationSchedule.type}
                    {" · "}
                    {formatWeekdays(
                      terminationSchedule.weekdays ||
                        []
                    )}
                    {" · "}
                    {
                      terminationSchedule.time
                    }{" "}
                    -{" "}
                    {
                      terminationSchedule.endTime
                    }
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Terminar desde
                  </label>

                  <input
                    type="date"
                    value={
                      terminationDate
                    }
                    min={
                      terminationSchedule.startDate
                    }
                    onChange={(event) =>
                      setTerminationDate(
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    Desde esta fecha dejarán de generarse las sesiones futuras de esta programación.
                  </p>
                </div>

                <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                  <div className="text-xs font-bold text-rose-700">
                    Esta acción no elimina el historial.
                  </div>

                  <div className="mt-1 text-xs leading-5 text-rose-600">
                    Las reuniones realizadas anteriormente permanecerán disponibles.
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={
                      closeTermination
                    }
                    disabled={saving}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                  >
                    {saving
                      ? "Terminando..."
                      : "Terminar programación"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
};

export default Programaciones;