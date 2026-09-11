const crypto = require("crypto");
const Meeting = require("../models/Meeting");
const Schedule = require("../models/Schedule");
const {
  generateMeetingsForSchedule,
  generateMeetingsForMonth,
  getActiveSchedules,
  deactivateFutureMeetings,
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return !Number.isNaN(date.getTime());
};

const validateWeekdays = (weekdays) => {
  return (
    Array.isArray(weekdays) &&
    weekdays.length > 0 &&
    weekdays.every(
      (day) =>
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6
    )
  );
};

const validateCirclesPermission = (req, circles) => {
  if (canManageGlobal(req.user)) {
    return true;
  }

  if (!Array.isArray(circles) || circles.length === 0) {
    return false;
  }

  return circles.every((circle) =>
    canManageCircle(req.user, circle)
  );
};

/**
 * CREA UNA NUEVA PROGRAMACIÓN.
 */
const createSchedule = async (req, res) => {
  try {
    const {
      name,
      circles,
      type,
      title,
      host = "",
      time,
      endTime,
      location = "",
      weekdays,
      startDate,
      endDate = null,
    } = req.body;

    if (
      !name ||
      !title ||
      !time ||
      !endTime ||
      !startDate
    ) {
      return res.status(400).json({
        message: "Faltan campos obligatorios.",
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        message: "Tipo de reunión no válido.",
      });
    }

    if (!Array.isArray(circles) || circles.length === 0) {
      return res.status(400).json({
        message: "Debe seleccionar al menos un círculo.",
      });
    }

    if (!validateWeekdays(weekdays)) {
      return res.status(400).json({
        message: "Debe seleccionar al menos un día válido.",
      });
    }

    if (!isValidDate(startDate)) {
      return res.status(400).json({
        message: "La fecha inicial no es válida.",
      });
    }

    if (
      endDate !== null &&
      endDate !== "" &&
      !isValidDate(endDate)
    ) {
      return res.status(400).json({
        message: "La fecha final no es válida.",
      });
    }

    if (
      endDate &&
      endDate < startDate
    ) {
      return res.status(400).json({
        message:
          "La fecha final no puede ser anterior a la fecha inicial.",
      });
    }

    if (!validateCirclesPermission(req, circles)) {
      return res.status(403).json({
        message:
          "No tienes permisos para gestionar uno o más círculos.",
      });
    }

    const schedule = await Schedule.create({
      seriesId: crypto.randomUUID(),
      version: 1,
      previousScheduleId: null,

      name,
      circles,
      type,
      title,
      host,
      time,
      endTime,
      location,
      weekdays,

      startDate,
      endDate: endDate || null,

      changeType: "CREATED",
      active: true,

      createdBy: req.user.adminId,
    });

    const start = new Date(`${startDate}T00:00:00`);

    await generateMeetingsForSchedule(
      schedule,
      start.getFullYear(),
      start.getMonth() + 1
    );

    return res.status(201).json({
      message: "Programación creada correctamente.",
      schedule,
    });
  } catch (error) {
    console.error("Error creando programación:", error);

    return res.status(500).json({
      message: "Error interno creando la programación.",
    });
  }
};

/**
 * OBTIENE PROGRAMACIONES ACTIVAS.
 */
const getSchedules = async (req, res) => {
  try {
    const schedules = await getActiveSchedules();

    const filtered = schedules.filter((schedule) =>
      validateCirclesPermission(req, schedule.circles)
    );

    return res.json(filtered);
  } catch (error) {
    console.error("Error obteniendo programaciones:", error);

    return res.status(500).json({
      message: "Error obteniendo programaciones.",
    });
  }
};

/**
 * OBTIENE UNA PROGRAMACIÓN.
 */
const getScheduleById = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        message: "Programación no encontrada.",
      });
    }

    if (
      !validateCirclesPermission(
        req,
        schedule.circles
      )
    ) {
      return res.status(403).json({
        message: "No tienes permisos para verla.",
      });
    }

    return res.json(schedule);
  } catch (error) {
    console.error(
      "Error obteniendo programación:",
      error
    );

    return res.status(500).json({
      message: "Error obteniendo programación.",
    });
  }
};

/**
 * GENERA MANUALMENTE UN MES.
 */
