const Attendance = require("../models/Attendance");
const Meeting = require("../models/Meeting");
const User = require("../models/User");

const {
  createAuditLog,
} = require("../services/auditService");

const {
  canManageGlobal,
  canManageCircle,
} = require("../middleware/permissionMiddleware");

const VALID_STATUSES = [
  "No asistió",
  "Asistió",
  "Clase Presencial",
  "Justificado",
  "Faltó",
];

const JUSTIFICATION_LIMITS = {
  "CIRCULO DE LIDERAZGO": 1,
  GENERAL: 3,
};

/**
 * ============================================================
 * NORMALIZAR ESTADO
 * ============================================================
 */

const normalizeStatus = (status) => {
  if (String(status || "").trim() === "Faltó") {
    return "No asistió";
  }

  return status;
};

/**
 * ============================================================
 * NORMALIZAR TIPO DE REUNIÓN
 * ============================================================
 */

const normalizeMeetingType = (type) => {
  if (!type) {
    return "";
  }

  const normalized = String(type)
    .trim()
    .toUpperCase();

  const aliases = {
    "CIRCULO DE LIDERAZGO": "CIRCULO DE LIDERAZGO",
    "CÍRCULO DE LIDERAZGO": "CIRCULO DE LIDERAZGO",

    HEALTH: "HEALTH",

    MENTORIA: "MENTORIA",
    "MENTORÍA": "MENTORIA",

    MASTERCLASS: "MASTERCLASS",

    "ANUNCIOS CORPORATIVOS": "ANUNCIOS CORPORATIVOS",

    ORDINARIA: "ORDINARIA",
  };

  return aliases[normalized] || normalized;
};

/**
 * ============================================================
 * LÍMITE DE JUSTIFICACIONES
 * ============================================================
 */

const getJustificationLimit = (type) => {
  const normalizedType = normalizeMeetingType(type);

  if (normalizedType === "CIRCULO DE LIDERAZGO") {
    return JUSTIFICATION_LIMITS["CIRCULO DE LIDERAZGO"];
  }

  return JUSTIFICATION_LIMITS.GENERAL;
};

/**
 * ============================================================
 * PERMISOS POR CÍRCULO
 * ============================================================
 */

const hasCirclePermission = (req, circle) => {
  if (canManageGlobal(req.user)) {
    return true;
  }

  return canManageCircle(req.user, circle);
};

/**
 * ============================================================
 * VALIDAR AÑO / MES
 * ============================================================
 */

const validateYearMonth = (year, month) => {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (
    !Number.isInteger(numericYear) ||
    !Number.isInteger(numericMonth) ||
    numericMonth < 1 ||
    numericMonth > 12
  ) {
    return null;
  }

  return {
    year: numericYear,
    month: numericMonth,
  };
};

/**
 * ============================================================
 * RANGO DE FECHAS DEL MES
 * ============================================================
 */

const getMonthDateRange = (year, month) => {
  const firstDate =
    `${year}-${String(month).padStart(2, "0")}-01`;

  const lastDay = new Date(
    year,
    month,
    0
  ).getDate();

  const lastDate =
    `${year}-${String(month).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")}`;

  return {
    firstDate,
    lastDate,
  };
};

/**
 * ============================================================
 * CONTAR JUSTIFICACIONES DEL MES
 * ============================================================
 */

const countMonthlyJustificationsInternal = async ({
  userId,
  type,
  year,
  month,
  excludeAttendanceId = null,
}) => {
  const {
    firstDate,
    lastDate,
  } = getMonthDateRange(year, month);

  const normalizedType =
    normalizeMeetingType(type);

  const justificationTypes =
    normalizedType === "CIRCULO DE LIDERAZGO"
      ? ["CIRCULO DE LIDERAZGO"]
      : [
          "HEALTH",
          "MENTORIA",
          "MASTERCLASS",
          "ANUNCIOS CORPORATIVOS",
          "ORDINARIA",
        ];

  const meetings = await Meeting.find({
    type: {
      $in: justificationTypes,
    },
    active: true,
    date: {
      $gte: firstDate,
      $lte: lastDate,
    },
  }).select("_id");

  if (!meetings.length) {
    return 0;
  }

  const query = {
    user: userId,
    meeting: {
      $in: meetings.map(
        (meeting) => meeting._id
      ),
    },
    status: {
      $in: ["Justificado"],
    },
  };

  if (excludeAttendanceId) {
    query._id = {
      $ne: excludeAttendanceId,
    };
  }

  return Attendance.countDocuments(query);
};

