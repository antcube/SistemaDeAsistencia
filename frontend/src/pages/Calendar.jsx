import { useCallback, useEffect, useRef, useState } from "react";

import MeetingForm from "../components/calendar/MeetingForm";
import CalendarGrid from "../components/calendar/CalendarGrid";
import MonthSelector from "../components/calendar/MonthSelector";
import MasterclassButton from "../components/calendar/MasterclassButton";

import meetingService from "../services/meetingService";
import circleService from "../services/circleService";
import scheduleService from "../services/scheduleService";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  Monitor,
  Target,
  Trash,
} from "lucide-react";

import MeetingAttendanceModal from "../components/calendar/MeetingAttendanceModal";

import "../components/calendar/calendar.css";
import "../components/calendar/calendar-dynamic-rows.css";

const extractList = (response, keys = []) => {
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

const getCircleName = (circle) => {
  if (typeof circle === "string") {
    return circle.trim();
  }

  return String(circle?.name || "").trim();
};

const normalizeCircles = (circles = []) => {
  return [
    ...new Set(
      circles
        .map(getCircleName)
        .map((circle) => String(circle).trim())
        .filter(Boolean)
    ),
  ];
};

const Calendar = () => {
  const { admin, loading: authLoading } = useAuth();
  const today = new Date();

  const isMainAdmin =
    String(admin?.role || "").trim() === "Administrador General" ||
    String(admin?.adminId || "").trim() === "ADM-001";

  const isCircleManager =
    String(admin?.role || "").trim() === "Gestor de Círculo";

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [meetings, setMeetings] = useState([]);
  const [circles, setCircles] = useState([]);

  /*
   * Círculo actualmente seleccionado.
   *
   * IMPORTANTE:
   * No hay ningún círculo escrito de forma fija.
   * Se obtiene dinámicamente desde MongoDB.
   */
  const [selectedCircle, setSelectedCircle] = useState("");
  const [circleMenuOpen, setCircleMenuOpen] = useState(false);
  const [circleMenuMode, setCircleMenuMode] = useState("");
  const circleMenuRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [openMeeting, setOpenMeeting] = useState(null);
  const [attendanceRefreshKey, setAttendanceRefreshKey] =
    useState(0);
  const [todayFocusKey, setTodayFocusKey] = useState(0);

  useEffect(() => {
    if (!circleMenuOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (
        circleMenuRef.current &&
        !circleMenuRef.current.contains(event.target)
      ) {
        setCircleMenuOpen(false);
        setCircleMenuMode("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [circleMenuOpen]);

  /*
   * ============================================================
   * CARGAR DATOS
   * ============================================================
   */
  const loadRequestRef = useRef(0);
  const circleRequestRef = useRef(0);

  /*
   * ============================================================
   * CARGAR CÍRCULOS PRIMERO
   * ============================================================
   *
   * El círculo seleccionado NO puede depender de la respuesta de
   * reuniones. Primero obtenemos el alcance del usuario, respetamos
   * el orden de circleScope y elegimos el primer círculo.
   *
   * Esto evita que una petición inicial sin círculo devuelva todas
   * las reuniones del mes.
   */
  useEffect(() => {
    let cancelled = false;
    const requestId = ++circleRequestRef.current;

    const loadCircles = async () => {
      if (authLoading || !admin) {
        return;
      }

      try {
        const response = await circleService.getCircles();

        if (
          cancelled ||
          requestId !== circleRequestRef.current
        ) {
          return;
        }

        const circleList = extractList(response, [
          "circles",
          "data",
        ]);

        const allowedScope = Array.isArray(admin?.circleScope)
          ? admin.circleScope
              .map((value) => String(value || "").trim())
              .filter(Boolean)
          : [];

        let visibleCircles = isCircleManager
          ? circleList.filter((item) => {
              const name = getCircleName(item);

              return allowedScope.some(
                (allowed) =>
                  allowed.toLowerCase() ===
                  name.toLowerCase()
              );
            })
          : circleList;

        // Para un gestor el orden de circleScope es el orden de
        // asignación. El primer elemento siempre será la vista inicial.
        if (isCircleManager && allowedScope.length) {
          const byName = new Map(
            visibleCircles.map((item) => [
              getCircleName(item).toLowerCase(),
              item,
            ])
          );

          visibleCircles = allowedScope
            .map((name) => byName.get(name.toLowerCase()))
            .filter(Boolean);
        }

        setCircles(visibleCircles);

        setSelectedCircle((current) => {
          const currentName = String(current || "").trim();

          const currentExists = currentName &&
            visibleCircles.some(
              (item) =>
                getCircleName(item).toLowerCase() ===
                currentName.toLowerCase()
            );

          if (currentExists) {
            return currentName;
          }

          return getCircleName(visibleCircles[0]);
        });
      } catch (err) {
        if (cancelled || requestId !== circleRequestRef.current) {
          return;
        }

        console.error("Error cargando círculos del calendario:", err);
        setCircles([]);
        setSelectedCircle("");
        setMeetings([]);
        setError(
          err?.message ||
            "No se pudieron cargar los círculos."
        );
      }
    };

    loadCircles();

    return () => {
      cancelled = true;
    };
  }, [authLoading, admin, isCircleManager]);

  /*
   * ============================================================
   * CARGAR REUNIONES DEL CÍRCULO SELECCIONADO
   * ============================================================
   */
  const loadData = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const effectiveCircle = String(selectedCircle || "").trim();

    // Nunca consultamos reuniones sin círculo.
    if (authLoading || !admin || !effectiveCircle) {
      setMeetings([]);
      setLoading(true);
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Al cambiar de círculo se limpia inmediatamente la vista anterior.
      setMeetings([]);

      const meetingResponse = await meetingService.getMeetings(
        year,
        month,
        {
          circle: effectiveCircle,
        }
      );

      if (requestId !== loadRequestRef.current) {
        return;
      }

      const meetingList = extractList(meetingResponse, [
        "meetings",
        "data",
      ]);

      // Segunda barrera: aunque el backend devuelva algo inesperado,
      // solo permitimos reuniones del círculo actualmente seleccionado.
      const normalizedCircle = effectiveCircle.toLowerCase();

      const filteredMeetings = meetingList.filter((meeting) => {
        const meetingCircle = String(meeting?.circle || "")
          .trim()
          .toLowerCase();

        return meetingCircle === normalizedCircle;
      });

      const uniqueMeetings = [];
      const seenMeetings = new Set();

      for (const meeting of filteredMeetings) {
        const meetingId =
          meeting?._id ||
          meeting?.id ||
          [
            meeting?.date,
            meeting?.circle,
            meeting?.type,
            meeting?.title,
            meeting?.time,
          ].join("|");

        const key = String(meetingId);

        if (seenMeetings.has(key)) {
          continue;
        }

        seenMeetings.add(key);
        uniqueMeetings.push(meeting);
      }

      setMeetings(uniqueMeetings);
    } catch (err) {
      if (requestId !== loadRequestRef.current) {
        return;
      }

      console.error(err);

      setMeetings([]);
      setError(
        err?.message ||
          "No se pudo cargar el calendario."
      );
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [
    year,
    month,
    selectedCircle,
    admin,
    authLoading,
  ]);

  /*
   * La consulta de reuniones solamente ocurre cuando ya existe un
   * círculo seleccionado. Al entrar por primera vez, el efecto de
   * círculos establece el primero y recién entonces se ejecuta esto.
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /*
   * ============================================================
   * CAMBIAR MES
   * ============================================================
   */
  const changeMonth = (direction) => {
    let nextMonth = month + direction;
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

  /*
   * ============================================================
   * IR A HOY
   * ============================================================
   */
  const goToday = () => {
    const current = new Date();

    setYear(current.getFullYear());
    setMonth(current.getMonth() + 1);
    setTodayFocusKey((value) => value + 1);
  };

  useEffect(() => {
    if (!todayFocusKey || loading) {
      return;
    }

    const current = new Date();
    const isCurrentMonth =
      year === current.getFullYear() &&
      month === current.getMonth() + 1;

    if (!isCurrentMonth) {
      return;
    }

    const timer = window.setTimeout(() => {
      const todayCell = document.querySelector(
        ".calendar-day-today"
      );

      todayCell?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [todayFocusKey, loading, year, month]);

  /*
   * ============================================================
   * NUEVA REUNIÓN
   * ============================================================
   */
  const openNewMeeting = () => {
    setEditingMeeting(null);
    setShowMeetingForm(true);
    setError("");
  };

  /*
   * ============================================================
   * ABRIR ACTA DE ASISTENCIA
   * ============================================================
   */
  const openMeetingAct = (meeting) => {
    setOpenMeeting(meeting);
    setError("");
  };

  /*
   * ============================================================
   * CERRAR FORMULARIO
   * ============================================================
   */
  const closeMeetingForm = () => {
    if (saving) {
      return;
    }

    setShowMeetingForm(false);
    setEditingMeeting(null);
  };

  /*
   * ============================================================
   * GUARDAR REUNIÓN
   * ============================================================
   */
  const handleMeetingSubmit = async (form) => {
    setSaving(true);
    setError("");

    try {
      const selectedCircles =
        normalizeCircles(
          form.circles || []
        );

      if (!selectedCircles.length) {
        throw new Error(
          "Selecciona al menos un círculo."
        );
      }

      /*
       * ========================================================
       * EDITAR REUNIÓN EXISTENTE
       * ========================================================
       */
      if (editingMeeting?._id) {
        await meetingService.updateMeeting(
          editingMeeting._id,
          {
            title: form.title,
            type: form.type,
            circle: selectedCircles[0],
            host: form.host,
            date: form.date,
            time: form.time,
            endTime: form.endTime,
            location: form.location,
          }
        );
      }

      /*
       * ========================================================
       * REUNIÓN NUEVA - FECHA PUNTUAL
       * ========================================================
       */
      else if (
        form.scheduleMode === "DATE"
      ) {
        const meetingPayload = {
          title:
            form.type ===
            "ANUNCIOS CORPORATIVOS"
              ? "ANUNCIOS CORPORATIVOS"
              : form.title,
          type: form.type,
          host: form.host,
          date: form.date,
          time: form.time,
          endTime: form.endTime,
          location: form.location,
        };

        if (selectedCircles.length > 1) {
          await meetingService.createMeetingsBatch({
            ...meetingPayload,
            circles: selectedCircles,
          });
        } else {
          await meetingService.createMeeting({
            ...meetingPayload,
            circle: selectedCircles[0],
          });
        }
      }

      /*
       * ========================================================
       * PROGRAMACIÓN OFICIAL / RECURRENTE
       * ========================================================
       */
      else if (
        form.scheduleMode === "WEEKDAYS"
      ) {
        const weekdays = [
          ...new Set(
            (form.weekdays || [])
              .map(Number)
              .filter(Number.isInteger)
          ),
        ].sort(
          (a, b) => a - b
        );

        if (!weekdays.length) {
          throw new Error(
            "Selecciona al menos un día de la semana."
          );
        }

        await scheduleService.createSchedule({
          name:
            form.title ||
            (selectedCircles.length > 1
              ? form.type
              : `${form.type} - ${selectedCircles[0]}`),

          circles: selectedCircles,

          type: form.type,

          title:
            form.type ===
            "ANUNCIOS CORPORATIVOS"
              ? "ANUNCIOS CORPORATIVOS"
              : form.title,

          host: form.host,

          time: form.time,

          endTime: form.endTime,

          location: form.location,

          weekdays,

          startDate: form.date,
        });
      }

      setShowMeetingForm(false);
      setEditingMeeting(null);

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "No se pudo guardar la reunión."
      );

      throw err;
    } finally {
      setSaving(false);
    }
  };

  /*
   * ============================================================
   * ELIMINAR REUNIÓN
   * ============================================================
   */
  const handleDeleteMeeting = async (
    meeting
  ) => {
    const confirmed =
      window.confirm(
        `¿Deseas eliminar la reunión "${meeting.title || meeting.type}" del ${meeting.date}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await meetingService.deleteMeeting(
        meeting._id
      );

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "No se pudo eliminar la reunión."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ============================================================
   * QR
   * ============================================================
   */
  const handleQr = async (meeting) => {
    try {
      setSaving(true);
      setError("");

      await meetingService.activateQr(
        meeting._id,
        15
      );

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "No se pudo activar el QR."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ============================================================
   * MASTERCLASS MENSUAL
   * ============================================================
   */
  const handleCreateMonthlyMasterclasses =
  async () => {
    try {
      setSaving(true);
      setError("");

      
      const result =
        await meetingService.createMonthlyMasterclasses(
          year,
          month,
          circles
        );
        
      if (
        result?.total === 0 &&
        result?.totalSkipped > 0
      ) {
        setError(
          "Las Masterclass del mes ya estaban creadas para los círculos disponibles."
        );
      }

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "No se pudieron crear las Masterclass del mes."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ============================================================
   * ELIMINAR MASTERCLASS DEL MES
   * ============================================================
   */
  const handleDeleteMonthlyMasterclasses =
  async () => {
    try {
      setSaving(true);
      setError("");

      /*
       * ========================================================
       * BUSCAR TODAS LAS MASTERCLASS DEL MES
       * ========================================================
       *
       * NO utilizamos "meetings", porque ese estado está
       * filtrado por el círculo seleccionado.
       *
       * Utilizamos el servicio GLOBAL.
       */
      const result =
        await meetingService.deleteMonthlyMasterclasses(
          year,
          month
        );

      if (
        !result?.total
      ) {
        setError(
          "No hay Masterclass para eliminar en este mes."
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Se encontraron ${result.total} Masterclass en todos los círculos. ¿Deseas eliminarlas para TODOS los círculos?`
        );

      /*
       * OJO:
       * En este punto ya las habríamos eliminado si hacemos
       * la operación directamente arriba.
       *
       * Por eso NO usamos esta versión todavía.
       */
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "No se pudieron eliminar las Masterclass del mes."
      );
    } finally {
      setSaving(false);
    }
  };

  const presencialCircles = circles.filter((circle) => {
    const name = getCircleName(circle);
    return name && !/virtual/i.test(name);
  });

  const virtualCircles = circles.filter((circle) => {
    const name = getCircleName(circle);
    return name && /virtual/i.test(name);
  });

  const visibleCircleGroup =
    circleMenuMode === "virtuales"
      ? virtualCircles
      : presencialCircles;

  const selectedCircleLabel =
    String(selectedCircle || "").trim() ||
    (circles.length
      ? "Seleccionar círculo"
      : "Sin círculos disponibles");

  return (
    <section className="bg-transparent">
      <div className="mx-auto w-full max-w-[1420px] px-4 py-5">

        {/* =====================================================
            BARRA SUPERIOR DEL CALENDARIO
            ===================================================== */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4deed] bg-white p-4 shadow-[0_12px_34px_rgba(0,0,0,.17)]">

          <MonthSelector
            year={year}
            month={month}
            onPrevious={() =>
              changeMonth(-1)
            }
            onNext={() =>
              changeMonth(1)
            }
          />

          <button
            type="button"
            className="calendar-today-button"
            onClick={goToday}
            aria-label="Ir al mes actual"
          >
            <span className="calendar-today-icon-wrap">
              <Target
                className="calendar-today-icon"
                strokeWidth={2.15}
              />
            </span>
            <span>Hoy</span>
          </button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">

            {/* =================================================
                SELECTOR DE CÍRCULO
                ================================================= */}
            <div
              ref={circleMenuRef}
              className="relative w-[210px] shrink-0"
            >
              <button
                type="button"
                onClick={() => {
                  if (loading || saving || circles.length === 0) {
                    return;
                  }

                  setCircleMenuOpen((open) => !open);

                  if (circleMenuOpen) {
                    setCircleMenuMode("");
                  }
                }}
                disabled={loading || saving || circles.length === 0}
                className={`group flex h-10 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3.5 text-left text-xs font-bold outline-none transition ${
                  circleMenuOpen
                    ? "border-[#4f7ee8] ring-4 ring-[#2457c5]/10"
                    : "border-[#c8d4e5] hover:border-[#9eb2cf] hover:shadow-sm"
                } ${
                  loading || saving || circles.length === 0
                    ? "cursor-not-allowed bg-slate-50 text-slate-400"
                    : "text-[#173b7a]"
                }`}
                aria-haspopup="menu"
                aria-expanded={circleMenuOpen}
              >
                <span className="min-w-0 truncate">
                  {selectedCircleLabel}
                </span>

                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#6880a2] transition-transform duration-200 ${
                    circleMenuOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={2}
                />
              </button>

              {circleMenuOpen && (
                <div className="absolute left-0 top-[46px] z-[80] w-[250px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
                  {!circleMenuMode ? (
                    <div className="p-2">
                      <div className="px-2 pb-2 pt-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                          Tipo de círculo
                        </div>
                        <div className="mt-1 text-[11px] leading-4 text-slate-500">
                          Primero elige la modalidad.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCircleMenuMode("presenciales")}
                        className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-50"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2457c5] transition group-hover:bg-blue-100">
                          <Building2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-extrabold text-slate-800">
                            Presenciales
                          </span>
                          <span className="mt-0.5 block text-[10px] text-slate-400">
                            {presencialCircles.length} círculo{presencialCircles.length === 1 ? "" : "s"}
                          </span>
                        </span>

                        <ChevronDown
                          className="-rotate-90 text-slate-400"
                          size={15}
                          strokeWidth={2}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => setCircleMenuMode("virtuales")}
                        className="group mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-violet-50"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-100">
                          <Monitor className="h-[17px] w-[17px]" strokeWidth={1.9} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-extrabold text-slate-800">
                            Virtuales
                          </span>
                          <span className="mt-0.5 block text-[10px] text-slate-400">
                            {virtualCircles.length} círculo{virtualCircles.length === 1 ? "" : "s"}
                          </span>
                        </span>

                        <ChevronDown
                          className="-rotate-90 text-slate-400"
                          size={15}
                          strokeWidth={2}
                        />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setCircleMenuMode("")}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-[#2457c5] hover:shadow-sm"
                          aria-label="Volver a modalidades"
                        >
                          <ChevronLeft size={16} strokeWidth={2.1} />
                        </button>

                        <div>
                          <div className="text-[11px] font-extrabold text-slate-800">
                            {circleMenuMode === "virtuales"
                              ? "Círculos virtuales"
                              : "Círculos presenciales"}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Selecciona el círculo a visualizar
                          </div>
                        </div>
                      </div>

                      <div className="max-h-[280px] overflow-y-auto p-2">
                        {visibleCircleGroup.length > 0 ? (
                          visibleCircleGroup.map((circle) => {
                            const name = getCircleName(circle);
                            const active =
                              String(selectedCircle).trim().toLowerCase() ===
                              String(name).trim().toLowerCase();

                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  setSelectedCircle(name);
                                  setCircleMenuOpen(false);
                                  setCircleMenuMode("");
                                }}
                                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                                  active
                                    ? "bg-[#edf4ff] text-[#2457c5]"
                                    : "text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span className="truncate">{name}</span>

                                {active && (
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2457c5] text-white">
                                    <Check size={12} strokeWidth={2.5} />
                                  </span>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-6 text-center text-[11px] text-slate-400">
                            No hay círculos en esta modalidad.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Crear/eliminar reuniones y Masterclass es exclusivo del Administrador Principal. */}
            {isMainAdmin && (
              <>
                <button
                  type="button"
                  onClick={openNewMeeting}
                  disabled={saving}
                  className="h-10 rounded-lg bg-[#173b7a] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#2457c5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  + Programar Reunión
                </button>

                <MasterclassButton
                  onClick={handleCreateMonthlyMasterclasses}
                  loading={saving}
                  disabled={saving}
                />

                <button
                  type="button"
                  onClick={handleDeleteMonthlyMasterclasses}
                  disabled={saving}
                  className="h-10 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    <Trash className="h-[15px] w-[15px]" strokeWidth={1.9} />
                    Eliminar Masterclass
                  </span>
                </button>
              </>
            )}

          </div>
        </div>

        {/* =====================================================
            ERROR
            ===================================================== */}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* =====================================================
            CALENDARIO
            ===================================================== */}
        <div className="overflow-hidden rounded-2xl">
          <CalendarGrid
            year={year}
            month={month}
            meetings={meetings}
            loading={loading}
            todayFocusKey={todayFocusKey}
            onMeetingClick={
              openMeetingAct
            }
            onCreateMeeting={
              isMainAdmin ? openNewMeeting : undefined
            }
          />
        </div>

        {/* =====================================================
            FORMULARIO DE REUNIÓN
            ===================================================== */}
        {isMainAdmin && (
          <MeetingForm
            open={showMeetingForm}
            circles={circles}
            meeting={editingMeeting}
            onClose={closeMeetingForm}
            onSubmit={
              handleMeetingSubmit
            }
          />
        )}

        {/* =====================================================
            ACTA DE ASISTENCIA
            ===================================================== */}
        <MeetingAttendanceModal
          meeting={openMeeting}
          open={Boolean(openMeeting)}
          refreshKey={
            attendanceRefreshKey
          }
          onClose={() =>
            setOpenMeeting(null)
          }
          onRefresh={() => {
            setAttendanceRefreshKey(
              (value) => value + 1
            );

            loadData();
          }}
        />

      </div>
    </section>
  );
};

export default Calendar;