import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import attendanceService from "../services/attendanceService";
import meetingService from "../services/meetingService";

import "../styles/attendanceRegister.css";
import "../styles/attendanceHistory.css";

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

  // ============================================================
  // MODO QR
  // ============================================================

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

  // ============================================================
  // DETECTAR QR
  // ============================================================

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const qrId =
      params.get(
        "asistencia_qr"
      );

    /*
     * Si existe asistencia_qr,
     * este portal entra EXCLUSIVAMENTE
     * en modo MARCAR ASISTENCIA.
     *
     * Nunca debe mostrar el historial.
     */

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

          /*
           * IMPORTANTE:
           *
           * El backend puede devolver:
           *
           * _id
           * id
           *
           * Normalizamos ambos para que
           * el registro QR siempre tenga
           * el ID correcto.
           */

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

  // ============================================================
  // REGISTRAR ASISTENCIA MEDIANTE QR
  // ============================================================

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

        /*
         * ESTE es el endpoint de MARCAR ASISTENCIA.
         *
         * NO usamos:
         * getUserAttendance()
         *
         * NO usamos:
         * getUserMonthlyAttendanceByDni()
         *
         * Aquí se registra directamente
         * la asistencia mediante QR.
         */

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

  // ============================================================
  // TIEMPO RESTANTE QR
  // ============================================================

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

  // ============================================================
  // CONSULTAR HISTORIAL
  // ============================================================

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

  // ============================================================
  // CAMBIAR MES
  // ============================================================

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

  // ============================================================
  // MES
  // ============================================================

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

  // ============================================================
  // APLICAR REGLAS DE JUSTIFICACIONES
  // ============================================================

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

  // ============================================================
  // RESUMEN
  // ============================================================

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

          // Una J válida convalida como asistencia.
          // Las J excedidas ya fueron convertidas a falta
          // mediante justificationValidity === "extra".
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

      // Para obtener el bono primero deben estar
      // completadas todas las sesiones del mes.
      // Una sesión pendiente/sin estado todavía no
      // puede considerarse parte de un 100%.
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

      // El bono se obtiene cuando todas las sesiones
      // del mes están llenas y todas cuentan como
      // asistencia efectiva. Las J válidas cuentan
      // como asistencia; las J excedidas cuentan
      // como falta.
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

  // ============================================================
  // AGRUPAR REUNIONES
  // ============================================================

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

  // ============================================================
  // FORMATO FECHA
  // ============================================================

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

  // ============================================================
  // CLASE ESTADO
  // ============================================================

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

  return (
    <main className="attendance-portal-page">

      {/* =====================================================
          MODO QR
          ESTE BLOQUE ES EXCLUSIVO PARA MARCAR ASISTENCIA
      ===================================================== */}

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

      {/* =====================================================
          MODO NORMAL
          CONSULTA DE HISTORIAL
          
          IMPORTANTE:
          SOLO APARECE SI NO EXISTE asistencia_qr.
      ===================================================== */}

      {!isQrMode &&
        !member && (
          <section className="attendance-portal-login attendance-history-login-view">

            <div className="attendance-portal-logo">
              ⭐
            </div>

            <span className="attendance-portal-kicker">
              soy.embajador / portal
            </span>

            <h1>
              Portal del{" "}
              <strong>
                Embajador
              </strong>
            </h1>

            <p>
              Ingresa con tu DNI para
              consultar tu historial de
              asistencias.
            </p>

            <form
              onSubmit={
                handleSubmit
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
                    dni
                  }
                  onChange={(
                    event
                  ) =>
                    setDni(
                      event.target
                        .value
                    )
                  }
                  placeholder="Ej: 74839201"
                  maxLength={12}
                  autoComplete="off"
                />

              </div>

              {error && (
                <div className="attendance-portal-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="attendance-portal-submit"
                disabled={
                  loading
                }
              >
                {loading
                  ? "Consultando..."
                  : "Consultar asistencia"}
              </button>

            </form>

          </section>
        )}

      {/* =====================================================
          HISTORIAL
          SOLO MODO NORMAL
      ===================================================== */}

      {!isQrMode &&
        member && (
          <div className="attendance-portal-content attendance-history-view">

            <section className="attendance-portal-member">

              <div className="attendance-portal-member-main">

                <div className="attendance-portal-avatar">
                  {String(
                    member.name ||
                      member.nombre ||
                      "E"
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>

                  <span className="attendance-portal-kicker">
                    PORTAL DEL EMBajador
                  </span>

                  <h1>
                    {member.name ||
                      member.nombre ||
                      "Embajador"}
                  </h1>

                  <p>
                    DNI:{" "}
                    <strong>
                      {searchedDni}
                    </strong>
                  </p>

                </div>

              </div>

              <div className="attendance-portal-member-actions">

                <button
                  type="button"
                  className="attendance-portal-refresh"
                  onClick={
                    refresh
                  }
                  disabled={
                    loading
                  }
                >
                  🔄 Actualizar
                </button>

                <button
                  type="button"
                  className="attendance-portal-change"
                  onClick={() => {
                    setMember(
                      null
                    );

                    setMeetings(
                      []
                    );

                    setDni(
                      searchedDni
                    );

                    setSearched(
                      false
                    );

                    setError("");
                  }}
                >
                  Cambiar DNI
                </button>

              </div>

            </section>

            {error && (
              <div className="attendance-portal-error global">
                {error}
              </div>
            )}

            <section className="attendance-portal-monthbar">

              <button
                type="button"
                onClick={() =>
                  moveMonth(-1)
                }
              >
                ‹
              </button>

              <div>

                <small>
                  HISTORIAL DE ASISTENCIA
                </small>

                <strong>
                  {monthLabel
                    .charAt(0)
                    .toUpperCase() +
                    monthLabel.slice(
                      1
                    )}
                </strong>

              </div>

              <button
                type="button"
                onClick={() =>
                  moveMonth(1)
                }
              >
                ›
              </button>

              <button
                type="button"
                className="attendance-portal-today"
                onClick={
                  goToToday
                }
              >
                Hoy
              </button>

            </section>

            <section className="attendance-portal-summary">

              <div className="portal-summary-card blue">

                <span>
                  📅
                </span>

                <div>

                  <small>
                    Reuniones
                  </small>

                  <strong>
                    {summary.total}
                  </strong>

                </div>

              </div>

              <div className="portal-summary-card green">

                <span>
                  ✓
                </span>

                <div>

                  <small>
                    Asistencias
                  </small>

                  <strong>
                    {summary.valid}
                  </strong>

                </div>

              </div>

              <div className="portal-summary-card red">

                <span>
                  ×
                </span>

                <div>

                  <small>
                    Faltas
                  </small>

                  <strong>
                    {summary.absent}
                  </strong>

                </div>

              </div>

              <div
                className={`portal-summary-card ${
                  summary.bonus
                    ? "bonus-earned"
                    : "bonus-pending"
                }`}
              >

                <span>
                  🏆
                </span>

                <div>

                  <small>
                    Bono
                  </small>

                  <strong>
                    {summary.bonus
                      ? "Ganado"
                      : "—"}
                  </strong>

                </div>

              </div>

            </section>

            <section className="attendance-portal-report">

              <div className="attendance-portal-report-head">

                <div>

                  <span>
                    REGISTRO GENERAL
                  </span>

                  <h2>
                    Mi asistencia
                  </h2>

                  <p>
                    Consulta las sesiones
                    registradas para tu círculo
                    durante el mes seleccionado.
                  </p>

                </div>

                <div className="attendance-portal-legend">

                  <span>
                    <b className="legend-dot attended">
                      ✓
                    </b>
                    Asistió
                  </span>

                  <span>
                    <b className="legend-dot justified">
                      J
                    </b>
                    Justificado
                  </span>

                  <span>
                    <b className="legend-dot absent">
                      F
                    </b>
                    No asistió
                  </span>

                </div>

              </div>

              {loading ? (
                <div className="attendance-portal-empty">
                  Cargando asistencia...
                </div>
              ) : !searched ? (
                <div className="attendance-portal-empty">
                  Ingresa tu DNI para consultar tu asistencia.
                </div>
              ) : !meetings.length ? (
                <div className="attendance-portal-empty">
                  No existen reuniones registradas
                  para este círculo durante el mes.
                </div>
              ) : (
                <div className="attendance-portal-categories">

                  {CATEGORY_ORDER.map(
                    (
                      category
                    ) => {
                      const categoryMeetings =
                        groupedMeetings[
                          category
                        ] || [];

                      if (
                        !categoryMeetings.length
                      ) {
                        return null;
                      }

                      return (
                        <div
                          className="attendance-portal-category"
                          key={
                            category
                          }
                        >

                          <div className="attendance-portal-category-title">

                            <span>
                              {CATEGORY_LABELS[
                                category
                              ] ||
                                category}
                            </span>

                            <small>
                              {
                                categoryMeetings.length
                              }{" "}
                              {categoryMeetings.length ===
                              1
                                ? "sesión"
                                : "sesiones"}
                            </small>

                          </div>

                          <div className="attendance-portal-session-list">

                            {categoryMeetings.map(
                              (
                                meeting
                              ) => {
                                const status =
                                  normalizeStatus(
                                    meeting.status
                                  );

                                                                const displayStatus =
                                  meeting.justificationValidity === "extra"
                                    ? "No asistió"
                                    : status;

                                return (
                                  <article
                                    className="attendance-portal-session grid grid-cols-1 gap-3 px-3 py-3 md:grid-cols-[120px_minmax(0,1fr)_270px] md:items-center md:gap-[14px] md:py-[11px]"
                                    key={
                                      meeting.meetingId
                                    }
                                  >

                                    <div className="portal-session-date">

                                      <strong>
                                        {formatDate(
                                          meeting.date
                                        )}
                                      </strong>

                                      <small>
                                        {meeting.time ||
                                          ""}
                                        {meeting.endTime
                                          ? ` - ${meeting.endTime}`
                                          : ""}
                                      </small>

                                    </div>

                                    <div className="portal-session-info min-w-0">

                                      <strong
                                        className={`inline-flex w-fit max-w-full items-center rounded-md px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.02em] leading-tight ${getCategoryBadgeClasses(
                                          category
                                        )}`}
                                      >
                                        {meeting.title ||
                                          CATEGORY_LABELS[
                                            category
                                          ] ||
                                          category}
                                      </strong>

                                    </div>

                                    <div className="portal-session-status flex flex-wrap items-center justify-start gap-1.5 md:justify-end md:[grid-column:auto]">

                                      <span
                                        className={getStatusClass(
                                          status,
                                          meeting.justificationValidity
                                        )}
                                      >

                                        <b>
                                          {getStatusSymbol(
                                            status
                                          )}
                                        </b>

                                        {displayStatus}

                                      </span>

                                      {meeting.attendanceMode ===
                                        "QR" && (
                                        <small className="portal-qr-note">
                                          QR
                                        </small>
                                      )}

                                      {meeting.note && (
                                        <small className="portal-session-note">
                                          {meeting.note}
                                        </small>
                                      )}

                                    </div>

                                  </article>
                                );
                              }
                            )}

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </section>

            <footer className="attendance-portal-footer">
              Círculos Connect · soy.embajador
            </footer>

          </div>
        )}

    </main>
  );
};

export default AttendancePortal;