/**
 * ============================================================
 * CREAR / ACTUALIZAR ASISTENCIA
 * ============================================================
 */

const setAttendance = async (req, res) => {
  try {
    const {
      meetingId,
      userId,
      doc,
      status,
      note = "",
      notes = "",
      justificationReason = "",
      source = "ADMIN",
      attendanceMode = "MANUAL",
    } = req.body;

    if (!meetingId || !status) {
      return res.status(400).json({
        message:
          "meetingId y status son obligatorios.",
      });
    }

    const normalizedStatus =
      normalizeStatus(status);

    if (
      !VALID_STATUSES.includes(status) &&
      !VALID_STATUSES.includes(normalizedStatus)
    ) {
      return res.status(400).json({
        message:
          "Estado de asistencia no válido.",
      });
    }

    const meeting =
      await Meeting.findById(meetingId);

    if (!meeting || !meeting.active) {
      return res.status(404).json({
        message:
          "La reunión no existe o está inactiva.",
      });
    }

    if (
      !hasCirclePermission(
        req,
        meeting.circle
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permisos para gestionar este círculo.",
      });
    }

    let user = null;

    if (userId) {
      user = await User.findById(userId);
    } else if (doc) {
      user = await User.findOne({
        doc: String(doc).trim(),
      });
    }

    if (!user) {
      return res.status(404).json({
        message:
          "Miembro no encontrado.",
      });
    }

    if (
      String(user.circle)
        .trim()
        .toLowerCase() !==
      String(meeting.circle)
        .trim()
        .toLowerCase()
    ) {
      return res.status(400).json({
        message:
          "El miembro no pertenece al círculo de la reunión.",
      });
    }

    let attendance =
      await Attendance.findOne({
        meeting: meeting._id,
        user: user._id,
      });

    const previousStatus = attendance
      ? normalizeStatus(attendance.status)
      : "";

    const isNewAttendance = !attendance;

    /**
     * --------------------------------------------------------
     * JUSTIFICACIONES
     * --------------------------------------------------------
     */

    if (normalizedStatus === "Justificado") {
      const meetingDate = new Date(
        `${meeting.date}T00:00:00`
      );

      const year =
        meetingDate.getFullYear();

      const month =
        meetingDate.getMonth() + 1;

      /*
       * IMPORTANTE:
       * Aquí NO se bloquea la nueva justificación.
       *
       * El límite de 1 para Círculo de Liderazgo y de 3
       * para el grupo general se utiliza únicamente en
       * reportService.js para decidir cuáles J son válidas
       * (verdes) y cuáles son extras (rojas).
       *
       * Por eso un miembro puede seguir teniendo J después
       * de alcanzar el límite: la J adicional se guarda
       * normalmente y luego se presenta como extra/roja.
       */
    }

    /**
     * --------------------------------------------------------
     * CREAR REGISTRO SI NO EXISTE
     * --------------------------------------------------------
     */

    if (!attendance) {
      attendance =
        new Attendance({
          meeting: meeting._id,
          user: user._id,
        });
    }

    attendance.doc = user.doc;
    attendance.name = user.name;
    attendance.circle = user.circle;

    attendance.status =
      normalizedStatus;

    attendance.note =
      String(
        note || notes || ""
      ).trim();

    attendance.notes =
      attendance.note;

    attendance.justificationReason =
      String(
        justificationReason || ""
      ).trim();

    attendance.registeredBy =
      req.user?.adminId ||
      req.user?.name ||
      "";

    attendance.source =
      source === "QR"
        ? "QR"
        : source === "SYSTEM"
        ? "SYSTEM"
        : "ADMIN";

    attendance.attendanceMode =
      [
        "MANUAL",
        "PRESENCIAL",
        "QR",
      ].includes(attendanceMode)
        ? attendanceMode
        : "MANUAL";

    attendance.registeredAt =
      new Date();

    /**
     * --------------------------------------------------------
     * JUSTIFICADO
     * --------------------------------------------------------
     */

    if (
      normalizedStatus ===
      "Justificado"
    ) {
      attendance.justifiedAt =
        new Date();

      attendance.justifiedBy =
        attendance.registeredBy;
    } else {
      attendance.justifiedAt = null;
      attendance.justifiedBy = "";
    }

    /**
     * --------------------------------------------------------
     * ASISTENCIA
     * --------------------------------------------------------
     */

    if (
      normalizedStatus === "Asistió" ||
      normalizedStatus ===
        "Clase Presencial"
    ) {
      attendance.attendedAt =
        new Date();
    } else {
      attendance.attendedAt = null;
    }

    await attendance.save();

    /**
     * --------------------------------------------------------
     * BITÁCORA
     * --------------------------------------------------------
     */

    await createAuditLog({
      admin: req.user,

      action: isNewAttendance
        ? "CREATE_ATTENDANCE"
        : "UPDATE_ATTENDANCE",

      module: "attendance",

      description: isNewAttendance
        ? `Registro de asistencia creado para ${user.name} en la reunión ${
            meeting.title ||
            meeting.type ||
            meeting._id
          }.`
        : `Asistencia modificada para ${user.name}: ${
            previousStatus ||
            "Sin registro"
          } → ${normalizedStatus}.`,

      targetId:
        attendance._id,

      targetName:
        user.name ||
        user.doc ||
        "",

      circle:
        meeting.circle ||
        user.circle ||
        "",

      metadata: {
        attendanceId:
          String(
            attendance._id
          ),

        meetingId:
          String(
            meeting._id
          ),

        userId:
          String(
            user._id
          ),

        doc:
          user.doc ||
          "",

        meetingTitle:
          meeting.title ||
          "",

        meetingType:
          meeting.type ||
          "",

        previousStatus,

        newStatus:
          normalizedStatus,

        note:
          attendance.note ||
          "",

        justificationReason:
          attendance.justificationReason ||
          "",

        source:
          attendance.source,

        attendanceMode:
          attendance.attendanceMode,
      },
    });

    /**
     * --------------------------------------------------------
     * SINCRONIZAR ATTENDEES DE LA REUNIÓN
     * --------------------------------------------------------
     */

    if (
      !Array.isArray(
        meeting.attendees
      )
    ) {
      meeting.attendees = [];
    }

    const attendeeIndex =
      meeting.attendees.indexOf(
        user.doc
      );

    const isAttended =
      normalizedStatus ===
        "Asistió" ||
      normalizedStatus ===
        "Clase Presencial";

    if (
      isAttended &&
      attendeeIndex === -1
    ) {
      meeting.attendees.push(
        user.doc
      );
    }

    if (
      !isAttended &&
      attendeeIndex !== -1
    ) {
      meeting.attendees.splice(
        attendeeIndex,
        1
      );
    }

    await meeting.save();

    return res.json({
      message:
        "Asistencia actualizada correctamente.",

      attendance:
        await Attendance.findById(
          attendance._id
        ).populate(
          "user",
          "doc name username circle job email phone"
        ),
    });
  } catch (error) {
    console.error(
      "Error registrando asistencia:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "El miembro ya tiene un registro para esta reunión.",
      });
    }

    return res.status(500).json({
      message:
        "Error registrando asistencia.",
    });
  }
};

