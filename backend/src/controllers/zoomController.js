const XLSX = require("xlsx");

const User = require("../models/User");
const Circle = require("../models/Circle");
const Meeting = require("../models/Meeting");
const Attendance = require("../models/Attendance");

const {
  canManageGlobal,
  canManageCircle,
  getCircleScope,
} = require("../middleware/permissionMiddleware");

const {
  createAuditLog,
} = require("../services/auditService");

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ZOOM_MINUTES_REQUIRED = 10;

const ALLOWED_SESSION_TYPES = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
];

const HEALTH_CONFIG = {
  day: 4, // Jueves
  time: "19:00",
  endTime: "20:00",
  title: "HEALTH",
};

// ============================================================
// NORMALIZADORES
// ============================================================

const normalizeHeader = (value) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};

const cleanEmail = (value) => {
  return String(value ?? "")
    .trim()
    .toLowerCase();
};

const cleanDni = (value) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/\.0+$/, "")
    .replace(/\s+/g, "");
};

const normalizeType = (value) => {
  const type = String(
    value || ""
  )
    .trim()
    .toUpperCase();

  if (
    type ===
    "CÍRCULO DE LIDERAZGO"
  ) {
    return "CIRCULO DE LIDERAZGO";
  }

  if (type === "MENTORÍA") {
    return "MENTORIA";
  }

  return type;
};

// ============================================================
// COLUMNAS ZOOM
// ============================================================

const findColumn = (
  headers,
  aliases
) => {
  const normalizedHeaders =
    headers.map(
      (header) =>
        normalizeHeader(header)
    );

  const normalizedAliases =
    aliases.map(
      (alias) =>
        normalizeHeader(alias)
    );

  // Primero coincidencia exacta.
  for (
    const alias of normalizedAliases
  ) {
    const index =
      normalizedHeaders.findIndex(
        (header) =>
          header === alias
      );

    if (index >= 0) {
      return headers[index];
    }
  }

  // Después coincidencia parcial.
  for (
    const alias of normalizedAliases
  ) {
    const index =
      normalizedHeaders.findIndex(
        (header) =>
          header.includes(alias) ||
          alias.includes(header)
      );

    if (index >= 0) {
      return headers[index];
    }
  }

  return null;
};

// ============================================================
// MINUTOS
// ============================================================

const parseMinutes = (
  value
) => {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  ) {
    return Math.max(
      0,
      value
    );
  }

  const raw = String(
    value ?? ""
  )
    .trim()
    .replace(",", ".");

  if (!raw) {
    return 0;
  }

  const numeric =
    Number(raw);

  if (
    Number.isFinite(
      numeric
    )
  ) {
    return Math.max(
      0,
      numeric
    );
  }

  const match =
    raw.match(
      /(\d+(?:\.\d+)?)\s*(?:min|minute|minutes)/i
    );

  if (match) {
    return Math.max(
      0,
      Number(match[1])
    );
  }

  /*
   * Algunos reportes pueden traer
   * valores como:
   *
   * 00:12:35
   * 12:35
   *
   * Intentamos interpretarlos
   * como duración.
   */
  const timeMatch =
    raw.match(
      /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
    );

  if (timeMatch) {
    const first =
      Number(
        timeMatch[1]
      );

    const second =
      Number(
        timeMatch[2]
      );

    const third =
      timeMatch[3] !==
      undefined
        ? Number(
            timeMatch[3]
          )
        : null;

    if (
      third !== null
    ) {
      return Math.max(
        0,
        first * 60 +
          second +
          third / 60
      );
    }

    return Math.max(
      0,
      first +
        second / 60
    );
  }

  return 0;
};

// ============================================================
// FECHAS
// ============================================================

const pad = (
  value
) => {
  return String(
    value
  ).padStart(2, "0");
};

