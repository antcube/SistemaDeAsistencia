import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import seinfintyLogo from "../assets/seinfinty-logo.png";
import botonProximaSesion from "../assets/boton.png";
import attendanceService from "../services/attendanceService";
import meetingService from "../services/meetingService";

import "../styles/attendanceRegister.css";
import "../styles/attendanceHistory.css";
import "../styles/attendancePortal.css";

const CATEGORY_ORDER = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
];

const CATEGORY_LABELS = {
  "CIRCULO DE LIDERAZGO":
    "Círculo de Liderazgo",

  HEALTH:
    "Health",

  MENTORIA:
    "Mentoría",

  MASTERCLASS:
    "MasterClass",

  "ANUNCIOS CORPORATIVOS":
    "Anuncios Corporativos",

};

const GENERAL_JUSTIFICATION_CATEGORIES = [
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
];

const LEADERSHIP_JUSTIFICATION_LIMIT = 1;
const GENERAL_JUSTIFICATION_LIMIT = 3;

const normalizeStatus = (
  status
) => {
  const value = String(
    status || ""
  )
    .trim()
    .toUpperCase();

  if (
    value === "ASISTIO" ||
    value === "ASISTIÓ"
  ) {
    return "Asistió";
  }

  if (
    value === "CLASE PRESENCIAL"
  ) {
    return "Clase Presencial";
  }

  if (
    value === "JUSTIFICADO" ||
    value === "FALTA JUSTIFICADA"
  ) {
    return "Justificado";
  }

  if (
    value === "PENDIENTE"
  ) {
    return "Pendiente";
  }

  if (
    value === "NO ASISTIO" ||
    value === "NO ASISTIÓ" ||
    value === "FALTO" ||
    value === "FALTÓ"
  ) {
    return "No asistió";
  }

  return status || "No asistió";
};

const normalizeCategory = (
  meeting
) => {
  const type = String(
    meeting?.type || ""
  )
    .trim()
    .toUpperCase();

  const title = String(
    meeting?.title || ""
  )
    .trim()
    .toUpperCase();

  if (
    type === "CIRCULO DE LIDERAZGO" ||
    type === "MES" ||
    title.includes("CIRCULO DE LIDERAZGO") ||
    title === "MES" ||
    /^SESI[ÓO]N\s+\d+$/i.test(title)
  ) {
    return "CIRCULO DE LIDERAZGO";
  }

  if (
    type === "MENTORIA" ||
    type === "MENTORÍA" ||
    title === "MENTORIA" ||
    title === "MENTORÍA"
  ) {
    return "MENTORIA";
  }

  if (
    type === "MASTERCLASS" ||
    title.includes("MASTERCLASS")
  ) {
    return "MASTERCLASS";
  }

  if (
    type === "HEALTH" ||
    title === "HEALTH"
  ) {
    return "HEALTH";
  }

  if (
    type === "ANUNCIOS CORPORATIVOS" ||
    type === "ANUNCIO CORPORATIVO" ||
    title.includes("ANUNCIOS CORPORATIVOS") ||
    title.includes("ANUNCIO CORPORATIVO")
  ) {
    return "ANUNCIOS CORPORATIVOS";
  }

  return type || "";
};

const isJustified = (
  status
) =>
  normalizeStatus(status) ===
  "Justificado";

