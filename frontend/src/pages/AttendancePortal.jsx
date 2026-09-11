import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import attendanceService from "../services/attendanceService";
import meetingService from "../services/meetingService";

import "../styles/attendancePortal.css";

const CATEGORY_ORDER = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
  "ORDINARIA",
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

  ORDINARIA:
    "Ordinaria",
};

const normalizeStatus = (
  status
) => {
  const value = String(
    status || ""
  )
    .trim()
    .toLowerCase();

  if (
    value === "faltó" ||
    value === "falto"
  ) {
    return "No asistió";
  }

  return status || "No asistió";
};

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
  // RESUMEN
  // ============================================================

  const summary =
    useMemo(() => {
      let attended = 0;
      let absent = 0;
      let justified = 0;
      let presencial = 0;

      meetings.forEach(
        (meeting) => {
          const status =
            normalizeStatus(
              meeting.status
            );

          if (
            status ===
            "Asistió"
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
            "Justificado"
          ) {
            justified++;
          }

          if (
            status ===
            "No asistió"
          ) {
            absent++;
          }
        }
      );

      return {
        total:
          meetings.length,

        attended,

        presencial,

        valid:
          attended +
          presencial,

        justified,

        absent,
      };
    }, [
      meetings,
    ]);

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

      meetings.forEach(
        (meeting) => {
          const type =
            String(
              meeting.type ||
                ""
            )
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
      meetings,
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

  const getStatusClass =
    (status) => {
      const normalized =
        normalizeStatus(
          status
        );

      if (
        normalized ===
        "Asistió"
      ) {
        return "portal-status attended";
      }

      if (
        normalized ===
        "Clase Presencial"
      ) {
        return "portal-status presencial";
      }

      if (
        normalized ===
        "Justificado"
      ) {
        return "portal-status justified";
      }

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
            <section className="attendance-portal-login">

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
            <section className="attendance-portal-login">

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

                  {qrSuccess && (
                    <div className="attendance-portal-success">
                      ✓ Tu asistencia ha sido registrada.
                    </div>
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
              <section className="attendance-portal-login">

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
          <section className="attendance-portal-login">

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
          <div className="attendance-portal-content">

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

              <div className="portal-summary-card orange">

                <span>
                  J
                </span>

                <div>

                  <small>
                    Justificadas
                  </small>

                  <strong>
                    {summary.justified}
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

                                return (
                                  <article
                                    className="attendance-portal-session"
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
                                          "—"}
                                        {meeting.endTime
                                          ? ` - ${meeting.endTime}`
                                          : ""}
                                      </small>

                                    </div>

                                    <div className="portal-session-info">

                                      <strong>
                                        {meeting.title ||
                                          CATEGORY_LABELS[
                                            category
                                          ] ||
                                          category}
                                      </strong>

                                      <span>
                                        {meeting.location ||
                                          "—"}
                                      </span>

                                    </div>

                                    <div className="portal-session-status">

                                      <span
                                        className={getStatusClass(
                                          status
                                        )}
                                      >

                                        <b>
                                          {getStatusSymbol(
                                            status
                                          )}
                                        </b>

                                        {status}

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