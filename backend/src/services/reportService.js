const Meeting = require("../models/Meeting");
const User = require("../models/User");
const Attendance = require("../models/Attendance");

const {
  generateMeetingsForMonth,
} = require("./scheduleService");

const CATEGORY_ORDER = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
];

const GENERAL_JUSTIFICATION_CATEGORIES = [
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
];

const LEADERSHIP_JUSTIFICATION_LIMIT = 1;
const GENERAL_JUSTIFICATION_LIMIT = 3;

const normalizeCategory = (meeting) => {
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
    type ===
      "CIRCULO DE LIDERAZGO" ||
    type === "MES" ||
    title.includes(
      "CIRCULO DE LIDERAZGO"
    ) ||
    title === "MES" ||
    /^SESI[ÓO]N\s+\d+$/i.test(
      title
    )
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
    type ===
      "ANUNCIOS CORPORATIVOS" ||
    type ===
      "ANUNCIO CORPORATIVO" ||
    title.includes(
      "ANUNCIOS CORPORATIVOS"
    ) ||
    title.includes(
      "ANUNCIO CORPORATIVO"
    )
  ) {
    return "ANUNCIOS CORPORATIVOS";
  }

  /*
   * Nunca devolvemos ORDINARIA.
   *
   * Las reuniones desconocidas no se agregan
   * al reporte.
   */
  return null;
};