/**
 * ============================================================
 * ASISTENCIA DE UNA REUNIÓN
 * ============================================================
 */

const getMeetingAttendance = async (
  req,
  res
) => {
  try {
    const meeting =
      await Meeting.findById(
        req.params.meetingId
      );

    if (!meeting) {
      return res.status(404).json({
        message:
          "Reunión no encontrada.",
      });
    }

    if (
      !hasCirclePermission(
        req,
        meeting.circle
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permisos.",
      });
    }

    /**
     * El acta muestra TODOS los miembros
     * del círculo aunque todavía no tengan
     * Attendance guardado.
     */

    const [
      users,
      attendance,
    ] = await Promise.all([
      User.find({
        circle: meeting.circle,
      })
        .select(
          "doc name username circle job email phone"
        )
        .sort({
          name: 1,
        }),

      Attendance.find({
        meeting: meeting._id,
      })
        .populate(
          "user",
          "doc name username circle job email phone"
        )
        .sort({
          createdAt: 1,
        }),
    ]);

    const attendanceMap =
      new Map();

    attendance.forEach(
      (record) => {
        if (record.user?._id) {
          attendanceMap.set(
            String(record.user._id),
            record
          );
        }
      }
    );

    const rows =
      users.map((user) => {
        const record =
          attendanceMap.get(
            String(user._id)
          );

        return {
          _id:
            record?._id ||
            null,

          meeting:
            meeting._id,

          user: {
            _id:
              user._id,

            doc:
              user.doc,

            name:
              user.name,

            username:
              user.username,

            circle:
              user.circle,

            job:
              user.job,

            email:
              user.email,

            phone:
              user.phone,
          },

          doc:
            user.doc,

          name:
            user.name,

          circle:
            user.circle,

          status:
            record?.status ||
            "No asistió",

          note:
            record?.note ||
            "",

          notes:
            record?.notes ||
            record?.note ||
            "",

          justificationReason:
            record?.justificationReason ||
            "",

          registeredBy:
            record?.registeredBy ||
            "",

          source:
            record?.source ||
            "ADMIN",

          attendanceMode:
            record?.attendanceMode ||
            null,

          registeredAt:
            record?.registeredAt ||
            null,

          attendedAt:
            record?.attendedAt ||
            null,
        };
      });

    return res.json({
      meeting,
      attendance: rows,
    });
  } catch (error) {
    console.error(
      "Error obteniendo asistencia:",
      error
    );

    return res.status(500).json({
      message:
        "Error obteniendo asistencia.",
    });
  }
};

