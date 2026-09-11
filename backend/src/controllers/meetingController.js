const Meeting = require("../models/Meeting");
const Circle = require("../models/Circle");
const User = require("../models/User");
const Attendance = require("../models/Attendance");

const {
  getMeetingsForMonth,
} = require("../services/scheduleService");

const {
  canManageGlobal,
  canManageCircle,
} = require("../middleware/permissionMiddleware");

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

    return res.status(201).json({
      message: "Reunión creada correctamente.",
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

    const {
      title,
      type,
      circle,
      host,
      date,
      time,
      endTime,
      location,
    } = req.body;

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

    meeting.active = false;
    meeting.deletedAt = new Date();
    meeting.deletedBy = req.user.adminId;

    meeting.deletedBySchedule = false;
    meeting.deletedByScheduleChange = false;
    meeting.replacementScheduleId = null;

    await meeting.save();

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

    meeting.active = true;
    meeting.deletedAt = null;
    meeting.deletedBy = "";

    await meeting.save();

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

    meeting.qrActive = true;
    meeting.qrStartTimestamp = start;
    meeting.qrEndTimestamp = end;

    await meeting.save();

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

    meeting.qrActive = false;
    meeting.qrEndTimestamp = new Date();

    await meeting.save();

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
 * EXPORTACIONES
 * ============================================================
 */
module.exports = {
  getMeetings,
  getMeetingById,
  getPublicQrMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  restoreMeeting,
  activateQr,
  deactivateQr,
};