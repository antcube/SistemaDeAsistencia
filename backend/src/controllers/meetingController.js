const Meeting = require("../models/Meeting");
const Circle = require("../models/Circle");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const { createAuditLog } = require("../services/auditService");

const {
  getMeetingsForMonth,
} = require("../services/scheduleService");

const {
  canManageGlobal,
  canManageCircle,
} = require("../middleware/permissionMiddleware");

const meetingSnapshot = (meeting) => ({
  title: meeting.title || "",
  type: meeting.type || "",
  circle: meeting.circle || "",
  host: meeting.host || "",
  date: meeting.date || "",
  time: meeting.time || "",
  endTime: meeting.endTime || "",
  location: meeting.location || "",
  active: Boolean(meeting.active),
  deletedAt: meeting.deletedAt || null,
  deletedBy: meeting.deletedBy || "",
  deletedBySchedule: Boolean(meeting.deletedBySchedule),
  deletedByScheduleChange: Boolean(meeting.deletedByScheduleChange),
  replacementScheduleId: meeting.replacementScheduleId || null,
  manuallyRescheduled: Boolean(meeting.manuallyRescheduled),
  originalScheduleDate: meeting.originalScheduleDate || "",
  originalScheduleTime: meeting.originalScheduleTime || "",
  qrActive: Boolean(meeting.qrActive),
  qrStartTimestamp: meeting.qrStartTimestamp || null,
  qrEndTimestamp: meeting.qrEndTimestamp || null,
});

const VALID_TYPES = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
  "ORDINARIA",
];

const isValidDate = (value) => {
  if (typeof value !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return !Number.isNaN(date.getTime());
};

const hasCirclePermission = (req, circle) => {
  if (canManageGlobal(req.user)) {
    return true;
  }

  return canManageCircle(req.user, circle);
};

/**
 * ============================================================
 * OBTENER REUNIONES POR MES
 * ============================================================
 */
const getMeetings = async (req, res) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return res.status(400).json({
        message: "Año o mes inválido.",
      });
    }

    const circle = String(req.query.circle || "").trim();
    const type = String(req.query.type || "").trim();

    if (circle && !hasCirclePermission(req, circle)) {
      return res.status(403).json({
        message: "No tienes permisos para este círculo.",
      });
    }

    const meetings = await getMeetingsForMonth(year, month, {
      circle: circle || null,
      type: type || null,
    });

    const filteredMeetings = meetings.filter((meeting) =>
      hasCirclePermission(req, meeting.circle)
    );

    return res.json(filteredMeetings);
  } catch (error) {
    console.error("Error obteniendo reuniones:", error);

    return res.status(500).json({
      message: "Error obteniendo reuniones.",
    });
  }
};

/**
 * ============================================================
 * OBTENER UNA REUNIÓN
 * ============================================================
 */
const getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Reunión no encontrada.",
      });
    }

    if (!hasCirclePermission(req, meeting.circle)) {
      return res.status(403).json({
        message: "No tienes permisos para verla.",
      });
    }

    return res.json(meeting);
  } catch (error) {
    console.error("Error obteniendo reunión:", error);

    return res.status(500).json({
      message: "Error obteniendo reunión.",
    });
  }
};

/**
 * ============================================================
 * OBTENER REUNIÓN PARA QR PÚBLICO
 * ============================================================
 *
 * IMPORTANTE:
 *
 * Esta ruta es pública porque la utiliza el miembro
 * al escanear el QR.
 *
 * NO consulta asistencias.
 * Solamente devuelve los datos mínimos de la reunión
 * necesarios para registrar la asistencia.
 */
const getPublicQrMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Reunión no encontrada.",
      });
    }

    if (!meeting.active) {
      return res.status(400).json({
        message: "Esta reunión ya no está activa.",
      });
    }

    if (!meeting.qrActive) {
      return res.status(400).json({
        message: "El QR de esta reunión no está activo.",
      });
    }

    const now = new Date();

    /*
     * El QR todavía no puede utilizarse.
     */
    if (
      meeting.qrStartTimestamp &&
      now < new Date(meeting.qrStartTimestamp)
    ) {
      return res.status(400).json({
        message: "El QR todavía no está disponible.",
      });
    }

    /*
     * El QR expiró.
     */
    if (
      meeting.qrEndTimestamp &&
      now >= new Date(meeting.qrEndTimestamp)
    ) {
      meeting.qrActive = false;

      await meeting.save();

      return res.status(400).json({
        message: "El QR de esta reunión ha expirado.",
      });
    }

    /*
     * IMPORTANTE:
     * Devolvemos _id porque AttendancePortal.jsx
     * utiliza qrMeeting._id para registrar asistencia.
     *
     * No devolvemos información de asistencia.
     */
    return res.json({
      success: true,

      meeting: {
        _id: meeting._id,

        title: meeting.title,
        type: meeting.type,
        circle: meeting.circle,

        date: meeting.date,
        time: meeting.time,
        endTime: meeting.endTime,

        location: meeting.location,

        qrActive: meeting.qrActive,

        qrStartTimestamp:
          meeting.qrStartTimestamp,

        qrEndTimestamp:
          meeting.qrEndTimestamp,
      },
    });
  } catch (error) {
    console.error(
      "Error obteniendo reunión pública por QR:",
      error
    );

    return res.status(500).json({
      message: "Error obteniendo la reunión.",
    });
  }
};

/**
 * ============================================================
 * CREAR REUNIÓN MANUAL
 * ============================================================
 */
const createMeeting = async (req, res) => {
  try {
    const {
      title,
      type,
      circle,
      host = "",
      date,
      time = "",
      endTime = "",
      location = "",
    } = req.body;

    if (!title || !type || !circle || !date) {
      return res.status(400).json({
        message: "Faltan campos obligatorios.",
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        message: "Tipo de reunión no válido.",
      });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({
        message: "La fecha no es válida.",
      });
    }

    if (!hasCirclePermission(req, circle)) {
      return res.status(403).json({
        message: "No tienes permisos para este círculo.",
      });
    }

    const circleExists = await Circle.findOne({
      name: circle,
      active: true,
    });

    if (!circleExists) {
      return res.status(400).json({
        message:
          "El círculo seleccionado no existe o está inactivo.",
      });
    }

    const deletedMeeting = await Meeting.findOne({
      circle: String(circle).trim(),
      type,
      date,
      time,
      active: false,
      deletedBySchedule: { $ne: true },
      deletedByScheduleChange: { $ne: true },
    }).sort({ deletedAt: -1, updatedAt: -1 });

    if (deletedMeeting) {
      const before = meetingSnapshot(deletedMeeting);
      deletedMeeting.title = title;
      deletedMeeting.type = type;
      deletedMeeting.circle = circle;
      deletedMeeting.host = host;
      deletedMeeting.date = date;
      deletedMeeting.time = time;
      deletedMeeting.endTime = endTime;
      deletedMeeting.location = location;
      deletedMeeting.active = true;
      deletedMeeting.deletedAt = null;
      deletedMeeting.deletedBy = "";
      deletedMeeting.deletedBySchedule = false;
      deletedMeeting.deletedByScheduleChange = false;
      deletedMeeting.replacementScheduleId = null;
      deletedMeeting.manuallyRescheduled = false;
      deletedMeeting.originalScheduleDate = "";
      deletedMeeting.originalScheduleTime = "";
      deletedMeeting.qrActive = false;
      deletedMeeting.qrStartTimestamp = null;
      deletedMeeting.qrEndTimestamp = null;
      await deletedMeeting.save();

      await createAuditLog({
        admin: req.user,
        action: "RESTORE_MEETING",
        module: "meetings",
        description: `Se restauró la reunión ${deletedMeeting.title} del ${deletedMeeting.date}.`,
        targetId: deletedMeeting._id,
        targetName: deletedMeeting.title,
        circle: deletedMeeting.circle,
        reversible: true,
        metadata: { before, after: meetingSnapshot(deletedMeeting), meetingDate: deletedMeeting.date, meetingTime: deletedMeeting.time, meetingType: deletedMeeting.type, meetingTitle: deletedMeeting.title },
      });

      return res.status(200).json({
        message: "La reunión eliminada anteriormente fue restaurada conservando sus datos.",
        restored: true,
        meeting: deletedMeeting,
      });
    }

    const meeting = await Meeting.create({
      title, type, circle, host, date, time, endTime, location, scheduleId: null, active: true, createdBy: req.user.adminId,
    });

    await createAuditLog({
      admin: req.user,
      action: "CREATE_MEETING",
      module: "meetings",
      description: `Se creó la reunión ${meeting.title} (${meeting.type}) del ${meeting.date}${meeting.time ? ` a las ${meeting.time}` : ""}.`,
      targetId: meeting._id,
      targetName: meeting.title,
      circle: meeting.circle,
      reversible: true,
      metadata: { after: meetingSnapshot(meeting), meetingDate: meeting.date, meetingTime: meeting.time, meetingType: meeting.type, meetingTitle: meeting.title },
    });

    return res.status(201).json({
      message: "Reunión creada correctamente.",
      restored: false,
      meeting,
    });
  } catch (error) {
    console.error("Error creando reunión:", error);

    return res.status(500).json({
      message: "Error creando reunión.",
    });
  }
};