/**
 * ============================================================
 * ASISTENCIA ADMINISTRATIVA DEL MES
 * ============================================================
 */

const getMonthAttendance = async (
  req,
  res
) => {
  try {
    const {
      year,
      month,
      doc = "",
      circle = "",
    } = req.query;

    const dateInfo =
      validateYearMonth(
        year,
        month
      );

    if (!dateInfo) {
      return res.status(400).json({
        message:
          "Año o mes inválido.",
      });
    }

    const {
      firstDate,
      lastDate,
    } =
      getMonthDateRange(
        dateInfo.year,
        dateInfo.month
      );

    /**
     * --------------------------------------------------------
     * REUNIONES REALES DEL CALENDARIO
     * --------------------------------------------------------
     */

    const meetingQuery = {
      active: true,
      date: {
        $gte: firstDate,
        $lte: lastDate,
      },
    };

    if (circle) {
      if (
        !hasCirclePermission(
          req,
          circle
        )
      ) {
        return res.status(403).json({
          message:
            "No tienes permisos para consultar este círculo.",
        });
      }

      meetingQuery.circle =
        circle;
    } else if (
      !canManageGlobal(
        req.user
      )
    ) {
      const scopes =
        req.user?.circleScope ||
        [];

      meetingQuery.circle = {
        $in: scopes,
      };
    }

    const meetings =
      await Meeting.find(
        meetingQuery
      ).sort({
        date: 1,
        time: 1,
      });

    /**
     * --------------------------------------------------------
     * MIEMBROS VISIBLES
     * --------------------------------------------------------
     */

    const userQuery = {};

    if (circle) {
      userQuery.circle =
        circle;
    } else if (
      !canManageGlobal(
        req.user
      )
    ) {
      userQuery.circle = {
        $in:
          req.user?.circleScope ||
          [],
      };
    }

    if (String(doc).trim()) {
      userQuery.doc = {
        $regex:
          String(doc).trim(),
        $options: "i",
      };
    }

    const users =
      await User.find(
        userQuery
      ).sort({
        name: 1,
      });

    if (
      !meetings.length ||
      !users.length
    ) {
      return res.json({
        year:
          dateInfo.year,

        month:
          dateInfo.month,

        meetings,

        attendance: [],
      });
    }

    const meetingIds =
      meetings.map(
        (meeting) =>
          meeting._id
      );

    const userIds =
      users.map(
        (user) =>
          user._id
      );

    const existing =
      await Attendance.find({
        meeting: {
          $in: meetingIds,
        },

        user: {
          $in: userIds,
        },
      }).populate(
        "user",
        "doc name username circle job email phone"
      );

    const existingMap =
      new Map();

    existing.forEach(
      (record) => {
        const key =
          `${record.user?._id?.toString()}_${record.meeting.toString()}`;

        existingMap.set(
          key,
          record
        );
      }
    );

    /**
     * --------------------------------------------------------
     * CONSTRUIR REGISTROS VIRTUALES
     * --------------------------------------------------------
     */

    const attendance = [];

    for (const user of users) {
      for (const meeting of meetings) {
        if (
          String(user.circle)
            .trim()
            .toLowerCase() !==
          String(meeting.circle)
            .trim()
            .toLowerCase()
        ) {
          continue;
        }

        const key =
          `${user._id.toString()}_${meeting._id.toString()}`;

        const existingRecord =
          existingMap.get(key);

        if (existingRecord) {
          const record =
            existingRecord.toObject();

          record.status =
            normalizeStatus(
              record.status
            );

          record.meeting =
            meeting.toObject();

          attendance.push(
            record
          );
        } else {
          attendance.push({
            _id: null,

            meeting:
              meeting.toObject(),

            user:
              user.toObject(),

            doc:
              user.doc,

            name:
              user.name,

            circle:
              user.circle,

            status:
              "No asistió",

            note: "",

            notes: "",

            justificationReason:
              "",

            attendanceMode:
              null,

            source:
              null,

            registeredAt:
              null,

            registeredBy:
              "",
          });
        }
      }
    }

    return res.json({
      year:
        dateInfo.year,

      month:
        dateInfo.month,

      meetings,

      attendance,
    });
  } catch (error) {
    console.error(
      "Error obteniendo asistencia mensual:",
      error
    );

    return res.status(500).json({
      message:
        "Error obteniendo asistencia mensual.",
    });
  }
};