const generateScheduleMonth = async (req, res) => {
  try {
    const {
      year,
      month,
    } = req.body;

    const schedule = await Schedule.findById(
      req.params.id
    );

    if (!schedule) {
      return res.status(404).json({
        message: "Programación no encontrada.",
      });
    }

    if (
      !validateCirclesPermission(
        req,
        schedule.circles
      )
    ) {
      return res.status(403).json({
        message: "No tienes permisos.",
      });
    }

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

    const meetings =
      await generateMeetingsForSchedule(
        schedule,
        year,
        month
      );

    return res.json({
      message: "Mes generado correctamente.",
      created: meetings.length,
      meetings,
    });
  } catch (error) {
    console.error(
      "Error generando mes:",
      error
    );

    return res.status(500).json({
      message: "Error generando el mes.",
    });
  }
};

/**
 * ============================================================
 * MIGRAR PROGRAMACIÓN
 * ============================================================
 *
 * El horario viejo termina el día anterior.
 * El nuevo comienza en effectiveDate.
 *
 * NO se modifican las reuniones históricas.
 */
const migrateSchedule = async (req, res) => {
  try {
    const oldSchedule = await Schedule.findById(
      req.params.id
    );

    if (!oldSchedule) {
      return res.status(404).json({
        message: "Programación no encontrada.",
      });
    }

    if (
      !validateCirclesPermission(
        req,
        oldSchedule.circles
      )
    ) {
      return res.status(403).json({
        message: "No tienes permisos.",
      });
    }

    if (!oldSchedule.active) {
      return res.status(400).json({
        message:
          "Esta programación ya no está activa.",
      });
    }

    const {
      effectiveDate,
      name = oldSchedule.name,
      circles = oldSchedule.circles,
      type = oldSchedule.type,
      title = oldSchedule.title,
      host = oldSchedule.host,
      time,
      endTime,
      location = oldSchedule.location,
      weekdays,
      endDate = null,
    } = req.body;

    if (!isValidDate(effectiveDate)) {
      return res.status(400).json({
        message: "La fecha de migración no es válida.",
      });
    }

    if (effectiveDate <= oldSchedule.startDate) {
      return res.status(400).json({
        message:
          "La migración debe comenzar después del inicio de la programación actual.",
      });
    }

    if (!Array.isArray(circles) || circles.length === 0) {
      return res.status(400).json({
        message: "Debe seleccionar al menos un círculo.",
      });
    }

    if (!validateWeekdays(weekdays)) {
      return res.status(400).json({
        message: "Debe seleccionar al menos un día válido.",
      });
    }

    if (!time || !endTime) {
      return res.status(400).json({
        message:
          "Debe indicar hora inicial y hora final.",
      });
    }

    if (!validateCirclesPermission(req, circles)) {
      return res.status(403).json({
        message:
          "No tienes permisos para los círculos seleccionados.",
      });
    }

    // El día anterior será el último día
    // de la versión antigua.
    const effective = new Date(
      `${effectiveDate}T00:00:00`
    );

    effective.setDate(
      effective.getDate() - 1
    );

    const oldEndDate =
      effective.toISOString().slice(0, 10);

    const newVersion =
      (await Schedule.countDocuments({
        seriesId: oldSchedule.seriesId,
      })) + 1;

    const newSchedule =
      await Schedule.create({
        seriesId: oldSchedule.seriesId,
        version: newVersion,
        previousScheduleId: oldSchedule._id,

        name,
        circles,
        type,
        title,
        host,
        time,
        endTime,
        location,
        weekdays,

        startDate: effectiveDate,
        endDate: endDate || null,

        changeType: "MIGRATED",
        active: true,

        createdBy: req.user.adminId,
      });

    oldSchedule.endDate = oldEndDate;
    oldSchedule.active = false;
    oldSchedule.deletedAt = new Date();
    oldSchedule.deletedBy = req.user.adminId;
    oldSchedule.changeType = "MIGRATED";

    await oldSchedule.save();

    // Elimina del calendario las reuniones futuras
    // que pertenecían al horario anterior.
    await deactivateFutureMeetings({
      scheduleId: oldSchedule._id,
      effectiveDate,
      userId: req.user.adminId,
      replacementScheduleId: newSchedule._id,
      byScheduleChange: true,
    });

    // Generamos inmediatamente el mes de inicio
    // de la nueva programación.
    const start = new Date(
      `${effectiveDate}T00:00:00`
    );

    await generateMeetingsForSchedule(
      newSchedule,
      start.getFullYear(),
      start.getMonth() + 1
    );

    return res.json({
      message:
        "Programación migrada correctamente.",
      oldSchedule,
      newSchedule,
    });
  } catch (error) {
    console.error(
      "Error migrando programación:",
      error
    );

    return res.status(500).json({
      message: "Error migrando programación.",
    });
  }
};