/**
 * ============================================================
 * CREAR REUNIONES EN LOTE (UNA SOLA ACCIÓN DE AUDITORÍA)
 * ============================================================
 *
 * Se usa cuando una misma acción crea la misma reunión para
 * varios círculos (por ejemplo ANUNCIOS CORPORATIVOS globales).
 * La operación completa genera UN solo registro en Bitácora y
 * UN solo botón Deshacer.
 */
const createMeetingsBatch = async (req, res) => {
  try {
    const {
      title,
      type,
      circles,
      host = "",
      date,
      time = "",
      endTime = "",
      location = "",
    } = req.body;

    const cleanCircles = [
      ...new Set(
        (Array.isArray(circles) ? circles : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      ),
    ];

    if (!title || !type || !cleanCircles.length || !date) {
      return res.status(400).json({
        message: "Faltan campos obligatorios.",
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        message: "Tipo de reunión no válido.",
      });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({
        message: "La fecha no es válida.",
      });
    }

    if (
      !cleanCircles.every((circle) =>
        hasCirclePermission(req, circle)
      )
    ) {
      return res.status(403).json({
        message: "No tienes permisos para uno o más círculos.",
      });
    }

    const activeCircles = await Circle.find({
      name: { $in: cleanCircles },
      active: true,
    })
      .select("name")
      .lean();

    const activeNames = new Set(
      activeCircles.map((item) => String(item.name || "").trim())
    );

    const missing = cleanCircles.filter(
      (circle) => !activeNames.has(circle)
    );

    if (missing.length) {
      return res.status(400).json({
        message: `Los siguientes círculos no existen o están inactivos: ${missing.join(", ")}.`,
      });
    }

    const allActiveCircles = await Circle.find({ active: true })
      .select("name")
      .lean();

    const allActiveNames = allActiveCircles
      .map((item) => String(item.name || "").trim())
      .filter(Boolean);

    const isAllCircles =
      allActiveNames.length > 0 &&
      cleanCircles.length === allActiveNames.length &&
      allActiveNames.every((name) => cleanCircles.includes(name));

    const affectedMeetings = [];
    const meetings = [];

    for (const circle of cleanCircles) {
      const deletedMeeting = await Meeting.findOne({
        circle,
        type,
        date,
        time,
        active: false,
        deletedBySchedule: { $ne: true },
        deletedByScheduleChange: { $ne: true },
      }).sort({ deletedAt: -1, updatedAt: -1 });

      if (deletedMeeting) {
        const before = meetingSnapshot(deletedMeeting);

        deletedMeeting.title = title;
        deletedMeeting.type = type;
        deletedMeeting.circle = circle;
        deletedMeeting.host = host;
        deletedMeeting.date = date;
        deletedMeeting.time = time;
        deletedMeeting.endTime = endTime;
        deletedMeeting.location = location;
        deletedMeeting.active = true;
        deletedMeeting.deletedAt = null;
        deletedMeeting.deletedBy = "";
        deletedMeeting.deletedBySchedule = false;
        deletedMeeting.deletedByScheduleChange = false;
        deletedMeeting.replacementScheduleId = null;
        deletedMeeting.manuallyRescheduled = false;
        deletedMeeting.originalScheduleDate = "";
        deletedMeeting.originalScheduleTime = "";
        deletedMeeting.qrActive = false;
        deletedMeeting.qrStartTimestamp = null;
        deletedMeeting.qrEndTimestamp = null;
        await deletedMeeting.save();

        affectedMeetings.push({
          meetingId: String(deletedMeeting._id),
          mode: "RESTORED",
          before,
          after: meetingSnapshot(deletedMeeting),
          circle,
        });
        meetings.push(deletedMeeting);
        continue;
      }

      const existingMeeting = await Meeting.findOne({
        circle,
        type,
        date,
        time,
        active: true,
      });

      if (existingMeeting) {
        meetings.push(existingMeeting);
        continue;
      }

      const meeting = await Meeting.create({
        title,
        type,
        circle,
        host,
        date,
        time,
        endTime,
        location,
        scheduleId: null,
        active: true,
        createdBy: req.user.adminId,
      });

      affectedMeetings.push({
        meetingId: String(meeting._id),
        mode: "CREATED",
        before: null,
        after: meetingSnapshot(meeting),
        circle,
      });
      meetings.push(meeting);
    }

    if (affectedMeetings.length) {
      const scopeLabel = isAllCircles
        ? "todos los círculos activos"
        : `${cleanCircles.length} círculo(s)`;

      await createAuditLog({
        admin: req.user,
        action: "CREATE_MEETINGS_BATCH",
        module: "meetings",
        description: `Se creó ${title} (${type}) para ${scopeLabel}, fecha ${date}${time ? ` a las ${time}` : ""}.`,
        targetId: "",
        targetName: title,
        circle: isAllCircles ? "GLOBAL" : cleanCircles.join(", "),
        reversible: true,
        metadata: {
          affectedMeetings,
          meetingIds: affectedMeetings.map((item) => item.meetingId),
          circles: cleanCircles,
          scope: isAllCircles ? "ALL_CIRCLES" : "MULTI_CIRCLE",
          meetingDate: date,
          meetingTime: time,
          meetingType: type,
          meetingTitle: title,
          affectedCount: affectedMeetings.length,
        },
      });
    }

    return res.status(201).json({
      message: isAllCircles
        ? `Reunión creada para todos los círculos activos (${meetings.length}).`
        : `Reuniones procesadas correctamente (${meetings.length}).`,
      meetings,
      affectedCount: affectedMeetings.length,
      scope: isAllCircles ? "ALL_CIRCLES" : "MULTI_CIRCLE",
    });
  } catch (error) {
    console.error("Error creando reuniones en lote:", error);
    return res.status(500).json({
      message: "Error creando reuniones en lote.",
    });
  }
};

/**
 * ============================================================
 * ACTUALIZAR REUNIÓN
 * ============================================================
 */
const updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Reunión no encontrada.",
      });
    }

    if (!hasCirclePermission(req, meeting.circle)) {
      return res.status(403).json({
        message: "No tienes permisos.",
      });
    }

    const before = meetingSnapshot(meeting);

    const { title, type, circle, host, date, time, endTime, location } = req.body;

    if (title !== undefined) {
      meeting.title = title;
    }

    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          message: "Tipo de reunión no válido.",
        });
      }

      meeting.type = type;
    }

    if (circle !== undefined) {
      if (!hasCirclePermission(req, circle)) {
        return res.status(403).json({
          message:
            "No tienes permisos para el nuevo círculo.",
        });
      }

      meeting.circle = circle;
    }

    if (host !== undefined) {
      meeting.host = host;
    }

    if (date !== undefined) {
      if (!isValidDate(date)) {
        return res.status(400).json({
          message: "La fecha no es válida.",
        });
      }

      meeting.date = date;
    }

    if (time !== undefined) {
      meeting.time = time;
    }

    if (endTime !== undefined) {
      meeting.endTime = endTime;
    }

    if (location !== undefined) {
      meeting.location = location;
    }

    await meeting.save();

    await createAuditLog({
      admin: req.user, action: "UPDATE_MEETING", module: "meetings",
      description: `Se actualizó la reunión ${meeting.title} del ${meeting.date}.`,
      targetId: meeting._id, targetName: meeting.title, circle: meeting.circle, reversible: true,
      metadata: { before, after: meetingSnapshot(meeting), meetingDate: meeting.date, meetingTime: meeting.time, meetingType: meeting.type, meetingTitle: meeting.title },
    });

    return res.json({
      message: "Reunión actualizada correctamente.",
      meeting,
    });
  } catch (error) {
    console.error(
      "Error actualizando reunión:",
      error
    );

    return res.status(500).json({
      message: "Error actualizando reunión.",
    });
  }
};