const normalizeStatus = (status) => {
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

  if (value === "PENDIENTE") {
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

  return "No asistió";
};

const isAttendance = (status) => {
  const normalized =
    normalizeStatus(status);

  return (
    normalized === "Asistió" ||
    normalized ===
      "Clase Presencial"
  );
};

const isJustified = (status) =>
  normalizeStatus(status) ===
  "Justificado";

const formatDate = (
  year,
  month,
  day
) => {
  return `${year}-${String(
    month
  ).padStart(
    2,
    "0"
  )}-${String(day).padStart(
    2,
    "0"
  )}`;
};

const getMonthRange = (
  year,
  month
) => {
  const firstDate =
    formatDate(
      year,
      month,
      1
    );

  const lastDay =
    new Date(
      year,
      month,
      0
    ).getDate();

  const lastDate =
    formatDate(
      year,
      month,
      lastDay
    );

  return {
    firstDate,
    lastDate,
  };
};

const createEmptyCategory =
  () => ({
    sessions: [],
    attended: 0,
    absent: 0,
    justified: 0,
    justifiedValid: 0,
    justifiedExtra: 0,
    pending: 0,
  });

const createSessionData = (
  meeting,
  category
) => ({
  meetingId: String(
    meeting._id
  ),

  date: meeting.date,

  title: meeting.title,

  type: category,

  category,

  circle: meeting.circle,

  time:
    meeting.time || "",

  endTime:
    meeting.endTime || "",

  location:
    meeting.location || "",
});

const getAttendanceKey = (
  userId,
  meetingId
) =>
  `${String(
    userId
  )}_${String(meetingId)}`;

/**
 * ============================================================
 * REPORTE MENSUAL
 * ============================================================
 */
const getMonthlyCircleReport =
  async ({
    year,
    month,
    circle = null,
  }) => {
    const {
      firstDate,
      lastDate,
    } =
      getMonthRange(
        year,
        month
      );

    /*
     * Importante:
     *
     * Generamos las programaciones oficiales
     * antes de consultar el reporte.
     *
     * Esto permite que HEALTH y MENTORÍA
     * existan realmente como Meeting.
     */
    await generateMeetingsForMonth(
      year,
      month
    );

    const meetingQuery = {
      active: true,

      date: {
        $gte: firstDate,
        $lte: lastDate,
      },
    };

    if (circle) {
      meetingQuery.circle =
        circle;
    }

    let meetings =
      await Meeting.find(
        meetingQuery
      ).sort({
        date: 1,
        time: 1,
        _id: 1,
      });

    /*
     * Eliminamos cualquier reunión cuyo tipo
     * ya no forme parte del sistema.
     *
     * Así ORDINARY/ORDINARIA nunca llega
     * al frontend.
     */
    meetings =
      meetings.filter(
        (meeting) =>
          CATEGORY_ORDER.includes(
            normalizeCategory(
              meeting
            )
          )
      );

    const userQuery = {};

    if (circle) {
      userQuery.circle =
        circle;
    }

    const users =
      await User.find(
        userQuery
      ).sort({
        name: 1,
      });

    const meetingIds =
      meetings.map(
        (meeting) =>
          meeting._id
      );

    const userIds =
      users.map(
        (user) => user._id
      );

    const attendance =
      meetingIds.length &&
      userIds.length
        ? await Attendance.find({
            meeting: {
              $in: meetingIds,
            },

            user: {
              $in: userIds,
            },
          }).sort({
            registeredAt: 1,
            _id: 1,
          })
        : [];

    const attendanceMap =
      new Map();

    for (
      const record of attendance
    ) {
      attendanceMap.set(
        getAttendanceKey(
          record.user,
          record.meeting
        ),
        record
      );
    }

    const sessionsByType =
      {};

    for (
      const category of CATEGORY_ORDER
    ) {
      sessionsByType[
        category
      ] = [];
    }

    for (
      const meeting of meetings
    ) {
      const category =
        normalizeCategory(
          meeting
        );

      if (!category) {
        continue;
      }

      sessionsByType[
        category
      ].push(
        createSessionData(
          meeting,
          category
        )
      );
    }

    /*
     * Este "now" se utiliza únicamente
     * para comprobar si un QR activado
     * ya terminó.
     */
    const now =
      new Date();

    let totalScheduled = 0;
    let totalAttended = 0;
    let totalAbsent = 0;
    let totalPending = 0;

    let totalJustifiedValid =
      0;

    let totalJustifiedExtra =
      0;

    let totalBonus = 0;

    const members =
      users.map((user) => {
        const categories =
          {};

        for (
          const category of CATEGORY_ORDER
        ) {
          categories[
            category
          ] =
            createEmptyCategory();
        }

        /*
         * Solo reuniones del círculo del miembro.
         *
         * Los anuncios corporativos y Masterclass
         * que fueron creados para un círculo concreto
         * también respetan el círculo de Meeting.
         */
        const userMeetings =
          meetings.filter(
            (meeting) =>
              String(
                meeting.circle || ""
              )
                .trim()
                .toLowerCase() ===
              String(
                user.circle || ""
              )
                .trim()
                .toLowerCase()
          );

        const leadershipJustifications =
          [];

        const generalJustifications =
          [];

        for (
          const meeting of userMeetings
        ) {
          const category =
            normalizeCategory(
              meeting
            );

          if (!category) {
            continue;
          }

          const record =
            attendanceMap.get(
              getAttendanceKey(
                user._id,
                meeting._id
              )
            );

          if (
            !record ||
            !isJustified(
              record.status
            )
          ) {
            continue;
          }

          const item = {
            meeting,
            category,
            date:
              meeting.date ||
              "",
            time:
              meeting.time ||
              "",
          };

          if (
            category ===
            "CIRCULO DE LIDERAZGO"
          ) {
            leadershipJustifications.push(
              item
            );
          } else if (
            GENERAL_JUSTIFICATION_CATEGORIES.includes(
              category
            )
          ) {
            generalJustifications.push(
              item
            );
          }
        }

        const sorter = (
          a,
          b
        ) =>
          String(
            a.date
          ).localeCompare(
            String(b.date)
          ) ||
          String(
            a.time
          ).localeCompare(
            String(b.time)
          ) ||
          String(
            a.meeting._id
          ).localeCompare(
            String(
              b.meeting._id
            )
          );

        leadershipJustifications.sort(
          sorter
        );

        generalJustifications.sort(
          sorter
        );

        const validJustifications =
          new Set();

        const extraJustifications =
          new Set();

        leadershipJustifications.forEach(
          (
            item,
            index
          ) => {
            const key =
              String(
                item.meeting._id
              );

            if (
              index <
              LEADERSHIP_JUSTIFICATION_LIMIT
            ) {
              validJustifications.add(
                key
              );
            } else {
              extraJustifications.add(
                key
              );
            }
          }
        );

        generalJustifications.forEach(
          (
            item,
            index
          ) => {
            const key =
              String(
                item.meeting._id
              );

            if (
              index <
              GENERAL_JUSTIFICATION_LIMIT
            ) {
              validJustifications.add(
                key
              );
            } else {
              extraJustifications.add(
                key
              );
            }
          }
        );

        let memberScheduled = 0;
        let memberAttended = 0;
        let memberAbsent = 0;
        let memberPending = 0;

        let memberJustifiedValid =
          0;

        let memberJustifiedExtra =
          0;

        for (
          const meeting of userMeetings
        ) {
          const category =
            normalizeCategory(
              meeting
            );

          if (!category) {
            continue;
          }

          const categoryData =
            categories[
              category
            ] ||
            (categories[
              category
            ] =
              createEmptyCategory());

          const record =
            attendanceMap.get(
              getAttendanceKey(
                user._id,
                meeting._id
              )
            );

          /*
           * ====================================================
           * ESTADO
           * ====================================================
           *
           * Sin registro:
           *
           * - Pendiente normalmente.
           *
           * - No asistió solamente si:
           *   el QR fue activado
           *   Y
           *   el QR ya venció.
           */
          let reportStatus;
          let justificationValidity =
            null;

          if (!record) {
            const qrWasActivated =
              Boolean(
                meeting.qrStartTimestamp
              ) &&
              Boolean(
                meeting.qrEndTimestamp
              );

            const qrExpired =
              qrWasActivated &&
              now >
                new Date(
                  meeting.qrEndTimestamp
                );

            if (qrExpired) {
              reportStatus =
                "No asistió";

              categoryData.absent +=
                1;

              memberAbsent += 1;
            } else {
              reportStatus =
                "Pendiente";

              categoryData.pending +=
                1;

              memberPending += 1;
            }
          } else {
            const status =
              normalizeStatus(
                record.status
              );

            if (
              isJustified(status)
            ) {
              const meetingKey =
                String(
                  meeting._id
                );

              if (
                validJustifications.has(
                  meetingKey
                )
              ) {
                justificationValidity =
                  "valid";

                categoryData.justified +=
                  1;

                categoryData.justifiedValid +=
                  1;

                memberJustifiedValid +=
                  1;

                categoryData.attended +=
                  1;

                memberAttended +=
                  1;

                reportStatus =
                  "Justificado";
              } else if (
                extraJustifications.has(
                  meetingKey
                )
              ) {
                justificationValidity =
                  "extra";

                categoryData.justified +=
                  1;

                categoryData.justifiedExtra +=
                  1;

                memberJustifiedExtra +=
                  1;

                categoryData.absent +=
                  1;

                memberAbsent +=
                  1;

                reportStatus =
                  "Justificado";
              } else {
                reportStatus =
                  "Justificado";

                categoryData.justified +=
                  1;

                memberJustifiedExtra +=
                  1;

                categoryData.absent +=
                  1;

                memberAbsent +=
                  1;
              }
            } else if (
              isAttendance(status)
            ) {
              reportStatus =
                status;

              categoryData.attended +=
                1;

              memberAttended +=
                1;
            } else {
              reportStatus =
                status;

              categoryData.absent +=
                1;

              memberAbsent +=
                1;
            }
          }

          const session =
            createSessionData(
              meeting,
              category
            );

          categoryData.sessions.push({
            ...session,

            status:
              reportStatus,

            justificationValidity,

            note:
              record?.note ||
              record?.notes ||
              "",

            justificationReason:
              record?.justificationReason ||
              "",

            attendanceMode:
              record?.attendanceMode ||
              "MANUAL",

            source:
              record?.source ||
              null,

            registeredAt:
              record?.registeredAt ||
              null,

            attendedAt:
              record?.attendedAt ||
              null,
          });

          /*
           * Todas las sesiones cuentan como programadas,
           * incluso si están Pendientes.
           */
          memberScheduled +=
            1;
        }

        for (
          const category of CATEGORY_ORDER
        ) {
          const data =
            categories[
              category
            ];

          data.sessionCount =
            data.sessions.length;

          const completedSessions =
            data.sessionCount -
            data.pending;

          data.attendancePercentage =
            completedSessions > 0
              ? Math.round(
                  (data.attended /
                    completedSessions) *
                    100
                )
              : 0;
        }

        const scheduled =
          memberScheduled;

        const completed =
          scheduled -
          memberPending;

        const percentage =
          completed > 0
            ? Math.round(
                (memberAttended /
                  completed) *
                  100
              )
            : 0;

        /*
         * Bono:
         *
         * Todas las sesiones deben estar completadas,
         * ninguna pendiente y todas deben contar
         * como asistencia.
         */
        const bonus =
          scheduled > 0 &&
          memberPending === 0 &&
          memberAttended ===
            scheduled;

        if (bonus) {
          totalBonus += 1;
        }

        totalScheduled +=
          memberScheduled;

        totalAttended +=
          memberAttended;

        totalAbsent +=
          memberAbsent;

        totalPending +=
          memberPending;

        totalJustifiedValid +=
          memberJustifiedValid;

        totalJustifiedExtra +=
          memberJustifiedExtra;

        return {
          user: {
            id: user._id,
            doc: user.doc,
            name: user.name,
            username:
              user.username,
            circle:
              user.circle,
            job: user.job,
            email: user.email || "",
            phone: user.phone || "",
            rank: user.job || "",
          },

          name: user.name,
          doc: user.doc,
          circle: user.circle,

          categories,

          totals: {
            sessions:
              scheduled,

            attended:
              memberAttended,

            absent:
              memberAbsent,

            justified:
              memberJustifiedValid +
              memberJustifiedExtra,

            justifiedValid:
              memberJustifiedValid,

            justifiedExtra:
              memberJustifiedExtra,

            pending:
              memberPending,

            percentage,

            bonus,
          },
        };
      });

    const totalMeetings =
      meetings.length;

    /*
     * "Sesiones" en la tarjeta superior representa
     * las FECHAS de reuniones existentes en el calendario
     * durante el mes, no la cantidad de registros Meeting
     * ni la suma de reuniones por cada miembro.
     *
     * Si existen varias reuniones el mismo día, ese día
     * se cuenta una sola vez.
     */
    const meetingDates = new Set(
      meetings
        .map((meeting) =>
          String(meeting?.date || "").slice(0, 10)
        )
        .filter(Boolean)
    );

    const totalMeetingDates =
      meetingDates.size;

    return {
      year,
      month,
      circle,

      sessions:
        meetings.map(
          (meeting) =>
            createSessionData(
              meeting,
              normalizeCategory(
                meeting
              )
            )
        ),

      totalMeetings,

      sessionsByType,

      members,

      summary: {
        participants:
          users.length,

        members:
          users.length,

        meetings:
          totalMeetings,

        sessions:
          totalMeetingDates,

        attended:
          totalAttended,

        absent:
          totalAbsent,

        pending:
          totalPending,

        justifiedValid:
          totalJustifiedValid,

        justifiedExtra:
          totalJustifiedExtra,

        bonus:
          totalBonus,

        percentage:
          totalScheduled -
            totalPending >
          0
            ? Math.round(
                (totalAttended /
                  (totalScheduled -
                    totalPending)) *
                  100
              )
            : 0,
      },
    };
  };

module.exports = {
  getMonthlyCircleReport,
};