/**
 * ============================================================
 * ASISTENCIA MENSUAL POR USER ID
 * ============================================================
 */

const getUserMonthlyAttendance = async (
  req,
  res
) => {
  try {
    const {
      userId,
      year,
      month,
    } = req.query;

    if (
      !userId ||
      !year ||
      !month
    ) {
      return res.status(400).json({
        message:
          "userId, year y month son obligatorios.",
      });
    }

    const dateInfo =
      validateYearMonth(
        year,
        month
      );

    if (!dateInfo) {
      return res.status(400).json({
        message:
          "Año o mes inválido.",
      });
    }

    const user =
      await User.findById(
        userId
      );

    if (!user) {
      return res.status(404).json({
        message:
          "Miembro no encontrado.",
      });
    }

    if (
      !hasCirclePermission(
        req,
        user.circle
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permisos para consultar este círculo.",
      });
    }

    const {
      firstDate,
      lastDate,
    } =
      getMonthDateRange(
        dateInfo.year,
        dateInfo.month
      );

    const meetings =
      await Meeting.find({
        circle:
          user.circle,

        active: true,

        date: {
          $gte: firstDate,
          $lte: lastDate,
        },
      }).sort({
        date: 1,
        time: 1,
      });

    const records =
      meetings.length
        ? await Attendance.find({
            user:
              user._id,

            meeting: {
              $in:
                meetings.map(
                  (meeting) =>
                    meeting._id
                ),
            },
          })
        : [];

    const recordMap =
      new Map();

    records.forEach(
      (record) => {
        recordMap.set(
          record.meeting.toString(),
          record
        );
      }
    );

    return res.json({
      user,

      year:
        dateInfo.year,

      month:
        dateInfo.month,

      meetings:
        meetings.map(
          (meeting) => {
            const record =
              recordMap.get(
                meeting._id.toString()
              );

            return {
              meetingId:
                meeting._id,

              date:
                meeting.date,

              title:
                meeting.title,

              type:
                meeting.type,

              circle:
                meeting.circle,

              time:
                meeting.time,

              endTime:
                meeting.endTime,

              location:
                meeting.location,

              status:
                normalizeStatus(
                  record?.status ||
                    "No asistió"
                ),

              note:
                record?.note ||
                record?.notes ||
                "",

              attendanceMode:
                record?.attendanceMode ||
                null,

              registeredAt:
                record?.registeredAt ||
                null,

              registeredBy:
                record?.registeredBy ||
                "",
            };
          }
        ),
    });
  } catch (error) {
    console.error(
      "Error obteniendo asistencia mensual:",
      error
    );

    return res.status(500).json({
      message:
        "Error obteniendo asistencia mensual.",
    });
  }
};