/**
 * ============================================================
 * ELIMINAR REUNIÓN
 * ============================================================
 */
const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Reunión no encontrada.",
      });
    }

    if (!hasCirclePermission(req, meeting.circle)) {
      return res.status(403).json({
        message: "No tienes permisos.",
      });
    }

    const before = meetingSnapshot(meeting);

    meeting.active = false;
    meeting.deletedAt = new Date();
    meeting.deletedBy = req.user.adminId;

    meeting.deletedBySchedule = false;
    meeting.deletedByScheduleChange = false;
    meeting.replacementScheduleId = null;

    await meeting.save();

    await createAuditLog({
      admin: req.user, action: "DELETE_MEETING", module: "meetings",
      description: `Se eliminó la reunión ${meeting.title} (${meeting.type}) del ${meeting.date}.`,
      targetId: meeting._id, targetName: meeting.title, circle: meeting.circle, reversible: true,
      metadata: { before, after: meetingSnapshot(meeting), meetingDate: meeting.date, meetingTime: meeting.time, meetingType: meeting.type, meetingTitle: meeting.title },
    });

    return res.json({
      message: "Reunión eliminada correctamente.",
    });
  } catch (error) {
    console.error(
      "Error eliminando reunión:",
      error
    );

    return res.status(500).json({
      message: "Error eliminando reunión.",
    });
  }
};

