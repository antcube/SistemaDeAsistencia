import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import seinfintyLogo from "../assets/seinfinty-logo.png";
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

  const [error, setError] =
    useState("");

  const [searched, setSearched] =
    useState(false);

  const [collapsedCategories, setCollapsedCategories] =
    useState({});

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

  const goToToday =
    () => {
      const current =
        new Date();

      const nextYear =
        current.getFullYear();

      const nextMonth =
        current.getMonth() + 1;

      setYear(
        nextYear
      );

      setMonth(
        nextMonth
      );

      if (searchedDni) {
        loadAttendance(
          searchedDni,
          nextYear,
          nextMonth
        );
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

  const attendedCount = effectiveMeetings.filter((meeting) => {
    const status = normalizeStatus(meeting.status);
    return status === "Asistió" || status === "Clase Presencial" ||
      (status === "Justificado" && meeting.justificationValidity === "valid");
  }).length;

  const justifiedCount = effectiveMeetings.filter(
    (meeting) => normalizeStatus(meeting.status) === "Justificado"
  ).length;

  const absentCount = effectiveMeetings.filter((meeting) => {
    const status = normalizeStatus(meeting.status);
    return status === "No asistió" ||
      (status === "Justificado" && meeting.justificationValidity === "extra");
  }).length;

  const scheduledCount = effectiveMeetings.filter(
    (meeting) => normalizeStatus(meeting.status) === "Pendiente"
  ).length;

  const completionBase = attendedCount + absentCount;
  const attendancePercent = completionBase > 0
    ? Math.round((attendedCount / completionBase) * 100)
    : 0;

  const timelineMeetings = useMemo(() => {
    return [...effectiveMeetings].sort((a, b) =>
      String(a.date || "").localeCompare(String(b.date || "")) ||
      String(a.time || "").localeCompare(String(b.time || ""))
    );
  }, [effectiveMeetings]);

  const getShortDay = (value) => {
    if (!value) return "—";
    const parts = String(value).split("-");
    return parts.length === 3 ? parts[2] : String(value).slice(-2);
  };

  const getTimelineStatus = (meeting) => {
    const status = normalizeStatus(meeting.status);
    if (status === "Asistió" || status === "Clase Presencial") return "attended";
    if (status === "Justificado" && meeting.justificationValidity !== "extra") return "justified";
    if (status === "Pendiente") return "scheduled";
    return "absent";
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

            <div className="portal-next-session">
              <div>
                <span>PRÓXIMA SESIÓN</span>
                <strong>{timelineMeetings.find((meeting) => normalizeStatus(meeting.status) === "Pendiente")?.title || "Círculo de Liderazgo"}</strong>
                <small>{timelineMeetings.find((meeting) => normalizeStatus(meeting.status) === "Pendiente")?.date || "Sin sesiones pendientes"}</small>
              </div>
              <b>›</b>
            </div>
          </section>

          {error && <div className="attendance-portal-error global">{error}</div>}

          <section className="portal-overview-card">
            <div className="portal-overview-head">
              <span>HISTORIAL DE ASISTENCIA</span>
              <div className="portal-month-controls">
                <button type="button" onClick={() => moveMonth(-1)} aria-label="Mes anterior">‹</button>
                <strong>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</strong>
                <button type="button" onClick={() => moveMonth(1)} aria-label="Mes siguiente">›</button>
                <button type="button" className="portal-today" onClick={goToToday}>Hoy</button>
              </div>
              <small>Actualizado hoy</small>
            </div>

            <div className="portal-overview-body">
              <div className="portal-percentage">
                <div className="portal-ring" style={{ "--progress": `${attendancePercent * 3.6}deg` }}>
                  <div>
                    <strong>{attendancePercent}%</strong>
                    <span>ASISTENCIA</span>
                  </div>
                </div>
                <div className="portal-percentage-copy">
                  <span>TU MES EN CURSO</span>
                  <strong>{attendedCount} asistencias de {completionBase || effectiveMeetings.length} sesiones realizadas</strong>
                  <small>Tu estado se actualiza según tus registros.</small>
                </div>
              </div>

              <div className="portal-stat-grid">
                <div className="portal-stat-card"><span>✓</span><small>Asistencias</small><strong>{attendedCount}</strong></div>
                <div className="portal-stat-card justified"><span>J</span><small>Justificadas</small><strong>{justifiedCount}</strong></div>
                <div className="portal-stat-card absent"><span>F</span><small>Faltas</small><strong>{absentCount}</strong></div>
                <div className="portal-stat-card scheduled"><span>•</span><small>Programadas</small><strong>{scheduledCount}</strong></div>
              </div>
            </div>

            <div className="portal-timeline">
              <div className="portal-timeline-line" />
              {timelineMeetings.length ? timelineMeetings.map((meeting, index) => (
                <div className="portal-timeline-item" key={meeting.meetingId || meeting._id || meeting.id || `${meeting.date}-${index}`}>
                  <span className={`portal-timeline-dot ${getTimelineStatus(meeting)}`} />
                  <small>{getShortDay(meeting.date)}</small>
                </div>
              )) : (
                <div className="portal-timeline-empty">Sin sesiones para este mes</div>
              )}
            </div>
          </section>

          <section className="portal-sessions-section">
            <div className="portal-section-heading">
              <div>
                <span>REGISTRO GENERAL</span>
                <h2>Sesiones</h2>
              </div>
              <button type="button" onClick={refresh} disabled={loading}>Actualizar</button>
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

                      {!collapsedCategories[category] && (
                      <div className="portal-dark-session-list">
                        {categoryMeetings.map((meeting) => {
                          const status = normalizeStatus(meeting.status);
                          const displayStatus = meeting.justificationValidity === "extra" ? "No asistió" : status;

                          return (
                            <article className="portal-dark-session" key={meeting.meetingId || meeting._id || meeting.id}>
                              <div className="portal-dark-date">
                                <strong>{getShortDay(meeting.date)}</strong>
                                <small>{String(meeting.date || "").split("-")[1] ? `${String(meeting.date).split("-")[2]}/${String(meeting.date).split("-")[1]}` : "—"}</small>
                              </div>

                              <div className="portal-dark-info">
                                <strong>{meeting.time || "—"}{meeting.endTime ? ` - ${meeting.endTime}` : ""}</strong>
                                <span>{meeting.title || CATEGORY_LABELS[category] || category}</span>
                              </div>

                              <div className="portal-dark-status-wrap">
                                <span className={getStatusClass(status, meeting.justificationValidity)}>
                                  <b>{getStatusSymbol(status)}</b>{displayStatus}
                                </span>
                                {meeting.note && <small className="portal-dark-note">{meeting.note}</small>}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </section>

          <footer className="attendance-portal-footer">Círculos Connect · soy.embajador</footer>
        </div>
      )}

    </main>
  );
};

export default AttendancePortal;