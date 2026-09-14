import { useCallback, useEffect, useRef, useState } from "react";

import MeetingForm from "../components/calendar/MeetingForm";
import CalendarGrid from "../components/calendar/CalendarGrid";
import MonthSelector from "../components/calendar/MonthSelector";
import MasterclassButton from "../components/calendar/MasterclassButton";

import meetingService from "../services/meetingService";
import circleService from "../services/circleService";
import scheduleService from "../services/scheduleService";
import { useAuth } from "../context/AuthContext";

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [openMeeting, setOpenMeeting] = useState(null);
  const [attendanceRefreshKey, setAttendanceRefreshKey] =
    useState(0);

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
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  };

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
        for (const circle of selectedCircles) {
          await meetingService.createMeeting({
            title:
              form.type ===
              "ANUNCIOS CORPORATIVOS"
                ? "ANUNCIOS CORPORATIVOS"
                : form.title,

            type: form.type,

            circle,

            host: form.host,

            date: form.date,

            time: form.time,

            endTime: form.endTime,

            location: form.location,
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

        for (const circle of selectedCircles) {
          await scheduleService.createSchedule({
            name:
              form.title ||
              `${form.type} - ${circle}`,

            circles: [circle],

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

  return (
    <section className="min-h-[calc(100vh-125px)] bg-transparent">
      <div className="mx-auto w-full max-w-[1420px] px-4 py-5">

        {/* =====================================================
            BARRA SUPERIOR DEL CALENDARIO
            ===================================================== */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#d4deed] bg-white p-4 shadow-[0_12px_34px_rgba(0,0,0,.17)]">

          <div className="min-w-0 flex-1">
            <MonthSelector
              year={year}
              month={month}
              onPrevious={() =>
                changeMonth(-1)
              }
              onNext={() =>
                changeMonth(1)
              }
              onToday={goToday}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">

            {/* =================================================
                SELECTOR DE CÍRCULO
                ================================================= */}
            <select
              value={selectedCircle}
              onChange={(event) => {
                setSelectedCircle(
                  event.target.value
                );
              }}
              disabled={
                loading || saving
              }
              className="h-10 min-w-[190px] rounded-lg border border-[#c8d4e5] bg-white px-3 text-xs font-semibold text-[#173b7a] outline-none focus:border-[#3f6fcb] focus:ring-2 focus:ring-[#2457c5]/15"
            >
              {circles.length === 0 ? (
                <option value="">
                  Sin círculos disponibles
                </option>
              ) : (
                circles.map((circle) => {
                  const name =
                    getCircleName(circle);

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
                })
              )}
            </select>

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
                  🗑️ Eliminar Masterclass
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