/**
 * ============================================================
 * RESTAURAR REUNIÓN
 * ============================================================
 */
const restoreMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Reunión no encontrada.",
      });
    }

    if (!hasCirclePermission(req, meeting.circle)) {
      return res.status(403).json({
        message: "No tienes permisos.",
      });
    }

    if (
      meeting.deletedBySchedule ||
      meeting.deletedByScheduleChange
    ) {
      return res.status(400).json({
        message:
          "Esta reunión fue eliminada por una acción de programación y no puede restaurarse individualmente.",
      });
    }

    const before = meetingSnapshot(meeting);

    meeting.active = true;
    meeting.deletedAt = null;
    meeting.deletedBy = "";

    await meeting.save();

    await createAuditLog({
      admin: req.user, action: "RESTORE_MEETING", module: "meetings",
      description: `Se restauró la reunión ${meeting.title} del ${meeting.date}.`,
      targetId: meeting._id, targetName: meeting.title, circle: meeting.circle, reversible: true,
      metadata: { before, after: meetingSnapshot(meeting), meetingDate: meeting.date, meetingTime: meeting.time, meetingType: meeting.type, meetingTitle: meeting.title },
    });

    return res.json({
      message: "Reunión restaurada correctamente.",
      meeting,
    });
  } catch (error) {
    console.error(
      "Error restaurando reunión:",
      error
    );

    return res.status(500).json({
      message: "Error restaurando reunión.",
    });
  }
};

