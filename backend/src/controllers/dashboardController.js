const User = require("../models/User");
const Meeting = require("../models/Meeting");
const Attendance = require("../models/Attendance");

const {
  getCircleScope,
  isGlobalAdministrator,
} = require("../middleware/permissionMiddleware");

const CATEGORY_ORDER = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
  "ORDINARIA",
];

const normalizeCircle = (
  value
) =>
  String(value || "")
    .trim()
    .toUpperCase();

const getAllowedCircles = (
  req
) => {
  if (
    isGlobalAdministrator(
      req.user || req.admin
    )
  ) {
    return null;
  }

  return getCircleScope(
    req.user || req.admin
  ).map(
    normalizeCircle
  );
};

const dashboardController = {
  async getDashboard(
    req,
    res
  ) {
    try {
      const now =
        new Date();

      const year =
        Number(req.query.year) ||
        now.getFullYear();

      const month =
        Number(req.query.month) ||
        now.getMonth() + 1;

      const monthString =
        String(month).padStart(
          2,
          "0"
        );

      const firstDate =
        `${year}-${monthString}-01`;

      const lastDay =
        new Date(
          year,
          month,
          0
        ).getDate();

      const lastDate =
        `${year}-${monthString}-${String(
          lastDay
        ).padStart(2, "0")}`;

      const allowedCircles =
        getAllowedCircles(
          req
        );

      /**
       * ========================================================
       * FILTRO DE REUNIONES
       * ========================================================
       */

      const meetingFilter = {
        active: true,
        date: {
          $gte: firstDate,
          $lte: lastDate,
        },
      };

      if (
        allowedCircles
      ) {
        meetingFilter.circle = {
          $in: allowedCircles,
        };
      }

      /**
       * ========================================================
       * FILTRO DE MIEMBROS
       * ========================================================
       */

      const userFilter = {};

      if (
        allowedCircles
      ) {
        userFilter.circle = {
          $in: allowedCircles,
        };
      }

      const users =
        await User.find(
          userFilter
        ).lean();

      const meetings =
        await Meeting.find(
          meetingFilter
        )
          .sort({
            date: 1,
            time: 1,
          })
          .lean();

      /**
       * ========================================================
       * ASISTENCIAS
       * ========================================================
       *
       * Attendance utiliza "meeting"
       * como referencia de la reunión.
       */

      let records = [];

      if (
        meetings.length > 0
      ) {
        const meetingIds =
          meetings.map(
            (meeting) =>
              meeting._id
          );

        records =
          await Attendance.find({
            meeting: {
              $in: meetingIds,
            },
          }).lean();
      }

      /**
       * ========================================================
       * INDEXAR ASISTENCIAS
       * ========================================================
       */

      const recordByMeetingAndDoc =
        new Map();

      records.forEach(
        (record) => {
          const meetingId =
            String(
              record.meeting ||
                record.meetingId ||
                ""
            );

          const doc =
            String(
              record.doc ||
                record.userDoc ||
                record.userId ||
                ""
            ).trim();

          recordByMeetingAndDoc.set(
            `${meetingId}|${doc}`,
            record
          );
        }
      );

      /**
       * ========================================================
       * INDEXAR MIEMBROS
       * ========================================================
       */

      const userByDoc =
        new Map();

      users.forEach(
        (user) => {
          userByDoc.set(
            String(
              user.doc || ""
            ).trim(),
            user
          );
        }
      );

      /**
       * ========================================================
       * CATEGORÍAS
       * ========================================================
       */

      const categories = {};

      CATEGORY_ORDER.forEach(
        (category) => {
          categories[
            category
          ] = {
            sessions: 0,
            attended: 0,
            absent: 0,
            justified: 0,
            pending: 0,
          };
        }
      );

      /**
       * ========================================================
       * PROCESAR REUNIONES
       * ========================================================
       */

      meetings.forEach(
        (meeting) => {
          const category =
            String(
              meeting.type || ""
            ).trim();

          if (
            !categories[
              category
            ]
          ) {
            categories[
              category
            ] = {
              sessions: 0,
              attended: 0,
              absent: 0,
              justified: 0,
              pending: 0,
            };
          }

          categories[
            category
          ].sessions += 1;

          const circleUsers =
            users.filter(
              (user) =>
                normalizeCircle(
                  user.circle
                ) ===
                normalizeCircle(
                  meeting.circle
                )
            );

          circleUsers.forEach(
            (user) => {
              const key =
                `${String(
                  meeting._id
                )}|${String(
                  user.doc
                ).trim()}`;

              const record =
                recordByMeetingAndDoc.get(
                  key
                );

              if (!record) {
                categories[
                  category
                ].absent += 1;

                return;
              }

              const status =
                String(
                  record.status ||
                    ""
                )
                  .trim()
                  .toLowerCase();

              if (
                status ===
                  "asistió" ||
                status ===
                  "asistio" ||
                status ===
                  "clase presencial"
              ) {
                categories[
                  category
                ].attended += 1;
              } else if (
                status ===
                  "justificado" ||
                status ===
                  "falta justificada"
              ) {
                categories[
                  category
                ].justified += 1;
              } else if (
                status ===
                "pendiente"
              ) {
                categories[
                  category
                ].pending += 1;
              } else {
                categories[
                  category
                ].absent += 1;
              }
            }
          );
        }
      );

      /**
       * ========================================================
       * RESUMEN
       * ========================================================
       */

      const totalSessions =
        meetings.length;

      let totalAttended = 0;
      let totalAbsent = 0;
      let totalJustified = 0;
      let totalPending = 0;

      Object.values(
        categories
      ).forEach(
        (category) => {
          totalAttended +=
            category.attended;

          totalAbsent +=
            category.absent;

          totalJustified +=
            category.justified;

          totalPending +=
            category.pending;
        }
      );

      const totalPossible =
        totalAttended +
        totalAbsent +
        totalJustified +
        totalPending;

      const attendanceRate =
        totalPossible > 0
          ? Math.round(
              (totalAttended /
                totalPossible) *
                100
            )
          : 0;

      /**
       * ========================================================
       * RESPUESTA
       * ========================================================
       */

      res.json({
        period: {
          year,
          month,
          monthLabel:
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
            ),
        },

        summary: {
          members:
            users.length,

          meetings:
            totalSessions,

          attended:
            totalAttended,

          absent:
            totalAbsent,

          justified:
            totalJustified,

          pending:
            totalPending,

          attendanceRate,
        },

        categories,

        meetings:
          meetings.map(
            (meeting) => ({
              id: String(
                meeting._id
              ),
              title:
                meeting.title,
              type:
                meeting.type,
              circle:
                meeting.circle,
              date:
                meeting.date,
              time:
                meeting.time,
              endTime:
                meeting.endTime,
              location:
                meeting.location,
            })
          ),
      });
    } catch (error) {
      console.error(
        "[Dashboard] Error:",
        error
      );

      res.status(500).json({
        message:
          "No se pudo cargar el dashboard.",
        error:
          error.message,
      });
    }
  },
};

module.exports =
  dashboardController;