const AttendancePortal = () => {
  const today =
    new Date();

  const [year, setYear] =
    useState(
      today.getFullYear()
    );

  const [month, setMonth] =
    useState(
      today.getMonth() + 1
    );

  const [dni, setDni] =
    useState("");

  const [searchedDni, setSearchedDni] =
    useState("");

  const [member, setMember] =
    useState(null);

  const [meetings, setMeetings] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [ringProgress, setRingProgress] =
    useState(0);

  const [lastUpdatedAt, setLastUpdatedAt] =
    useState(null);

  const [error, setError] =
    useState("");

  const [searched, setSearched] =
    useState(false);

  const [collapsedCategories, setCollapsedCategories] =
    useState({});

  const [timelineCollapsed, setTimelineCollapsed] =
    useState(false);

  const [highlightedSessionId, setHighlightedSessionId] =
    useState("");

  const highlightTimerRef = useRef(null);
  const goToTodayPendingRef = useRef(false);
  const goToTodayTargetRef = useRef(null);

  const [justificationMeeting, setJustificationMeeting] = useState(null);
  const [justificationReason, setJustificationReason] = useState("");
  const [justificationSending, setJustificationSending] = useState(false);
  const [justificationError, setJustificationError] = useState("");

  const toggleCategory = (category) => {
    setCollapsedCategories((current) => ({
      ...current,
      [category]: !current[category],
    }));
  };

  const [isQrMode, setIsQrMode] =
    useState(false);

  const [qrMeeting, setQrMeeting] =
    useState(null);

  const [qrDni, setQrDni] =
    useState("");

  const [qrLoading, setQrLoading] =
    useState(false);

  const [qrSubmitting, setQrSubmitting] =
    useState(false);

  const [qrError, setQrError] =
    useState("");

  const [qrSuccess, setQrSuccess] =
    useState("");

  const [qrNow, setQrNow] =
    useState(Date.now());

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const qrId =
      params.get(
        "asistencia_qr"
      );

    

    if (!qrId) {
      setIsQrMode(false);
      return;
    }

    setIsQrMode(true);

    let cancelled =
      false;

    const loadQrMeeting =
      async () => {
        try {
          setQrLoading(true);
          setQrError("");
          setQrSuccess("");
          setMember(null);
          setMeetings([]);

          const response =
            await meetingService.getPublicQrMeeting(
              qrId
            );

          const data =
            response?.data ||
            response;

          const rawMeeting =
            data?.meeting ||
            null;

          if (!rawMeeting) {
            throw new Error(
              "Este QR no está disponible."
            );
          }

          

          const normalizedMeeting = {
            ...rawMeeting,

            _id:
              rawMeeting._id ||
              rawMeeting.id ||
              qrId,

            id:
              rawMeeting.id ||
              rawMeeting._id ||
              qrId,
          };

          if (!cancelled) {
            setQrMeeting(
              normalizedMeeting
            );
          }
        } catch (err) {
          console.error(
            "Error cargando QR:",
            err
          );

          if (!cancelled) {
            setQrMeeting(null);

            setQrError(
              err?.message ||
                "Este QR no está disponible."
            );
          }
        } finally {
          if (!cancelled) {
            setQrLoading(false);
          }
        }
      };

    loadQrMeeting();

    const timer =
      window.setInterval(
        () =>
          setQrNow(
            Date.now()
          ),
        1000
      );

    return () => {
      cancelled = true;
      window.clearInterval(
        timer
      );
    };
  }, []);

  const handleQrSubmit =
    async (event) => {
      event.preventDefault();

      const cleanDni =
        String(
          qrDni || ""
        ).trim();

      const meetingId =
        qrMeeting?._id ||
        qrMeeting?.id;

      if (!meetingId) {
        setQrError(
          "No se pudo identificar la reunión."
        );

        return;
      }

      if (!cleanDni) {
        setQrError(
          "Ingresa tu DNI para registrar tu asistencia."
        );

        return;
      }

      const start =
        qrMeeting?.qrStartTimestamp
          ? new Date(
              qrMeeting.qrStartTimestamp
            ).getTime()
          : 0;

      const end =
        qrMeeting?.qrEndTimestamp
          ? new Date(
              qrMeeting.qrEndTimestamp
            ).getTime()
          : 0;

      const now =
        Date.now();

      if (
        start &&
        now < start
      ) {
        setQrError(
          "El QR todavía no está disponible."
        );

        return;
      }

      if (
        end &&
        end <= now
      ) {
        setQrError(
          "El tiempo para registrar asistencia ha expirado."
        );

        return;
      }

      try {
        setQrSubmitting(true);
        setQrError("");
        setQrSuccess("");

        

        const response =
          await attendanceService.registerByQr(
            meetingId,
            cleanDni
          );

        const data =
          response?.data ||
          response;

        setQrSuccess(
          data?.message ||
            "Asistencia registrada correctamente."
        );

        setQrDni("");
      } catch (err) {
        console.error(
          "Error registrando asistencia QR:",
          err
        );

        setQrError(
          err?.message ||
            "No se pudo registrar la asistencia."
        );
      } finally {
        setQrSubmitting(false);
      }
    };

  const qrRemainingMs =
    qrMeeting?.qrEndTimestamp
      ? Math.max(
          0,
          new Date(
            qrMeeting.qrEndTimestamp
          ).getTime() -
            qrNow
        )
      : 0;

  const qrRemainingMinutes =
    Math.floor(
      qrRemainingMs /
        60000
    );

  const qrRemainingSeconds =
    Math.floor(
      (qrRemainingMs %
        60000) /
        1000
    );

  const qrIsExpired =
    Boolean(
      qrMeeting &&
        qrMeeting.qrEndTimestamp &&
        new Date(
          qrMeeting.qrEndTimestamp
        ).getTime() <=
          qrNow
    );

  const loadAttendance =
    useCallback(
      async (
        dniToSearch =
          searchedDni,
        yearToLoad = year,
        monthToLoad = month
      ) => {
        const cleanDni =
          String(
            dniToSearch || ""
          ).trim();

        if (!cleanDni) {
          setError(
            "Ingresa tu DNI para consultar tu asistencia."
          );

          setMember(null);
          setMeetings([]);
          setSearched(false);

          return;
        }

        try {
          setLoading(true);
          setError("");

          const response =
            await attendanceService.getUserAttendance(
              cleanDni,
              yearToLoad,
              monthToLoad
            );

          const data =
            response?.data ||
            response;

          setMember(
            data?.user ||
              null
          );

          setMeetings(
            Array.isArray(
              data?.meetings
            )
              ? data.meetings
              : []
          );

          setSearchedDni(
            cleanDni
          );

          // Cada carga exitosa representa la última actualización
          // visible del historial. Se muestra la hora exacta de esta carga.
          setLastUpdatedAt(new Date());

          setSearched(true);
        } catch (err) {
          console.error(
            "Error consultando asistencia:",
            err
          );

          setMember(null);
          setMeetings([]);
          setSearched(true);

          setError(
            err?.message ||
              "No se pudo consultar la asistencia."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        searchedDni,
        year,
        month,
      ]
    );

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      await loadAttendance(
        dni
      );
    };

  const refresh =
    async () => {
      if (!searchedDni) {
        return;
      }

      await loadAttendance(
        searchedDni
      );
    };

  const moveMonth = (
    amount
  ) => {
    let nextMonth =
      month + amount;

    let nextYear =
      year;

    if (
      nextMonth > 12
    ) {
      nextMonth = 1;
      nextYear += 1;
    }

    if (
      nextMonth < 1
    ) {
      nextMonth = 12;
      nextYear -= 1;
    }

    setMonth(
      nextMonth
    );

    setYear(
      nextYear
    );

    if (searchedDni) {
      loadAttendance(
        searchedDni,
        nextYear,
        nextMonth
      );
    }
  };

  const goToToday = async () => {
    const current = new Date();
    const todayKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth() + 1;

    if (!searchedDni) return;

    try {
      setLoading(true);
      setError("");
      goToTodayPendingRef.current = true;
      goToTodayTargetRef.current = null;

      let target = null;
      let targetYear = currentYear;
      let targetMonth = currentMonth;
      let targetData = null;

      // Revisamos el mes actual y, si no hay una reunión hoy ni una
      // anterior, retrocedemos mes a mes hasta encontrar la más cercana.
      for (let offset = 0; offset <= 12 && !target; offset += 1) {
        const date = new Date(currentYear, currentMonth - 1 - offset, 1);
        const checkYear = date.getFullYear();
        const checkMonth = date.getMonth() + 1;

        const response = await attendanceService.getUserAttendance(
          searchedDni,
          checkYear,
          checkMonth
        );

        const data = response?.data || response;
        const monthMeetings = Array.isArray(data?.meetings) ? data.meetings : [];

        const candidates = monthMeetings
          .filter((meeting) => {
            const dateKey = String(meeting?.date || "").slice(0, 10);
            return dateKey && dateKey <= todayKey;
          })
          .sort((a, b) => {
            const dateCompare = String(b?.date || "").localeCompare(String(a?.date || ""));
            if (dateCompare !== 0) return dateCompare;
            return String(b?.time || "").localeCompare(String(a?.time || ""));
          });

        target = candidates[0] || null;

        if (target) {
          targetYear = checkYear;
          targetMonth = checkMonth;
          targetData = data;
        }
      }

      if (!target || !targetData) {
        goToTodayPendingRef.current = false;
        setLoading(false);
        setError("No se encontró una reunión de hoy ni una reunión anterior.");
        return;
      }

      setMember(targetData?.user || null);
      setMeetings(targetData?.meetings || []);
      setYear(targetYear);
      setMonth(targetMonth);
      setSearched(true);
      goToTodayTargetRef.current = target;
    } catch (err) {
      console.error("Error buscando la reunión para Ir a hoy:", err);
      goToTodayPendingRef.current = false;
      goToTodayTargetRef.current = null;
      setError(err?.message || "No se pudo localizar la reunión correspondiente.");
    } finally {
      setLoading(false);
    }
  };

  const monthLabel =
    new Date(
      year,
      month - 1,
      1
    ).toLocaleDateString(
      "es-PE",
      {
        month:
          "long",
        year:
          "numeric",
      }
    );

  const effectiveMeetings =
    useMemo(() => {
      const leadershipJustifications = [];
      const generalJustifications = [];

      meetings.forEach((meeting) => {
        const category =
          normalizeCategory(meeting);

        if (!isJustified(meeting.status)) {
          return;
        }

        const item = {
          meeting,
          category,
          date: meeting?.date || "",
          time: meeting?.time || "",
        };

        if (
          category ===
          "CIRCULO DE LIDERAZGO"
        ) {
          leadershipJustifications.push(item);
        } else if (
          GENERAL_JUSTIFICATION_CATEGORIES.includes(
            category
          )
        ) {
          generalJustifications.push(item);
        }
      });

      const sorter = (a, b) =>
        String(a.date).localeCompare(
          String(b.date)
        ) ||
        String(a.time).localeCompare(
          String(b.time)
        ) ||
        String(
          a.meeting?.meetingId ||
            a.meeting?._id ||
            a.meeting?.id ||
            ""
        ).localeCompare(
          String(
            b.meeting?.meetingId ||
              b.meeting?._id ||
              b.meeting?.id ||
              ""
          )
        );

      leadershipJustifications.sort(sorter);
      generalJustifications.sort(sorter);

      const validJustifications = new Set();
      const extraJustifications = new Set();

      leadershipJustifications.forEach(
        (item, index) => {
          const key = String(
            item.meeting?.meetingId ||
              item.meeting?._id ||
              item.meeting?.id ||
              ""
          );

          if (
            index <
            LEADERSHIP_JUSTIFICATION_LIMIT
          ) {
            validJustifications.add(key);
          } else {
            extraJustifications.add(key);
          }
        }
      );

      generalJustifications.forEach(
        (item, index) => {
          const key = String(
            item.meeting?.meetingId ||
              item.meeting?._id ||
              item.meeting?.id ||
              ""
          );

          if (
            index <
            GENERAL_JUSTIFICATION_LIMIT
          ) {
            validJustifications.add(key);
          } else {
            extraJustifications.add(key);
          }
        }
      );

      return meetings.map((meeting) => {
        const status =
          normalizeStatus(meeting.status);

        if (!isJustified(status)) {
          return {
            ...meeting,
            status,
            justificationValidity: null,
          };
        }

        const key = String(
          meeting?.meetingId ||
            meeting?._id ||
            meeting?.id ||
            ""
        );

        if (
          validJustifications.has(key)
        ) {
          return {
            ...meeting,
            status: "Justificado",
            justificationValidity: "valid",
          };
        }

        if (
          extraJustifications.has(key)
        ) {
          return {
            ...meeting,
            status: "Justificado",
            justificationValidity: "extra",
          };
        }

        return {
          ...meeting,
          status: "Justificado",
          justificationValidity: "extra",
        };
      });
    }, [meetings]);

  const summary =
    useMemo(() => {
      let attended = 0;
      let absent = 0;
      let presencial = 0;

      effectiveMeetings.forEach(
        (meeting) => {
          const status =
            normalizeStatus(
              meeting.status
            );

          if (
            status === "Asistió"
          ) {
            attended++;
          }

          if (
            status ===
            "Clase Presencial"
          ) {
            presencial++;
          }

          if (
            status ===
              "Justificado" &&
            meeting.justificationValidity ===
              "valid"
          ) {
            attended++;
          }

          if (
            status ===
              "Justificado" &&
            meeting.justificationValidity ===
              "extra"
          ) {
            absent++;
          }

          if (
            status ===
            "No asistió"
          ) {
            absent++;
          }
        }
      );

      const total =
        effectiveMeetings.length;

      const completedSessions =
        effectiveMeetings.filter(
          (meeting) => {
            const rawStatus = String(
              meeting?.status ??
                ""
            )
              .trim()
              .toUpperCase();

            return (
              rawStatus !== "" &&
              rawStatus !== "PENDIENTE"
            );
          }
        ).length;

      const allSessionsCompleted =
        total > 0 &&
        completedSessions === total;

      const bonus =
        allSessionsCompleted &&
        absent === 0 &&
        attended + presencial === total;

      return {
        total,
        attended,
        presencial,
        valid: attended + presencial,
        absent,
        completedSessions,
        allSessionsCompleted,
        bonus,
      };
    }, [effectiveMeetings]);

  const groupedMeetings =
    useMemo(() => {
      const groups =
        {};

      CATEGORY_ORDER.forEach(
        (category) => {
          groups[
            category
          ] = [];
        }
      );

      effectiveMeetings.forEach(
        (meeting) => {
          const type =
            normalizeCategory(meeting)
              .trim()
              .toUpperCase();

          if (
            !groups[type]
          ) {
            groups[type] =
              [];
          }

          groups[type].push(
            meeting
          );
        }
      );

      Object.keys(
        groups
      ).forEach(
        (category) => {
          groups[
            category
          ].sort(
            (a, b) =>
              String(
                a.date || ""
              ).localeCompare(
                String(
                  b.date || ""
                )
              ) ||
              String(
                a.time || ""
              ).localeCompare(
                String(
                  b.time || ""
                )
              )
          );
        }
      );

      return groups;
    }, [
      effectiveMeetings,
    ]);

  const formatDate = (
    value
  ) => {
    if (!value) {
      return "—";
    }

    const parts =
      String(
        value
      ).split("-");

    if (
      parts.length !== 3
    ) {
      return value;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getCategoryBadgeClasses = (category) => {
    const value = String(category || "")
      .trim()
      .toUpperCase();

    switch (value) {
      case "CIRCULO DE LIDERAZGO":
        return "border border-[#a9c4ef] bg-[#e7efff] text-[#2457c5]";

      case "HEALTH":
        return "border border-[#9adfe8] bg-[#e2f8fb] text-[#188da0]";

      case "MENTORIA":
        return "border border-[#c6b7e8] bg-[#eee9fb] text-[#7654c6]";

      case "MASTERCLASS":
        return "border border-[#c2c8d0] bg-[#edf0f3] text-[#68717e]";

      case "ANUNCIOS CORPORATIVOS":
        return "border border-[#1e3158] bg-[#e8edf6] text-[#0b1736]";

      default:
        return "border border-[#cbd6e4] bg-[#f0f4f9] text-[#294763]";
    }
  };
  const getStatusClass = (status, justificationValidity = null) => {
    const normalized = normalizeStatus(status);

    if (normalized === "Justificado" && justificationValidity === "extra") {
      return "portal-status absent";
    }

    if (normalized === "Asistió") return "portal-status attended";
    if (normalized === "Clase Presencial") return "portal-status presencial";
    if (normalized === "Justificado") return "portal-status justified";
    return "portal-status absent";
  };

  const getStatusSymbol =
    (status) => {
      const normalized =
        normalizeStatus(
          status
        );

      if (
        normalized ===
        "Asistió"
      ) {
        return "✓";
      }

      if (
        normalized ===
        "Clase Presencial"
      ) {
        return "P";
      }

      if (
        normalized ===
        "Justificado"
      ) {
        return "J";
      }

      return "F";
    };

  // Regla central del historial: mientras la fecha de una sesión no haya
  // llegado, esa sesión no tiene resultado y nunca debe contarse como falta.
  function isFutureMeeting(meeting) {
    const meetingDateKey = String(meeting?.date || "").slice(0, 10);
    if (!meetingDateKey) return false;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    return meetingDateKey > todayKey;
  }

  // La tarjeta "Asistencias" cuenta únicamente asistencias reales.
  // Una J válida sigue siendo una justificación en su tarjeta,
  // pero también cuenta como asistencia para el porcentaje del círculo.
  const attendedCount = effectiveMeetings.filter((meeting) => {
    if (isFutureMeeting(meeting)) return false;
    const status = normalizeStatus(meeting.status);
    return status === "Asistió" || status === "Clase Presencial";
  }).length;

  const justifiedCount = effectiveMeetings.filter((meeting) => {
    if (isFutureMeeting(meeting)) return false;
    return normalizeStatus(meeting.status) === "Justificado";
  }).length;

  const validJustifiedCount = effectiveMeetings.filter((meeting) => {
    if (isFutureMeeting(meeting)) return false;
    return (
      normalizeStatus(meeting.status) === "Justificado" &&
      meeting.justificationValidity === "valid"
    );
  }).length;

  const absentCount = effectiveMeetings.filter((meeting) => {
    if (isFutureMeeting(meeting)) return false;
    const status = normalizeStatus(meeting.status);
    return status === "No asistió" ||
      (status === "Justificado" && meeting.justificationValidity === "extra");
  }).length;

  // Este contador representa TODAS las sesiones existentes en el mes,
  // igual que el cuadro "Sesiones" del Reporte Mensual.
  const sessionCount = effectiveMeetings.length;

  // Para el porcentaje, una J válida cuenta como asistencia.
  const attendanceEffectiveCount = attendedCount + validJustifiedCount;
  // El porcentaje usa el total de sesiones existentes en el mes.
  // Una J válida cuenta como asistencia para este indicador.
  const attendancePercent = sessionCount > 0
    ? Math.round((attendanceEffectiveCount / sessionCount) * 100)
    : 0;

  useEffect(() => {
    // Mientras se actualizan los datos, el aro vuelve a 0.
    // Al terminar, se llena suavemente hasta el porcentaje real.
    if (loading) {
      setRingProgress(0);
      return undefined;
    }

    const target = Math.max(0, Math.min(100, attendancePercent));
    const duration = 900;
    const startTime = performance.now();
    let frameId;

    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setRingProgress(target * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [loading, attendancePercent]);

  const timelineMeetings = useMemo(() => {
    return [...effectiveMeetings].sort((a, b) =>
      String(a.date || "").localeCompare(String(b.date || "")) ||
      String(a.time || "").localeCompare(String(b.time || ""))
    );
  }, [effectiveMeetings]);

  const [nextSessionTick, setNextSessionTick] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNextSessionTick((value) => value + 1);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  const nextSession = useMemo(() => {
    const now = new Date();

    const getMeetingStart = (meeting) => {
      const dateKey = String(meeting?.date || "").slice(0, 10);
      const time = String(meeting?.time || "").slice(0, 5);

      if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;

      const [hours, minutes] = time
        ? time.split(":").map(Number)
        : [0, 0];

      const date = new Date(`${dateKey}T00:00:00`);
      date.setHours(
        Number.isFinite(hours) ? hours : 0,
        Number.isFinite(minutes) ? minutes : 0,
        0,
        0
      );

      return date;
    };

    const getMeetingEnd = (meeting, start) => {
      const endTime = String(meeting?.endTime || "").slice(0, 5);
      if (!endTime || !start) return start ? new Date(start.getTime() + 60 * 60 * 1000) : null;

      const [hours, minutes] = endTime.split(":").map(Number);
      const end = new Date(start);
      end.setHours(
        Number.isFinite(hours) ? hours : start.getHours() + 1,
        Number.isFinite(minutes) ? minutes : start.getMinutes(),
        0,
        0
      );

      if (end <= start) {
        end.setDate(end.getDate() + 1);
      }

      return end;
    };

    return effectiveMeetings
      .map((meeting) => {
        const start = getMeetingStart(meeting);
        const end = getMeetingEnd(meeting, start);
        return start ? { meeting, start, end } : null;
      })
      .filter(Boolean)
      .filter(({ start, end }) => end >= now)
      .sort((a, b) => a.start - b.start)[0]?.meeting || null;
  }, [effectiveMeetings, nextSessionTick]);

  const getNextSessionDayLabel = (meeting) => {
    if (!meeting?.date) return "Sin Sesiones Pendientes";

    const dateKey = String(meeting.date).slice(0, 10);
    const [yearValue, monthValue, dayValue] = dateKey.split("-").map(Number);
    const sessionDate = new Date(yearValue, monthValue - 1, dayValue);
    const now = new Date();

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const sessionStart = new Date(
      sessionDate.getFullYear(),
      sessionDate.getMonth(),
      sessionDate.getDate()
    );

    const diffDays = Math.round(
      (sessionStart - todayStart) / (24 * 60 * 60 * 1000)
    );

    const time = String(meeting?.time || "").slice(0, 5);
    const [hours, minutes] = time ? time.split(":").map(Number) : [0, 0];
    const startDateTime = new Date(sessionStart);
    startDateTime.setHours(
      Number.isFinite(hours) ? hours : 0,
      Number.isFinite(minutes) ? minutes : 0,
      0,
      0
    );

    const endTime = String(meeting?.endTime || "").slice(0, 5);
    const endDateTime = new Date(startDateTime);
    if (endTime) {
      const [endHours, endMinutes] = endTime.split(":").map(Number);
      endDateTime.setHours(
        Number.isFinite(endHours) ? endHours : startDateTime.getHours() + 1,
        Number.isFinite(endMinutes) ? endMinutes : startDateTime.getMinutes(),
        0,
        0
      );
      if (endDateTime <= startDateTime) endDateTime.setDate(endDateTime.getDate() + 1);
    } else {
      endDateTime.setHours(endDateTime.getHours() + 1);
    }

    if (now >= startDateTime && now <= endDateTime) return "Ahora";

    if (diffDays === 0) {
      const diffMinutes = Math.max(0, Math.ceil((startDateTime - now) / 60000));

      if (diffMinutes <= 0) return "Ahora";
      if (diffMinutes < 60) {
        return `En ${diffMinutes} ${diffMinutes === 1 ? "Minuto" : "Minutos"}`;
      }

      const diffHours = Math.floor(diffMinutes / 60);
      return `En ${diffHours} ${diffHours === 1 ? "Hora" : "Horas"}`;
    }

    if (diffDays === 1) return "Mañana";

    return sessionDate
      .toLocaleDateString("es-PE", { weekday: "long" })
      .replace(/^./, (letter) => letter.toUpperCase());
  };

  const getNextSessionDayNumber = (meeting) => {
    if (!meeting?.date) return "—";
    return String(meeting.date).slice(8, 10);
  };

  const getNextSessionMonthShort = (meeting) => {
    if (!meeting?.date) return "";

    const dateKey = String(meeting.date).slice(0, 10);
    const [yearValue, monthValue] = dateKey.split("-").map(Number);
    return new Date(yearValue, monthValue - 1, 1)
      .toLocaleDateString("es-PE", { month: "short" })
      .replace(".", "")
      .toUpperCase();
  };

  const getShortDay = (value) => {
    if (!value) return "—";
    const parts = String(value).split("-");
    return parts.length === 3 ? parts[2] : String(value).slice(-2);
  };

  const getTimelineStatus = (meeting) => {
    if (!meeting) return "empty";

    // REGLA DEL HISTORIAL: una reunión cuya fecha todavía no ha llegado
    // nunca puede mostrarse como falta, aunque el backend ya tenga un
    // estado provisional o haya generado la sesión automáticamente.
    // Hasta que llegue la fecha de la reunión, se representa como pendiente.
    const meetingDateKey = String(meeting?.date || "").slice(0, 10);
    if (meetingDateKey) {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      if (meetingDateKey > todayKey) {
        return "scheduled";
      }
    }

    const status = normalizeStatus(meeting.status);

    if (
      status === "No asistió" ||
      (status === "Justificado" && meeting.justificationValidity === "extra")
    ) {
      return "absent";
    }

    if (status === "Justificado") return "justified";
    if (status === "Asistió" || status === "Clase Presencial") return "attended";
    if (status === "Pendiente") return "scheduled";

    return "empty";
  };

  const getMeetingDomId = (meeting) => {
    const key = String(
      meeting?.meetingId ||
        meeting?._id ||
        meeting?.id ||
        `${meeting?.date || ""}-${meeting?.time || ""}-${meeting?.title || ""}`
    );

    return `portal-session-${encodeURIComponent(key)}`;
  };

  useEffect(() => {
    if (!goToTodayPendingRef.current || !goToTodayTargetRef.current) return;

    const target = goToTodayTargetRef.current;
    const targetId = getMeetingDomId(target);
    const domTarget = document.getElementById(targetId);

    // Esperamos un render adicional si la reunión todavía no existe en el DOM.
    if (!domTarget) return;

    goToTodayPendingRef.current = false;
    goToTodayTargetRef.current = null;
    handleTimelineClick({ meeting: target });
  }, [timelineMeetings, searchedDni]);

  const handleTimelineClick = (item) => {
    if (!item?.meeting) return;

    const category = normalizeCategory(item.meeting);
    const sessionId = getMeetingDomId(item.meeting);

    // Si la categoría está cerrada, la abrimos antes de desplazar la vista.
    setCollapsedCategories((current) => ({
      ...current,
      [category]: false,
    }));

    // Si ya había una sesión resaltada, quitamos su temporizador para que
    // cada nuevo click tenga su propia animación completa.
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }

    setHighlightedSessionId("");

    // Esperamos a que React pinte la categoría abierta y llevamos al usuario
    // exactamente a la sesión correspondiente. Una vez localizada, la
    // resaltamos durante unos segundos para que sea evidente cuál fue la sesión.
    window.setTimeout(() => {
      const target = document.getElementById(sessionId);

      if (!target) return;

      setHighlightedSessionId(sessionId);

      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedSessionId("");
        highlightTimerRef.current = null;
      }, 2400);
    }, 140);
  };

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const timelineDays = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const meetingsByDate = new Map();

    const statusPriority = {
      absent: 4,
      justified: 3,
      attended: 2,
      scheduled: 1,
      empty: 0,
    };

    timelineMeetings.forEach((meeting) => {
      const dateKey = String(meeting?.date || "").slice(0, 10);
      if (!dateKey) return;

      const current = meetingsByDate.get(dateKey);
      const nextStatus = getTimelineStatus(meeting);

      if (!current || statusPriority[nextStatus] > statusPriority[current.status]) {
        meetingsByDate.set(dateKey, {
          meeting,
          status: nextStatus,
        });
      }
    });

    const todayDate = new Date();
    const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

    const weekdayLabels = ["D", "L", "M", "X", "J", "V", "S"];

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const entry = meetingsByDate.get(dateKey);

      return {
        day,
        dateKey,
        weekday: weekdayLabels[new Date(year, month - 1, day).getDay()],
        meeting: entry?.meeting || null,
        status: entry?.status || "empty",
        isToday: dateKey === todayKey,
      };
    });
  }, [timelineMeetings, year, month]);


  const getAttendanceRecordTimestamp = (meeting) => {
    const value =
      meeting?.registeredAt ||
      meeting?.absenceRecordedAt ||
      null;

    if (!value) return null;

    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  };

  const addBusinessDays = (timestamp, businessDays) => {
    const date = new Date(timestamp);
    let remaining = businessDays;

    while (remaining > 0) {
      date.setTime(date.getTime() + 24 * 60 * 60 * 1000);
      const day = date.getDay();

      if (day !== 0 && day !== 6) {
        remaining -= 1;
      }
    }

    return date.getTime();
  };

  const canJustifyMeeting = (meeting) => {
    if (!meeting || isFutureMeeting(meeting)) return false;
    if (normalizeStatus(meeting.status) !== "No asistió") return false;
    if (meeting.justificationValidity === "extra") return false;

    const recordedAt = getAttendanceRecordTimestamp(meeting);
    if (!recordedAt) return false;

    return Date.now() <= addBusinessDays(recordedAt, 2);
  };

  const openJustification = (meeting) => {
    setJustificationMeeting(meeting);
    setJustificationReason("");
    setJustificationError("");
  };

  const closeJustification = () => {
    if (justificationSending) return;
    setJustificationMeeting(null);
    setJustificationReason("");
    setJustificationError("");
  };

  const sendJustificationWhatsApp = async () => {
    if (!justificationMeeting || !justificationReason) {
      setJustificationError("Selecciona un motivo para continuar.");
      return;
    }

    const gestorWhatsapp = String(member?.gestorWhatsapp || "").replace(/\D/g, "");

    if (!gestorWhatsapp) {
      setJustificationError(
        "No se encontró un Gestor de Círculo con WhatsApp configurado para tu círculo."
      );
      return;
    }

    if (!canJustifyMeeting(justificationMeeting)) {
      setJustificationError(
        "El plazo de 2 días hábiles para justificar esta inasistencia ya finalizó."
      );
      return;
    }

    const category = normalizeCategory(justificationMeeting);
    const classType = CATEGORY_LABELS[category] || justificationMeeting.title || category || "Sesión";
    const sessionDate = formatDate(justificationMeeting.date);

    const message =
      `*Estimado equipo, solicito la justificación de mi inasistencia a la sesión de* ` +
      `*${classType}* ` +
      `*del día* *${sessionDate}* ` +
      `*por motivos de* *${justificationReason}*.`;

    try {
      setJustificationSending(true);
      setJustificationError("");

      const whatsappUrl =
        `https://wa.me/${gestorWhatsapp}?text=${encodeURIComponent(message)}`;

      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      setJustificationMeeting(null);
      setJustificationReason("");
      setJustificationError("");
    } catch (err) {
      console.error("Error abriendo WhatsApp:", err);
      setJustificationError("No se pudo abrir WhatsApp.");
    } finally {
      setJustificationSending(false);
    }
  };


  return (
    <main className="attendance-portal-page">

      {}

      {isQrMode && (
        <>
          {qrLoading && (
            <section className="attendance-portal-login attendance-register-view">

              <div className="attendance-portal-logo">
                📱
              </div>

              <h1>
                Validando{" "}
                <strong>
                  QR
                </strong>
              </h1>

              <p>
                Comprobando la disponibilidad
                de la sesión...
              </p>

            </section>
          )}

          {!qrLoading && qrMeeting && (
            <section className="attendance-portal-login attendance-register-view">

              <div className="attendance-portal-logo">
                📱
              </div>

              <span className="attendance-portal-kicker">
                CÍRCULOS CONNECT / ASISTENCIA
              </span>

              <h1>
                {qrMeeting.title ||
                  qrMeeting.type ||
                  "Registro de asistencia"}
              </h1>

              <p>
                {qrMeeting.circle ||
                  "Círculo"}{" "}
                ·{" "}
                {qrMeeting.date ||
                  "—"}{" "}
                ·{" "}
                {qrMeeting.time ||
                  "—"}
              </p>

              {!qrIsExpired &&
              qrRemainingMs > 0 ? (
                <form
                  onSubmit={
                    handleQrSubmit
                  }
                  className="attendance-portal-form"
                >

                  <label>
                    DNI / N° de Documento
                  </label>

                  <div className="attendance-portal-input-wrap">

                    <span>
                      🆔
                    </span>

                    <input
                      type="text"
                      value={
                        qrDni
                      }
                      onChange={(
                        event
                      ) =>
                        setQrDni(
                          event.target.value
                        )
                      }
                      placeholder="Ej: 74839201"
                      maxLength={12}
                      autoComplete="off"
                      inputMode="numeric"
                      autoFocus
                    />

                  </div>

                  <div className="text-center text-sm font-bold text-emerald-700">
                    ⏱️ Tiempo disponible:{" "}
                    {String(
                      qrRemainingMinutes
                    ).padStart(
                      2,
                      "0"
                    )}
                    :
                    {String(
                      qrRemainingSeconds
                    ).padStart(
                      2,
                      "0"
                    )}
                  </div>

                  {qrError && (
                    <div className="attendance-portal-error">
                      {qrError}
                    </div>
                  )}

                  {qrSuccess && (
                    <div className="attendance-portal-success">
                      {qrSuccess}
                    </div>
                  )}

                  {!qrSuccess && (
                    <button
                      type="submit"
                      className="attendance-portal-submit"
                      disabled={
                        qrSubmitting
                      }
                    >
                      {qrSubmitting
                        ? "Registrando..."
                        : "Registrar asistencia"}
                    </button>
                  )}

                </form>
              ) : (
                <div className="attendance-portal-error">
                  ❌ El tiempo límite para marcar asistencia ha finalizado.
                </div>
              )}

            </section>
          )}

          {!qrLoading &&
            !qrMeeting && (
              <section className="attendance-portal-login attendance-register-view">

                <div className="attendance-portal-logo">
                  ❌
                </div>

                <span className="attendance-portal-kicker">
                  CÍRCULOS CONNECT / ASISTENCIA
                </span>

                <h1>
                  QR no disponible
                </h1>

                <p>
                  {qrError ||
                    "Este QR no está disponible o ya expiró."}
                </p>

              </section>
            )}
        </>
      )}

      {}

      {!isQrMode &&
        !member && (
          <section className="attendance-portal-login attendance-history-login-view">

            <div className="attendance-login-shell">

              <div className="attendance-login-logo-space">
              <img
              src={seinfintyLogo}
              alt="SEINFINITY"
              className="attendance-login-logo"
              />

            <div className="attendance-login-kicker">
            CÍRCULOS CONNECT
            </div>
            </div>

              <div className="attendance-login-card">

                <div className="attendance-login-header">
                  <h1>
                    Portal del <span>Embajador</span>
                  </h1>

                  <p>
                    Ingresa con tu DNI para consultar tu historial de
                    asistencias.
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="attendance-portal-form attendance-login-form"
                >
                  <label htmlFor="attendance-dni">
                    DNI / N° de documento
                  </label>

                  <div className="attendance-login-input-wrap">
                    <div className="attendance-login-input-icon">
                      <span>▣</span>
                    </div>

                    <input
                      id="attendance-dni"
                      type="text"
                      value={dni}
                      onChange={(event) =>
                        setDni(event.target.value)
                      }
                      placeholder="Ingresa tu DNI"
                      maxLength={12}
                      autoComplete="off"
                      inputMode="numeric"
                    />
                  </div>

                  {error && (
                    <div className="attendance-portal-error attendance-login-error">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="attendance-login-submit"
                    disabled={loading}
                  >
                    <span>
                      {loading
                        ? "Consultando..."
                        : "Consultar asistencia"}
                    </span>
                  </button>
                </form>

                <div className="attendance-login-footer">
                  <span>Acceso exclusivo para embajadores registrados</span>
                </div>

              </div>

            </div>

          </section>
        )}

      {}

      {!isQrMode && member && (
        <div className="attendance-portal-content attendance-history-view">
          <header className="portal-topbar">
            <div className="portal-brand">
              <img src={seinfintyLogo} alt="SEINFINITY" />
            </div>
            <div className="portal-connect">
              <strong>Círculos Connect</strong>
              <span>Portal del Embajador</span>
            </div>
            <button type="button" className="portal-exit" onClick={() => {
              setMember(null);
              setMeetings([]);
              setSearched(false);
              setError("");
            }}>
              <span>↪</span> Salir
            </button>
          </header>

          <section className="portal-profile-bar">
            <div className="portal-profile-main">
              <div className="portal-avatar">
                {String(member.name || member.nombre || "E").charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="portal-eyebrow">Hola de nuevo</span>
                <h1>{member.name || member.nombre || "Embajador"}</h1>
                <p>DNI {searchedDni}</p>
              </div>
            </div>

            <button
              type="button"
              className="portal-next-session"
              style={{
                backgroundImage: `url(${botonProximaSesion})`,
              }}
              onClick={() => {
                if (nextSession) handleTimelineClick({ meeting: nextSession });
              }}
              disabled={!nextSession}
              aria-label={
                nextSession
                  ? `Ir a la próxima sesión: ${nextSession.title || normalizeCategory(nextSession)}`
                  : "No hay sesiones pendientes"
              }
            >
              <div className="portal-next-session-date">
                <strong>{getNextSessionDayNumber(nextSession)}</strong>
                <span>{getNextSessionMonthShort(nextSession)}</span>
              </div>

              <div className="portal-next-session-content">
                <span>PRÓXIMA SESIÓN</span>

                <strong>
                  {nextSession?.title ||
                    (nextSession ? normalizeCategory(nextSession) : "Sin Sesiones Pendientes")}
                </strong>

                <small>
                  {nextSession
                    ? `${getNextSessionDayLabel(nextSession)}${nextSession.time ? `, ${nextSession.time}${nextSession.endTime ? ` – ${nextSession.endTime}` : ""}` : ""}${nextSession.location ? ` en ${nextSession.location}` : ""}`
                    : "Sin Sesiones Pendientes"}
                </small>
              </div>

              <span className="portal-next-session-badge">
                {getNextSessionDayLabel(nextSession)}
              </span>

              <b>›</b>
            </button>
          </section>

          {error && <div className="attendance-portal-error global">{error}</div>}

          <section className="portal-overview-card">
            <div className="portal-overview-head">
              <span>HISTORIAL DE ASISTENCIA</span>
              <div className="portal-month-controls">
                <button type="button" onClick={() => moveMonth(-1)} aria-label="Mes anterior">‹</button>
                <strong>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</strong>
                <button type="button" onClick={() => moveMonth(1)} aria-label="Mes siguiente">›</button>
              </div>
              <div className="portal-header-actions">
                <small>
                  Actualizado {
                    lastUpdatedAt
                      ? lastUpdatedAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "--:--"
                  }
                </small>
                <button
                  type="button"
                  className={`portal-header-refresh ${loading ? "is-refreshing" : ""}`}
                  onClick={refresh}
                  disabled={loading}
                  aria-label="Actualizar historial"
                  title="Actualizar"
                >
                  ↻
                </button>
                <button type="button" className="portal-today" onClick={goToToday}>Ir a hoy</button>
              </div>
            </div>

            <div className="portal-overview-body">
              <div className="portal-percentage">
                <div className={`portal-ring ${loading ? "is-loading" : ""}`} style={{ "--progress": `${ringProgress * 3.6}deg` }}>
                  <div>
                    <strong>{attendancePercent}%</strong>
                    <span>ASISTENCIA</span>
                  </div>
                </div>
                <div className="portal-percentage-copy">
                  <span>TU MES EN CURSO</span>
                  <strong>{attendanceEffectiveCount} asistencias de {sessionCount} sesiones del mes</strong>
                  <small>Tu estado se actualiza según tus registros.</small>
                </div>
              </div>

              <div className="portal-stat-grid">
                <div className="portal-stat-card"><span>✓</span><small>Asistencias</small><strong>{attendedCount}</strong></div>
                <div className="portal-stat-card justified"><span>J</span><small>Justificadas</small><strong>{justifiedCount}</strong></div>
                <div className="portal-stat-card absent"><span>F</span><small>Faltas</small><strong>{absentCount}</strong></div>
                <div className="portal-stat-card scheduled"><span>◷</span><small>Sesiones</small><strong>{sessionCount}</strong></div>
              </div>
            </div>

            <div className={`portal-timeline-panel ${timelineCollapsed ? "is-collapsed" : "is-open"}`}>
              <button
                type="button"
                className="portal-timeline-toggle"
                onClick={() => setTimelineCollapsed((current) => !current)}
                aria-label={timelineCollapsed ? "Mostrar línea de tiempo" : "Ocultar línea de tiempo"}
                aria-expanded={!timelineCollapsed}
              >
                {timelineCollapsed ? "⌄" : "⌃"}
              </button>

              <div className="portal-timeline-collapse">
                <div className="portal-timeline-scroll">
                  <div
                    className="portal-timeline"
                    style={{ "--timeline-days": timelineDays.length }}
                  >
                    <div className="portal-timeline-line" />

                    {timelineDays.map((item) => (
                      <button
                        type="button"
                        className={`portal-timeline-item ${item.isToday ? "is-today" : ""} ${item.meeting ? "is-clickable" : ""}`}
                        key={item.dateKey}
                        onClick={() => handleTimelineClick(item)}
                        disabled={!item.meeting}
                        aria-label={
                          item.meeting
                            ? `Ir a la sesión del ${item.day} de ${monthLabel}`
                            : `Día ${item.day}`
                        }
                        title={
                          item.meeting
                            ? `${item.meeting.title || normalizeCategory(item.meeting) || "Reunión"}${item.meeting.time ? ` · ${item.meeting.time}` : ""}`
                            : `Día ${item.day}`
                        }
                      >
                        {item.isToday && <span className="portal-timeline-today">HOY</span>}
                        <span className={`portal-timeline-dot ${item.status}`}>
                          {item.status === "attended" && "✓"}
                          {item.status === "justified" && "J"}
                          {item.status === "absent" && "×"}
                        </span>
                        <strong>{item.day}</strong>
                        <small>{item.weekday}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="portal-sessions-section">
            <div className="portal-section-heading">
              <div>
                <span>REGISTRO GENERAL</span>
                <h2>Sesiones</h2>
              </div>

            </div>

            {loading ? (
              <div className="portal-dark-empty">Cargando asistencia...</div>
            ) : !searched ? (
              <div className="portal-dark-empty">Ingresa tu DNI para consultar tu asistencia.</div>
            ) : !meetings.length ? (
              <div className="portal-dark-empty">No existen reuniones registradas para este mes.</div>
            ) : (
              <div className="portal-category-list">
                {CATEGORY_ORDER.map((category) => {
                  const categoryMeetings = groupedMeetings[category] || [];
                  if (!categoryMeetings.length) return null;

                  return (
                    <section className="portal-dark-category" key={category}>
                      <div className="portal-dark-category-head">
                        <div className="portal-category-icon">{category === "ANUNCIOS CORPORATIVOS" ? "✚" : category === "MASTERCLASS" ? "✚" : category === "HEALTH" ? "✚" : category === "MENTORIA" ? "▤" : category === "MASTERCLASS" ? "▣" : "◈"}</div>
                        <div>
                          <strong>{CATEGORY_LABELS[category] || category}</strong>
                          <span>{categoryMeetings.length} {categoryMeetings.length === 1 ? "sesión" : "sesiones"} este mes</span>
                        </div>
                        <div className="portal-category-summary">
                          <i aria-hidden="true" />
                          <i className="justified" aria-hidden="true" />
                          <i className="absent" aria-hidden="true" />
                          <button
                            type="button"
                            className="portal-category-toggle"
                            onClick={() => toggleCategory(category)}
                            aria-label={collapsedCategories[category] ? `Expandir ${CATEGORY_LABELS[category] || category}` : `Comprimir ${CATEGORY_LABELS[category] || category}`}
                            aria-expanded={!collapsedCategories[category]}
                          >
                            {collapsedCategories[category] ? "⌄" : "⌃"}
                          </button>
                        </div>
                      </div>

                      <div
                        className={`portal-dark-session-collapse ${
                          collapsedCategories[category] ? "is-collapsed" : "is-open"
                        }`}
                      >
                        <div className="portal-dark-session-list">
                        {categoryMeetings.map((meeting) => {
                          const futureMeeting = isFutureMeeting(meeting);
                          const status = normalizeStatus(meeting.status);
                          const displayStatus = meeting.justificationValidity === "extra" ? "No asistió" : status;

                          return (
                            <article
                              className={`portal-dark-session ${
                                highlightedSessionId === getMeetingDomId(meeting)
                                  ? "is-highlighted"
                                  : ""
                              }`}
                              id={getMeetingDomId(meeting)}
                              key={meeting.meetingId || meeting._id || meeting.id}
                            >
                              <div className="portal-dark-date">
                                <strong>{getShortDay(meeting.date)}</strong>
                                <small>{String(meeting.date || "").split("-")[1] ? `${String(meeting.date).split("-")[2]}/${String(meeting.date).split("-")[1]}` : "—"}</small>
                              </div>

                              <div className="portal-dark-info">
                                <strong>{meeting.time || "—"}{meeting.endTime ? ` - ${meeting.endTime}` : ""}</strong>
                                <span>{meeting.title || CATEGORY_LABELS[category] || category}</span>
                              </div>

                              <div className="portal-dark-status-wrap">
                                {!futureMeeting && (
                                  <>
                                    <span className={getStatusClass(status, meeting.justificationValidity)}>
                                      <b>{getStatusSymbol(status)}</b>{displayStatus}
                                    </span>
                                    {meeting.note && <small className="portal-dark-note">{meeting.note}</small>}
                                    {canJustifyMeeting(meeting) && (
                                      <button
                                        type="button"
                                        className="portal-justify-button"
                                        onClick={() => openJustification(meeting)}
                                      >
                                        Justificar
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </article>
                          );
                        })}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>

          {justificationMeeting && (
            <div className="portal-justification-overlay" role="dialog" aria-modal="true" aria-labelledby="portal-justification-title">
              <div className="portal-justification-modal">
                <div className="portal-justification-head">
                  <div>
                    <span>JUSTIFICACIÓN DE INASISTENCIA</span>
                    <h3 id="portal-justification-title">Solicitar justificación</h3>
                  </div>
                  <button type="button" onClick={closeJustification} disabled={justificationSending} aria-label="Cerrar">×</button>
                </div>

                <div className="portal-justification-session">
                  <strong>{CATEGORY_LABELS[normalizeCategory(justificationMeeting)] || justificationMeeting.title || "Sesión"}</strong>
                  <span>{formatDate(justificationMeeting.date)}{justificationMeeting.time ? ` · ${justificationMeeting.time}` : ""}</span>
                </div>

                <label htmlFor="portal-justification-reason">Motivo</label>
                <select
                  id="portal-justification-reason"
                  value={justificationReason}
                  onChange={(event) => setJustificationReason(event.target.value)}
                  disabled={justificationSending}
                >
                  <option value="">Selecciona un motivo</option>
                  <option value="Salud">Salud</option>
                  <option value="Trabajo">Trabajo</option>
                  <option value="Viaje Programado">Viaje Programado</option>
                  <option value="Conexion Inestable">Conexion Inestable</option>
                </select>

                {justificationError && (
                  <div className="portal-justification-error">{justificationError}</div>
                )}

                <div className="portal-justification-actions">
                  <button type="button" onClick={closeJustification} disabled={justificationSending}>Cancelar</button>
                  <button type="button" onClick={sendJustificationWhatsApp} disabled={justificationSending || !justificationReason}>
                    {justificationSending ? "Abriendo WhatsApp..." : "Enviar por WhatsApp"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <footer className="attendance-portal-footer">Círculos Connect · soy.embajador</footer>
        </div>
      )}

    </main>
  );
};

export default AttendancePortal;