/**
 * ============================================================
 * CAMBIAR DÍA Y HORA DE UNA REUNIÓN
 * ============================================================
 */
const moveMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: "Reunión no encontrada." });
    }

    if (!meeting.active) {
      return res.status(400).json({ message: "No se puede cambiar de día una reunión eliminada." });
    }

    if (!hasCirclePermission(req, meeting.circle)) {
      return res.status(403).json({ message: "No tienes permisos para esta reunión." });
    }

    const before = meetingSnapshot(meeting);
    const { date, time = "", endTime = "" } = req.body;

    if (!date || !isValidDate(date)) {
      return res.status(400).json({ message: "La nueva fecha no es válida." });
    }

    if (!time) {
      return res.status(400).json({ message: "La nueva hora es obligatoria." });
    }

    if (endTime && endTime <= time) {
      return res.status(400).json({ message: "La hora de finalización debe ser posterior a la hora de inicio." });
    }

    const duplicate = await Meeting.findOne({
      _id: { $ne: meeting._id },
      circle: meeting.circle,
      type: meeting.type,
      date,
      time,
      active: true,
    });

    if (duplicate) {
      return res.status(409).json({ message: "Ya existe una reunión de este tipo, círculo, fecha y hora." });
    }

    if (meeting.scheduleId && !meeting.manuallyRescheduled) {
      meeting.originalScheduleDate = meeting.date;
      meeting.originalScheduleTime = meeting.time || "";
      meeting.manuallyRescheduled = true;
    }

    meeting.date = date;
    meeting.time = time;
    meeting.endTime = endTime;
    meeting.qrActive = false;
    meeting.qrStartTimestamp = null;
    meeting.qrEndTimestamp = null;

    await meeting.save();

    await createAuditLog({
      admin: req.user, action: "MOVE_MEETING", module: "meetings",
      description: `Se cambió la fecha/hora de ${meeting.title} a ${meeting.date} ${meeting.time}.`,
      targetId: meeting._id, targetName: meeting.title, circle: meeting.circle, reversible: true,
      metadata: { before, after: meetingSnapshot(meeting), meetingDate: meeting.date, meetingTime: meeting.time, meetingType: meeting.type, meetingTitle: meeting.title },
    });

    return res.json({
      message: "La sesión fue cambiada de día y horario correctamente.",
      meeting,
    });
  } catch (error) {
    console.error("Error cambiando día de reunión:", error);
    return res.status(500).json({ message: "Error cambiando día de reunión." });
  }
};

/**
 * ============================================================
 * ACTIVAR QR
 * ============================================================
 *
 * DURACIÓN ORIGINAL:
 * 10 MINUTOS
 *
 * Si el frontend envía una duración válida,
 * se utiliza esa duración.
 *
 * Si no la envía, el valor por defecto continúa siendo
 * 10 minutos.
 */
const activateQr = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Reunión no encontrada.",
      });
    }

    if (!hasCirclePermission(req, meeting.circle)) {
      return res.status(403).json({
        message: "No tienes permisos.",
      });
    }

    const durationMinutes = Number(
      req.body?.durationMinutes ?? 10
    );

    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0
    ) {
      return res.status(400).json({
        message: "La duración del QR no es válida.",
      });
    }

    const start = new Date();

    const end = new Date(
      start.getTime() +
        durationMinutes * 60 * 1000
    );

    const before = meetingSnapshot(meeting);

    meeting.qrActive = true;
    meeting.qrStartTimestamp = start;
    meeting.qrEndTimestamp = end;

    await meeting.save();

    await createAuditLog({
      admin: req.user, action: "ACTIVATE_QR", module: "meetings",
      description: `Se activó el QR de ${meeting.title} del ${meeting.date}.`,
      targetId: meeting._id, targetName: meeting.title, circle: meeting.circle, reversible: true,
      metadata: { before, after: meetingSnapshot(meeting), meetingDate: meeting.date, meetingTime: meeting.time, meetingType: meeting.type, meetingTitle: meeting.title },
    });

    return res.json({
      message: "QR activado correctamente.",
      meeting,
    });
  } catch (error) {
    console.error(
      "Error activando QR:",
      error
    );

    return res.status(500).json({
      message: "Error activando QR.",
    });
  }
};