/**
 * ============================================================
 * PORTAL /ASISTENCIA POR DNI
 * ============================================================
 *
 * IMPORTANTE:
 * Esta función SOLO CONSULTA información.
 *
 * El QR NO utiliza esta función para registrar
 * asistencia.
 * ============================================================
 */

const getUserMonthlyAttendanceByDni =
  async (
    req,
    res
  ) => {
    try {
      const {
        dni,
        year,
        month,
      } = req.query;

      if (
        !dni ||
        !year ||
        !month
      ) {
        return res.status(400).json({
          message:
            "dni, year y month son obligatorios.",
        });
      }

      const dateInfo =
        validateYearMonth(
          year,
          month
        );

      if (!dateInfo) {
        return res.status(400).json({
          message:
            "Año o mes inválido.",
        });
      }

      const user =
        await User.findOne({
          doc:
            String(dni).trim(),
        });

      if (!user) {
        return res.status(404).json({
          message:
            "No se encontró ningún miembro con ese DNI.",
        });
      }

      const {
        firstDate,
        lastDate,
      } =
        getMonthDateRange(
          dateInfo.year,
          dateInfo.month
        );

      const meetings =
        await Meeting.find({
          circle:
            user.circle,

          active: true,

          date: {
            $gte: firstDate,
            $lte: lastDate,
          },
        }).sort({
          date: 1,
          time: 1,
        });

      const records =
        meetings.length
          ? await Attendance.find({
              user:
                user._id,

              meeting: {
                $in:
                  meetings.map(
                    (meeting) =>
                      meeting._id
                  ),
              },
            })
          : [];

      const recordMap =
        new Map();

      records.forEach(
        (record) => {
          recordMap.set(
            record.meeting.toString(),
            record
          );
        }
      );

      return res.json({
        user: {
          id:
            user._id,

          doc:
            user.doc,

          name:
            user.name,

          username:
            user.username,

          circle:
            user.circle,

          job:
            user.job,

          email:
            user.email,

          phone:
            user.phone,
        },

        year:
          dateInfo.year,

        month:
          dateInfo.month,

        meetings:
          meetings.map(
            (meeting) => {
              const record =
                recordMap.get(
                  meeting._id.toString()
                );

              return {
                meetingId:
                  meeting._id,

                date:
                  meeting.date,

                title:
                  meeting.title,

                type:
                  meeting.type,

                circle:
                  meeting.circle,

                time:
                  meeting.time,

                endTime:
                  meeting.endTime,

                location:
                  meeting.location,

                status:
                  normalizeStatus(
                    record?.status ||
                      "No asistió"
                  ),

                note:
                  record?.note ||
                  record?.notes ||
                  "",

                attendanceMode:
                  record?.attendanceMode ||
                  null,

                registeredAt:
                  record?.registeredAt ||
                  null,
              };
            }
          ),
      });
    } catch (error) {
      console.error(
        "Error consultando asistencia por DNI:",
        error
      );

      return res.status(500).json({
        message:
          "Error consultando asistencia por DNI.",
      });
    }
  };