/**
 * ============================================================
 * ELIMINAR DESDE UNA FECHA
 * ============================================================
 */
const terminateScheduleFromDate = async (
  req,
  res
) => {
  try {
    const schedule = await Schedule.findById(
      req.params.id
    );

    if (!schedule) {
      return res.status(404).json({
        message: "Programación no encontrada.",
      });
    }

    if (
      !validateCirclesPermission(
        req,
        schedule.circles
      )
    ) {
      return res.status(403).json({
        message: "No tienes permisos.",
      });
    }

    const { effectiveDate } = req.body;

    if (!isValidDate(effectiveDate)) {
      return res.status(400).json({
        message: "La fecha no es válida.",
      });
    }

    if (effectiveDate <= schedule.startDate) {
      return res.status(400).json({
        message:
          "La fecha de eliminación debe ser posterior al inicio.",
      });
    }

    const effective = new Date(
      `${effectiveDate}T00:00:00`
    );

    effective.setDate(
      effective.getDate() - 1
    );

    const previousEndDate =
      effective.toISOString().slice(0, 10);

    schedule.endDate = previousEndDate;
    schedule.active = false;
    schedule.deletedAt = new Date();
    schedule.deletedBy = req.user.adminId;
    schedule.changeType = "TERMINATED";

    await schedule.save();

    await deactivateFutureMeetings({
      scheduleId: schedule._id,
      effectiveDate,
      userId: req.user.adminId,
      byScheduleChange: false,
    });

    return res.json({
      message:
        "La programación fue eliminada desde la fecha indicada.",
      schedule,
    });
  } catch (error) {
    console.error(
      "Error terminando programación:",
      error
    );

    return res.status(500).json({
      message:
        "Error eliminando la programación.",
    });
  }
};

/**
 * Mantener esta función solamente para compatibilidad
 * con código antiguo mientras terminamos la migración.
 */
const deleteSchedule = async (req, res) => {
  return terminateScheduleFromDate(req, res);
};

const updateSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(
      req.params.id
    );

    if (!schedule) {
      return res.status(404).json({
        message: "Programación no encontrada.",
      });
    }

    if (
      !validateCirclesPermission(
        req,
        schedule.circles
      )
    ) {
      return res.status(403).json({
        message: "No tienes permisos.",
      });
    }

    /*
     * ========================================================
     * IMPORTANTE
     * ========================================================
     *
     * Este endpoint solamente permite modificar los datos
     * de la programación cuando NO estamos realizando una
     * migración desde una fecha.
     *
     * Si el cambio debe comenzar desde una fecha concreta,
     * se debe utilizar:
     *
     * POST /api/schedules/:id/migrate
     *
     * De esta manera se conserva el historial.
     */

    const allowedFields = [
      "name",
      "circles",
      "type",
      "title",
      "host",
      "time",
      "endTime",
      "location",
      "weekdays",
    ];

    /*
     * Creamos una copia de los valores que quedarían
     * después de la actualización.
     */
    const nextValues = {
      name: schedule.name,
      circles: schedule.circles,
      type: schedule.type,
      title: schedule.title,
      host: schedule.host,
      time: schedule.time,
      endTime: schedule.endTime,
      location: schedule.location,
      weekdays: schedule.weekdays,
    };

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          field
        )
      ) {
        nextValues[field] =
          req.body[field];
      }
    }

    /*
     * ========================================================
     * VALIDACIONES
     * ========================================================
     */

    if (
      !nextValues.name ||
      !String(nextValues.name).trim()
    ) {
      return res.status(400).json({
        message:
          "El nombre de la programación es obligatorio.",
      });
    }

    if (
      !nextValues.title ||
      !String(nextValues.title).trim()
    ) {
      return res.status(400).json({
        message:
          "El título de la programación es obligatorio.",
      });
    }

    if (
      !VALID_TYPES.includes(
        nextValues.type
      )
    ) {
      return res.status(400).json({
        message:
          "Tipo de reunión no válido.",
      });
    }

    if (
      !nextValues.time ||
      !nextValues.endTime
    ) {
      return res.status(400).json({
        message:
          "Debe indicar hora inicial y hora final.",
      });
    }

    if (
      nextValues.endTime <=
      nextValues.time
    ) {
      return res.status(400).json({
        message:
          "La hora de finalización debe ser posterior a la hora de inicio.",
      });
    }

    if (
      !Array.isArray(nextValues.circles) ||
      nextValues.circles.length === 0
    ) {
      return res.status(400).json({
        message:
          "Debe seleccionar al menos un círculo.",
      });
    }

    if (
      !validateWeekdays(
        nextValues.weekdays
      )
    ) {
      return res.status(400).json({
        message:
          "Debe seleccionar al menos un día válido.",
      });
    }

    if (
      !validateCirclesPermission(
        req,
        nextValues.circles
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permisos para los círculos seleccionados.",
      });
    }

    /*
     * ========================================================
     * PROTECCIÓN DEL HISTORIAL
     * ========================================================
     *
     * Si la programación ya tiene reuniones generadas,
     * NO permitimos cambiar datos que alterarían esas
     * reuniones directamente.
     *
     * En ese caso el usuario debe utilizar "Migrar".
     */

    const generatedMeetings =
      await Meeting.exists({
        scheduleId: schedule._id,
      });

    if (generatedMeetings) {
      const historySensitiveFields = [
        "circles",
        "type",
        "title",
        "host",
        "time",
        "endTime",
        "location",
        "weekdays",
      ];

      const changingHistoricalField =
        historySensitiveFields.some(
          (field) =>
            Object.prototype.hasOwnProperty.call(
              req.body,
              field
            ) &&
            JSON.stringify(
              nextValues[field]
            ) !==
              JSON.stringify(
                schedule[field]
              )
        );

      if (changingHistoricalField) {
        return res.status(409).json({
          message:
            "Esta programación ya tiene reuniones generadas. Para cambiar sus días, horario, círculos, tipo o contenido sin modificar el historial, debes realizar una migración desde una fecha.",
          code:
            "SCHEDULE_REQUIRES_MIGRATION",
          scheduleId:
            schedule._id,
        });
      }
    }

    /*
     * ========================================================
     * ACTUALIZACIÓN SEGURA
     * ========================================================
     *
     * Solamente llegamos aquí si el cambio no afecta
     * reuniones históricas.
     */

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          field
        )
      ) {
        schedule[field] =
          nextValues[field];
      }
    }

    await schedule.save();

    return res.json({
      message:
        "Programación actualizada correctamente.",
      schedule,
    });
  } catch (error) {
    console.error(
      "Error actualizando programación:",
      error
    );

    return res.status(500).json({
      message:
        "Error actualizando programación.",
    });
  }
};

const restoreSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(
      req.params.id
    );

    if (!schedule) {
      return res.status(404).json({
        message: "Programación no encontrada.",
      });
    }

    if (
      !validateCirclesPermission(
        req,
        schedule.circles
      )
    ) {
      return res.status(403).json({
        message: "No tienes permisos.",
      });
    }

    if (schedule.previousScheduleId) {
      return res.status(400).json({
        message:
          "Una versión migrada no puede restaurarse directamente. Debe gestionarse mediante el historial de la serie.",
      });
    }

    schedule.active = true;
    schedule.deletedAt = null;
    schedule.deletedBy = "";
    schedule.endDate = null;
    schedule.changeType = "CREATED";

    await schedule.save();

    return res.json({
      message:
        "Programación restaurada correctamente.",
      schedule,
    });
  } catch (error) {
    console.error(
      "Error restaurando programación:",
      error
    );

    return res.status(500).json({
      message:
        "Error restaurando programación.",
    });
  }
};

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  generateScheduleMonth,
  migrateSchedule,
  terminateScheduleFromDate,
  deleteSchedule,
  restoreSchedule,
  updateSchedule,
};