/**
 * ============================================================
 * DESACTIVAR QR
 * ============================================================
 */
const deactivateQr = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Reunión no encontrada.",
      });
    }

    if (!hasCirclePermission(req, meeting.circle)) {
      return res.status(403).json({
        message: "No tienes permisos.",
      });
    }

    const before = meetingSnapshot(meeting);

    meeting.qrActive = false;
    meeting.qrEndTimestamp = new Date();

    await meeting.save();

    await createAuditLog({
      admin: req.user, action: "DEACTIVATE_QR", module: "meetings",
      description: `Se desactivó el QR de ${meeting.title} del ${meeting.date}.`,
      targetId: meeting._id, targetName: meeting.title, circle: meeting.circle, reversible: true,
      metadata: { before, after: meetingSnapshot(meeting), meetingDate: meeting.date, meetingTime: meeting.time, meetingType: meeting.type, meetingTitle: meeting.title },
    });

    return res.json({
      message: "QR desactivado correctamente.",
      meeting,
    });
  } catch (error) {
    console.error(
      "Error desactivando QR:",
      error
    );

    return res.status(500).json({
      message: "Error desactivando QR.",
    });
  }
};

/**
 * ============================================================
 * ELIMINAR TODOS LOS ANUNCIOS CORPORATIVOS
 * ============================================================
 *
 * Solo para el Administrador Principal.
 *
 * IMPORTANTE:
 * Se utiliza soft delete para conservar la integridad de los
 * registros históricos y de las asistencias relacionadas.
 */
const deleteAllCorporateAnnouncements = async (req, res) => {
  try {
    const affected = await Meeting.find({ type: "ANUNCIOS CORPORATIVOS", active: true }).select("_id title type circle date time active deletedAt deletedBy deletedBySchedule deletedByScheduleChange replacementScheduleId").lean();
    const result = await Meeting.updateMany(
      {
        type: "ANUNCIOS CORPORATIVOS",
        active: true,
      },
      {
        $set: {
          active: false,
          deletedAt: new Date(),
          deletedBy: req.user.adminId,
          deletedBySchedule: false,
          deletedByScheduleChange: false,
          replacementScheduleId: null,
        },
      }
    );

    await createAuditLog({
      admin: req.user, action: "DELETE_ALL_CORPORATE_ANNOUNCEMENTS", module: "meetings",
      description: `Se desactivaron ${result.modifiedCount} reuniones de ANUNCIOS CORPORATIVOS.`,
      targetName: "ANUNCIOS CORPORATIVOS", circle: "GLOBAL", reversible: result.modifiedCount > 0,
      metadata: { affectedMeetings: affected, meetingType: "ANUNCIOS CORPORATIVOS", affectedCount: result.modifiedCount },
    });

    return res.json({
      message:
        result.modifiedCount === 0
          ? "No había anuncios corporativos activos para eliminar."
          : `Se eliminaron ${result.modifiedCount} anuncios corporativos correctamente.`,
      deletedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error(
      "Error eliminando todos los anuncios corporativos:",
      error
    );

    return res.status(500).json({
      message: "Error eliminando los anuncios corporativos.",
    });
  }
};

/**
 * ============================================================
 * EXPORTACIONES
 * ============================================================
 */
module.exports = {
  getMeetings,
  getMeetingById,
  getPublicQrMeeting,
  createMeeting,
  createMeetingsBatch,
  updateMeeting,
  deleteMeeting,
  deleteAllCorporateAnnouncements,
  restoreMeeting,
  moveMeeting,
  activateQr,
  deactivateQr,
};