/**
 * ============================================================
 * REGISTRAR ASISTENCIA MEDIANTE QR
 * ============================================================
 *
 * ESTE ES EL ENDPOINT QUE DEBE UTILIZAR EL QR.
 *
 * Flujo:
 *
 * 1. Administrador activa QR.
 * 2. Meeting recibe qrActive = true.
 * 3. Se establece qrStartTimestamp.
 * 4. Se establece qrEndTimestamp.
 * 5. Miembro escanea QR.
 * 6. Portal solicita DNI.
 * 7. Se llama a esta función.
 * 8. Se registra "Asistió".
 *
 * NO consulta las asistencias del miembro.
 * ============================================================
 */

const registerAttendanceByQr =
  async (
    req,
    res
  ) => {
    try {
      const {
        meetingId,
        dni,
      } = req.body;

      if (
        !meetingId ||
        !dni
      ) {
        return res.status(400).json({
          message:
            "meetingId y dni son obligatorios.",
        });
      }

      const meeting =
        await Meeting.findById(
          meetingId
        );

      if (
        !meeting ||
        !meeting.active
      ) {
        return res.status(404).json({
          message:
            "Reunión no encontrada.",
        });
      }

      /**
       * --------------------------------------------------------
       * QR ACTIVO
       * --------------------------------------------------------
       */

      if (!meeting.qrActive) {
        return res.status(400).json({
          message:
            "El QR de esta reunión no está activo.",
        });
      }

      /**
       * --------------------------------------------------------
       * QR TODAVÍA NO DISPONIBLE
       * --------------------------------------------------------
       */

      const now =
        new Date();

      if (
        meeting.qrStartTimestamp &&
        now <
          new Date(
            meeting.qrStartTimestamp
          )
      ) {
        return res.status(400).json({
          message:
            "El QR todavía no está disponible.",
        });
      }

      /**
       * --------------------------------------------------------
       * QR EXPIRADO
       * --------------------------------------------------------
       */

      if (
        meeting.qrEndTimestamp &&
        now >
          new Date(
            meeting.qrEndTimestamp
          )
      ) {
        meeting.qrActive =
          false;

        await meeting.save();

        return res.status(400).json({
          message:
            "El QR de esta reunión ya expiró.",
        });
      }

      /**
       * --------------------------------------------------------
       * BUSCAR MIEMBRO
       * --------------------------------------------------------
       */

      const user =
        await User.findOne({
          doc:
            String(dni).trim(),
        });

      if (!user) {
        return res.status(404).json({
          message:
            "No se encontró ningún miembro con ese DNI.",
        });
      }

      /**
       * --------------------------------------------------------
       * VALIDAR CÍRCULO
       * --------------------------------------------------------
       */

      if (
        String(user.circle)
          .trim()
          .toLowerCase() !==
        String(meeting.circle)
          .trim()
          .toLowerCase()
      ) {
        return res.status(403).json({
          message:
            "El miembro no pertenece al círculo de esta reunión.",
        });
      }

      /**
       * --------------------------------------------------------
       * BUSCAR / CREAR ASISTENCIA
       * --------------------------------------------------------
       */

      let attendance =
        await Attendance.findOne({
          meeting:
            meeting._id,

          user:
            user._id,
        });

      const previousStatus =
        attendance
          ? normalizeStatus(
              attendance.status
            )
          : "";

      const isNewAttendance =
        !attendance;

      if (!attendance) {
        attendance =
          new Attendance({
            meeting:
              meeting._id,

            user:
              user._id,
          });
      }

      /**
       * --------------------------------------------------------
       * REGISTRO DE ASISTENCIA
       * --------------------------------------------------------
       *
       * El QR SIEMPRE registra:
       *
       *     Asistió
       *
       * No abre el historial.
       * No muestra asistencias.
       * No consulta el reporte mensual.
       * --------------------------------------------------------
       */

      attendance.doc =
        user.doc;

      attendance.name =
        user.name;

      attendance.circle =
        user.circle;

      attendance.status =
        "Asistió";

      attendance.source =
        "QR";

      attendance.attendanceMode =
        "QR";

      attendance.attendedAt =
        new Date();

      attendance.registeredAt =
        new Date();

      attendance.registeredBy =
        "QR";

      await attendance.save();

      /**
       * --------------------------------------------------------
       * SINCRONIZAR ATTENDEES
       * --------------------------------------------------------
       */

      if (
        !Array.isArray(
          meeting.attendees
        )
      ) {
        meeting.attendees =
          [];
      }

      if (
        !meeting.attendees.includes(
          user.doc
        )
      ) {
        meeting.attendees.push(
          user.doc
        );
      }

      await meeting.save();

      /**
       * --------------------------------------------------------
       * RESPUESTA
       * --------------------------------------------------------
       */

      return res.json({
        success: true,

        message:
          "Asistencia registrada correctamente.",

        attendance,

        user: {
          doc:
            user.doc,

          name:
            user.name,

          circle:
            user.circle,
        },

        meeting: {
          id:
            meeting._id,

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
        },
      });
    } catch (error) {
      console.error(
        "Error registrando asistencia por QR:",
        error
      );

      if (error.code === 11000) {
        return res.status(409).json({
          message:
            "El miembro ya tiene un registro para esta reunión.",
        });
      }

      return res.status(500).json({
        message:
          "Error registrando asistencia por QR.",
      });
    }
  };