const dateToString = (
  date
) => {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(
    date.getDate()
  )}`;
};

const parseDateValue = (
  value
) => {
  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return dateToString(
      value
    );
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  ) {
    try {
      const parsed =
        XLSX.SSF.parse_date_code(
          value
        );

      if (
        parsed &&
        parsed.y &&
        parsed.m &&
        parsed.d
      ) {
        return `${parsed.y}-${pad(
          parsed.m
        )}-${pad(
          parsed.d
        )}`;
      }
    } catch {
      // continuar con otros formatos
    }
  }

  const raw = String(
    value ?? ""
  ).trim();

  if (!raw) {
    return "";
  }

  // YYYY-MM-DD
  let match =
    raw.match(
      /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/
    );

  if (match) {
    return `${match[1]}-${pad(
      match[2]
    )}-${pad(
      match[3]
    )}`;
  }

  // DD/MM/YYYY
  match =
    raw.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
    );

  if (match) {
    return `${match[3]}-${pad(
      match[2]
    )}-${pad(
      match[1]
    )}`;
  }

  const parsed =
    new Date(raw);

  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {
    return dateToString(
      parsed
    );
  }

  return "";
};

const parseTimeValue = (
  value
) => {
  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return `${pad(
      value.getHours()
    )}:${pad(
      value.getMinutes()
    )}`;
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  ) {
    /*
     * Hora Excel como fracción
     * del día.
     */
    const totalMinutes =
      Math.round(
        value * 24 * 60
      );

    const hours =
      Math.floor(
        totalMinutes / 60
      ) % 24;

    const minutes =
      totalMinutes % 60;

    return `${pad(
      hours
    )}:${pad(minutes)}`;
  }

  const raw = String(
    value ?? ""
  ).trim();

  if (!raw) {
    return "";
  }

  /*
   * Si viene como fecha/hora.
   */
  const parsed =
    new Date(raw);

  if (
    !Number.isNaN(
      parsed.getTime()
    ) &&
    /[T ]/.test(raw)
  ) {
    return `${pad(
      parsed.getHours()
    )}:${pad(
      parsed.getMinutes()
    )}`;
  }

  const match =
    raw.match(
      /(\d{1,2}):(\d{2})/
    );

  if (match) {
    return `${pad(
      match[1]
    )}:${pad(
      match[2]
    )}`;
  }

  return "";
};

// ============================================================
// FECHA DESDE HORA DE ENTRADA
// ============================================================

const getDetectedDate = (
  rows
) => {
  const dates = [
    ...new Set(
      rows
        .map(
          (row) =>
            parseDateValue(
              row.entry
            )
        )
        .filter(Boolean)
    ),
  ];

  if (
    dates.length !== 1
  ) {
    return {
      date: "",
      dates,
    };
  }

  return {
    date: dates[0],
    dates,
  };
};

// ============================================================
// LECTURA DEL REPORTE
// ============================================================

const parseZoomFile = (
  buffer
) => {
  const workbook =
    XLSX.read(
      buffer,
      {
        type: "buffer",
        cellDates: true,
        raw: true,
      }
    );

  const sheetName =
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(
      "El reporte de Zoom no contiene ninguna hoja."
    );
  }

  const worksheet =
    workbook.Sheets[
      sheetName
    ];

  const rawRows =
    XLSX.utils.sheet_to_json(
      worksheet,
      {
        defval: "",
        raw: true,
      }
    );

  if (
    !rawRows.length
  ) {
    throw new Error(
      "El reporte de Zoom está vacío."
    );
  }

  const headers =
    Object.keys(
      rawRows[0]
    );

  const emailColumn =
    findColumn(headers, [
      "Correo electrónico",
      "Correo electronico",
      "Correo",
      "Email",
      "E-mail",
      "Email Address",
    ]);

  const nameColumn =
    findColumn(headers, [
      "Nombre (nombre original)",
      "Nombre original",
      "Nombre",
      "Name",
    ]);

  const entryColumn =
    findColumn(headers, [
      "Hora de entrada",
      "Entrada",
      "Hora entrada",
      "Join Time",
      "Hora de ingreso",
    ]);

  const exitColumn =
    findColumn(headers, [
      "Hora de salida",
      "Salida",
      "Hora salida",
      "Leave Time",
      "Hora de salida",
    ]);

  const durationColumn =
    findColumn(headers, [
      "Duración (minutos)",
      "Duracion (minutos)",
      "Duración",
      "Duracion",
      "Minutos",
      "Duration (minutes)",
      "Duration",
    ]);

  if (!emailColumn) {
    throw new Error(
      "No encontré la columna Correo electrónico en el reporte de Zoom."
    );
  }

  if (!durationColumn) {
    throw new Error(
      "No encontré la columna Duración (minutos) en el reporte de Zoom."
    );
  }

  if (!entryColumn) {
    throw new Error(
      "No encontré la columna Hora de entrada en el reporte de Zoom."
    );
  }

  const rows =
    rawRows
      .map((row) => ({
        email: cleanEmail(
          row[emailColumn]
        ),

        name: nameColumn
          ? String(
              row[nameColumn] ??
                ""
            ).trim()
          : "",

        entry:
          row[entryColumn],

        exit: exitColumn
          ? row[exitColumn]
          : "",

        minutes:
          parseMinutes(
            row[
              durationColumn
            ]
          ),
      }))
      .filter(
        (row) =>
          row.email ||
          row.name ||
          row.minutes > 0
      );

  if (!rows.length) {
    throw new Error(
      "El reporte de Zoom no contiene registros utilizables."
    );
  }

  return {
    rows,
    records: rows.length,
  };
};

// ============================================================
// CÍRCULOS PERMITIDOS
// ============================================================

const normalizeCircleKey = (value) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
};

const getAllowedCircles = async (
  req
) => {
  const activeCircles =
    await Circle.find({
      active: true,
    }).sort({
      name: 1,
    });

  if (
    canManageGlobal(
      req.user
    )
  ) {
    return activeCircles;
  }

  const scope =
    getCircleScope(
      req.user
    );

  const allowed =
    new Set(
      scope
        .map((circle) =>
          normalizeCircleKey(circle)
        )
        .filter(Boolean)
    );

  return activeCircles.filter((circle) =>
    allowed.has(
      normalizeCircleKey(circle.name)
    )
  );
};

// ============================================================
// REUNIÓN ZOOM
// ============================================================

const getOrCreateZoomMeeting =
  async ({
    circle,
    type,
    date,
    rows,
    req,
  }) => {
    const normalizedType =
      normalizeType(type);

    if (
      !canManageCircle(
        req.user,
        circle
      )
    ) {
      throw new Error(
        `No tienes permisos para procesar el círculo "${circle}".`
      );
    }

    let meeting =
      await Meeting.findOne({
        circle,
        type:
          normalizedType,
        date,
        active: true,
      }).sort({
        createdAt: 1,
      });

    if (meeting) {
      return meeting;
    }

    let time = "00:00";
    let endTime = "00:00";
    let title =
      normalizedType;
    let location = "Zoom";

    if (
      normalizedType ===
      "HEALTH"
    ) {
      const dateObject =
        new Date(
          `${date}T12:00:00`
        );

      /*
       * HEALTH solo utiliza
       * jueves.
       */
      if (
        dateObject.getDay() !==
        HEALTH_CONFIG.day
      ) {
        throw new Error(
          `La fecha ${date} no es jueves. HEALTH solo utiliza sus sesiones fijas de los jueves.`
        );
      }

      time =
        HEALTH_CONFIG.time;

      endTime =
        HEALTH_CONFIG.endTime;

      title =
        HEALTH;

      location =
        "Virtual / Presencial";
    } else {
      /*
       * ANUNCIOS CORPORATIVOS:
       * utiliza la fecha detectada
       * y la primera hora de entrada
       * / última salida del reporte.
       */
      const entryTimes =
        rows
          .map(
            (row) =>
              parseTimeValue(
                row.entry
              )
          )
          .filter(Boolean)
          .sort();

      const exitTimes =
        rows
          .map(
            (row) =>
              parseTimeValue(
                row.exit
              )
          )
          .filter(Boolean)
          .sort();

      time =
        entryTimes[0] ||
        "00:00";

      endTime =
        exitTimes[
          exitTimes.length - 1
        ] ||
        time;

      title =
        "ANUNCIOS CORPORATIVOS";

      location = "Zoom";
    }

    meeting =
      await Meeting.create({
        title,
        type:
          normalizedType,
        circle,
        host: "Sistema",
        date,
        time,
        endTime,
        location,
        active: true,
        createdBy:
          req.user?.adminId ||
          req.user?.name ||
          "",
        attendees: [],
      });

    return meeting;
  };

// ============================================================
// GUARDAR ASISTENCIA
// ============================================================

const saveZoomAttendance =
  async ({
    meeting,
    user,
    attended,
    totalMinutes,
  }) => {
    const status =
      attended
        ? "Asistió"
        : "No asistió";

    let attendance =
      await Attendance.findOne(
        {
          meeting:
            meeting._id,
          user:
            user._id,
        }
      );

    if (!attendance) {
      attendance =
        new Attendance({
          meeting:
            meeting._id,
          user:
            user._id,
        });
    }

    attendance.doc =
      user.doc;

    attendance.name =
      user.name;

    attendance.circle =
      user.circle;

    attendance.status =
      status;

    attendance.source =
      "SYSTEM";

    attendance.attendanceMode =
      "MANUAL";

    attendance.registeredBy =
      "ZOOM";

    attendance.registeredAt =
      new Date();

    attendance.note =
      attended
        ? `🎥 Zoom validado · ${totalMinutes} min acumulados · correo coincidente`
        : !user.email
        ? "🎥 El miembro no tiene correo registrado en el Directorio de Miembros."
        : `🎥 Zoom: ${totalMinutes} min acumulados · no alcanza ${ZOOM_MINUTES_REQUIRED} min`;

    attendance.notes =
      attendance.note;

    attendance.justificationReason =
      "";

    attendance.justifiedAt =
      null;

    attendance.justifiedBy =
      "";

    attendance.attendedAt =
      attended
        ? new Date()
        : null;

    await attendance.save();

    /*
     * Mantener Meeting.attendees
     * sincronizado.
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

    if (
      attended &&
      attendeeIndex === -1
    ) {
      meeting.attendees.push(
        user.doc
      );
    }

    if (
      !attended &&
      attendeeIndex !== -1
    ) {
      meeting.attendees.splice(
        attendeeIndex,
        1
      );
    }

    return attendance;
  };

// ============================================================
// INFO
// ============================================================

const getInfo = async (
  req,
  res
) => {
  try {
    const allowedCircles =
      await getAllowedCircles(
        req
      );

    const circleNames =
      allowedCircles.map(
        (circle) =>
          circle.name
      );

    const userQuery =
      canManageGlobal(
        req.user
      )
        ? {}
        : {
            circle: {
              $in: circleNames,
            },
          };

    const members =
      await User.countDocuments(
        userQuery
      );

    return res.json({
      members,
      records: 0,
      emails: 0,
      detectedDate: "",
      circles:
        allowedCircles.length,
    });
  } catch (error) {
    console.error(
      "[Zoom] Error obteniendo información:",
      error
    );

    return res.status(500).json({
      message:
        "No se pudo obtener la información de Zoom.",
    });
  }
};

// ============================================================
// PROCESAR REPORTE
// ============================================================

const processReport = async (
  req,
  res
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message:
          "Selecciona un reporte de Zoom.",
      });
    }

    const sessionType =
      normalizeType(
        req.body.sessionType
      );

    if (
      !ALLOWED_SESSION_TYPES.includes(
        sessionType
      )
    ) {
      return res.status(400).json({
        message:
          "Selecciona un tipo de sesión válido.",
      });
    }

    /*
     * Moderador = solo lectura.
     */
    if (!canManageGlobal(req.user)) {
      const scope = getCircleScope(req.user);

      if (!scope.length) {
        return res.status(403).json({
          message:
            "Tu usuario no tiene círculos asignados para procesar asistencia de Zoom.",
        });
      }

      const hasManageableCircle = scope.some((circle) =>
        canManageCircle(req.user, circle)
      );

      if (!hasManageableCircle) {
        return res.status(403).json({
          message:
            "Tu usuario no tiene permisos para procesar asistencia de Zoom.",
        });
      }
    }

    // ----------------------------------------------------------
    // LEER REPORTE
    // ----------------------------------------------------------

    const parsed =
      parseZoomFile(
        req.file.buffer
      );

    const rows =
      parsed.rows;

    const detected =
      getDetectedDate(
        rows
      );

    if (
      !detected.date
    ) {
      if (
        detected.dates.length >
        1
      ) {
        return res.status(400).json({
          message:
            "El reporte contiene varias fechas. Carga un reporte correspondiente a una sola sesión.",
          dates:
            detected.dates,
        });
      }

      return res.status(400).json({
        message:
          "No pude detectar la fecha de la sesión en Hora de entrada.",
      });
    }

    const date =
      detected.date;

    // ----------------------------------------------------------
    // CÍRCULOS PERMITIDOS
    // ----------------------------------------------------------

    const allowedCircles =
      await getAllowedCircles(
        req
      );

    if (
      !allowedCircles.length
    ) {
      return res.status(403).json({
        message:
          "No tienes círculos asignados para procesar asistencia.",
      });
    }

    const allowedCircleNames =
      allowedCircles.map(
        (circle) =>
          circle.name
      );

    const allowedCircleKeys =
      new Set(
        allowedCircleNames.map(
          (circle) =>
            String(
              circle
            )
              .trim()
              .toUpperCase()
        )
      );

    // ----------------------------------------------------------
    // MIEMBROS DEL DIRECTORIO
    // ----------------------------------------------------------

    const userQuery =
      canManageGlobal(
        req.user
      )
        ? {}
        : {
            circle: {
              $in:
                allowedCircleNames,
            },
          };

    const members =
      await User.find(
        userQuery
      ).sort({
        name: 1,
      });

    if (!members.length) {
      return res.status(400).json({
        message:
          "No hay miembros disponibles en los círculos que puedes gestionar.",
      });
    }

    // ----------------------------------------------------------
    // AGRUPAR ZOOM POR CORREO
    // ----------------------------------------------------------

    const rowsByEmail =
      new Map();

    const minutesByEmail =
      new Map();

    for (
      const row of rows
    ) {
      const email =
        cleanEmail(
          row.email
        );

      if (!email) {
        continue;
      }

      if (
        !rowsByEmail.has(
          email
        )
      ) {
        rowsByEmail.set(
          email,
          []
        );
      }

      rowsByEmail
        .get(email)
        .push(row);

      const current =
        minutesByEmail.get(
          email
        ) || 0;

      minutesByEmail.set(
        email,
        current +
          parseMinutes(
            row.minutes
          )
      );
    }

    // ----------------------------------------------------------
    // ÍNDICE DE MIEMBROS
    // ----------------------------------------------------------

    const membersByEmail =
      new Map();

    const membersByDni =
      new Map();

    for (
      const member of members
    ) {
      const email =
        cleanEmail(
          member.email
        );

      if (email) {
        membersByEmail.set(
          email,
          member
        );
      }

      const dni =
        cleanDni(
          member.doc
        );

      if (dni) {
        membersByDni.set(
          dni,
          member
        );
      }
    }

    // ----------------------------------------------------------
    // CORREOS NO ENCONTRADOS
    // ----------------------------------------------------------

    let unmatched = 0;

    rowsByEmail.forEach(
      (
        _rows,
        email
      ) => {
        if (
          !membersByEmail.has(
            email
          )
        ) {
          unmatched++;
        }
      }
    );

    // ----------------------------------------------------------
    // AGRUPAR MIEMBROS POR CÍRCULO
    // ----------------------------------------------------------

    const membersByCircle =
      new Map();

    for (
      const member of members
    ) {
      const rawCircle =
        String(
          member.circle || ""
        ).trim();

      const circleKey =
        rawCircle.toUpperCase();

      if (
        !rawCircle ||
        !allowedCircleKeys.has(
          circleKey
        )
      ) {
        continue;
      }

      const activeCircle =
        allowedCircles.find(
          (circle) =>
            normalizeCircleKey(circle.name) ===
            circleKey
        );

      if (
        !activeCircle
      ) {
        continue;
      }

      const circleName =
        activeCircle.name;

      if (
        !membersByCircle.has(
          circleKey
        )
      ) {
        membersByCircle.set(
          circleKey,
          {
            circle:
              circleName,
            members: [],
          }
        );
      }

      membersByCircle
        .get(circleKey)
        .members.push(
          member
        );
    }

    // ----------------------------------------------------------
    // PROCESAR CADA CÍRCULO
    // ----------------------------------------------------------

    let present = 0;
    let absent = 0;

    const meetings = [];
    const results = [];

    for (
      const group of membersByCircle.values()
    ) {
      if (
        !canManageGlobal(req.user) &&
        !canManageCircle(req.user, group.circle)
      ) {
        continue;
      }

      const meeting =
        await getOrCreateZoomMeeting(
          {
            circle:
              group.circle,
            type:
              sessionType,
            date,
            rows,
            req,
          }
        );

      if (
        !meetings.some(
          (item) =>
            String(
              item._id
            ) ===
            String(
              meeting._id
            )
        )
      ) {
        meetings.push(
          meeting
        );
      }

      for (
        const member of group.members
      ) {
        const email =
          cleanEmail(
            member.email
          );

        const zoomRows =
          email
            ? rowsByEmail.get(
                email
              ) || []
            : [];

        const totalMinutes =
          email
            ? Number(
                (
                  minutesByEmail.get(
                    email
                  ) || 0
                ).toFixed(2)
              )
            : 0;

        /*
         * REGLA EXACTA DE TU BASE:
         *
         * correo del Directorio
         * +
         * aparición en Zoom
         * +
         * mínimo 10 minutos.
         */
        const attended =
          Boolean(
            email &&
              zoomRows.length >
                0 &&
              totalMinutes >=
                ZOOM_MINUTES_REQUIRED
          );

        await saveZoomAttendance(
          {
            meeting,
            user: member,
            attended,
            totalMinutes,
          }
        );

        if (attended) {
          present++;
        } else {
          absent++;
        }

        results.push({
          dni:
            member.doc || "",

          name:
            member.name || "",

          email:
            member.email || "",

          circle:
            group.circle,

          zoomEmail:
            zoomRows.length
              ? email
              : "—",

          totalMinutes,

          status:
            attended
              ? "ASISTIÓ"
              : "FALTA",

          meetingId:
            meeting._id,
        });
      }

      await meeting.save();
    }

    // ----------------------------------------------------------
    // AUDITORÍA
    // ----------------------------------------------------------

    await createAuditLog({
      admin:
        req.user,

      action:
        "Procesó asistencia de Zoom",

      module:
        "Asistencia",

      description:
        `Procesamiento Zoom de ${sessionType} del ${date}: ${present} asistencias, ${absent} faltas y ${unmatched} correos no encontrados.`,

      circle:
        canManageGlobal(
          req.user
        )
          ? "GLOBAL"
          : allowedCircleNames.join(
              ", "
            ),

      metadata: {
        fileName:
          req.file.originalname,

        sessionType,

        detectedDate:
          date,

        records:
          rows.length,

        emails:
          rowsByEmail.size,

        members:
          members.length,

        circles:
          meetings.length,

        present,

        absent,

        unmatched,

        minimumMinutes:
          ZOOM_MINUTES_REQUIRED,
      },
    });

    // ----------------------------------------------------------
    // RESPUESTA
    // ----------------------------------------------------------

    return res.json({
      success: true,

      message:
        "Asistencia de Zoom procesada correctamente.",

      records:
        rows.length,

      emails:
        rowsByEmail.size,

      detectedDate:
        date,

      applied:
        results.length,

      processed:
        results.length,

      present,

      absent,

      unmatched,

      circles:
        meetings.map(
          (meeting) =>
            meeting.circle
        ),

      meetings:
        meetings.map(
          (meeting) => ({
            id:
              meeting._id,

            circle:
              meeting.circle,

            type:
              meeting.type,

            date:
              meeting.date,
          })
        ),

      results,
    });
  } catch (error) {
    console.error(
      "[Zoom] Error procesando reporte:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "No se pudo procesar el reporte de Zoom.",
    });
  }
};

module.exports = {
  getInfo,
  processReport,
};