/**
 * ============================================================
 * ELIMINAR REGISTRO DE ASISTENCIA
 * ============================================================
 */

const deleteAttendance =
  async (
    req,
    res
  ) => {
    try {
      const attendance =
        await Attendance.findById(
          req.params.id
        );

      if (!attendance) {
        return res.status(404).json({
          message:
            "Registro de asistencia no encontrado.",
        });
      }

      const meeting =
        await Meeting.findById(
          attendance.meeting
        );

      if (!meeting) {
        return res.status(404).json({
          message:
            "Reunión no encontrada.",
        });
      }

      if (
        !hasCirclePermission(
          req,
          meeting.circle
        )
      ) {
        return res.status(403).json({
          message:
            "No tienes permisos.",
        });
      }

      const user =
        await User.findById(
          attendance.user
        );

      await Attendance.deleteOne({
        _id:
          attendance._id,
      });

      if (
        user &&
        Array.isArray(
          meeting.attendees
        )
      ) {
        meeting.attendees =
          meeting.attendees.filter(
            (item) =>
              item !== user.doc
          );

        await meeting.save();
      }

      return res.json({
        message:
          "Registro de asistencia eliminado correctamente.",
      });
    } catch (error) {
      console.error(
        "Error eliminando asistencia:",
        error
      );

      return res.status(500).json({
        message:
          "Error eliminando asistencia.",
      });
    }
  };

/**
 * ============================================================
 * EXPORTACIONES
 * ============================================================
 */

module.exports = {
  setAttendance,

  getMeetingAttendance,

  getMonthAttendance,

  getUserMonthlyAttendance,

  getUserMonthlyAttendanceByDni,

  registerAttendanceByQr,

  deleteAttendance,

  countMonthlyJustifications:
    async (
      req,
      res
    ) => {
      try {
        const {
          userId,
          type,
          year,
          month,
        } = req.query;

        if (
          !userId ||
          !type ||
          !year ||
          !month
        ) {
          return res.status(400).json({
            message:
              "userId, type, year y month son obligatorios.",
          });
        }

        const count =
          await countMonthlyJustificationsInternal({
            userId,
            type,
            year,
            month,
          });

        return res.json({
          count,

          limit:
            getJustificationLimit(
              type
            ),
        });
      } catch (error) {
        console.error(
          "Error contando justificaciones:",
          error
        );

        return res.status(500).json({
          message:
            "Error contando justificaciones.",
        });
      }
    },

  getJustificationLimit:
    async (
      req,
      res
    ) => {
      try {
        const {
          type,
        } = req.query;

        if (!type) {
          return res.status(400).json({
            message:
              "El tipo de reunión es obligatorio.",
          });
        }

        return res.json({
          type:
            normalizeMeetingType(
              type
            ),

          limit:
            getJustificationLimit(
              type
            ),
        });
      } catch (error) {
        console.error(
          "Error obteniendo límite:",
          error
        );

        return res.status(500).json({
          message:
            "Error obteniendo límite de justificaciones.",
        });
      }
    },

  normalizeMeetingType,
};