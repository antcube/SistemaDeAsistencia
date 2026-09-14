const AuditLog = require("../models/AuditLog");
const Attendance = require("../models/Attendance");
const Meeting = require("../models/Meeting");
const User = require("../models/User");

const { canManageGlobal } = require("../middleware/permissionMiddleware");

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, circle = "" } = req.query;
    const admin = req.user || req.admin;

    if (!admin) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    if (!canManageGlobal(admin)) {
      return res.status(403).json({
        message: "No tienes permiso para consultar la bitácora.",
      });
    }

    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const query = {};
    const normalizedCircle = String(circle || "").trim();

    if (normalizedCircle) {
      const safeCircle = escapeRegex(normalizedCircle);
      query.circle = {
        $regex: `(^|,\\s*)${safeCircle}(\\s*,|$)`,
        $options: "i",
      };
    }

    const skip = (currentPage - 1) * currentLimit;
    let [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    /*
     * Enriquecemos registros antiguos de asistencia que fueron creados
     * antes de esta versión. Así también muestran fecha/tipo de reunión
     * y siguen pudiendo deshacerse de forma segura cuando sea posible.
     */
    const attendanceLogs = logs.filter((log) =>
      log.module === "attendance" && log.metadata?.meetingId
    );

    if (attendanceLogs.length) {
      const meetingIds = [
        ...new Set(
          attendanceLogs
            .map((log) => String(log.metadata.meetingId || "").trim())
            .filter(Boolean)
        ),
      ];

      const meetings = await Meeting.find({
        _id: { $in: meetingIds },
      })
        .select("title type date time circle")
        .lean();

      const meetingMap = new Map(
        meetings.map((meeting) => [String(meeting._id), meeting])
      );

      logs = logs.map((log) => {
        if (log.module !== "attendance") return log;

        const metadata = { ...(log.metadata || {}) };
        const meeting = meetingMap.get(String(metadata.meetingId || ""));

        if (meeting) {
          metadata.meetingTitle ||= meeting.title || meeting.type || "Reunión";
          metadata.meetingType ||= meeting.type || "";
          metadata.meetingDate ||= meeting.date || "";
          metadata.meetingTime ||= meeting.time || "";
          log.circle ||= meeting.circle || "";
        }

        /* Compatibilidad con logs anteriores a reversible/undo. */
        if (metadata.attendanceId || log.targetId) {
          log.reversible = true;
        }

        log.metadata = metadata;
        return log;
      });
    }

    return res.json({
      data: logs,
      pagination: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("Error obteniendo bitácora:", error);
    return res.status(500).json({
      message: "Error obteniendo la bitácora.",
    });
  }
};

/*
 * ============================================================
 * DESHACER UNA ACCIÓN
 * ============================================================
 *
 * Solo ADM-001 puede ejecutar esta operación.
 *
 * Regla de seguridad importante:
 * - Si nadie modificó nuevamente el registro después de la acción,
 *   restauramos exactamente el estado anterior.
 * - Si hubo una acción posterior sobre la misma asistencia, NO
 *   sobrescribimos ese cambio. La acción de auditoría se marca como
 *   deshecha, pero el estado actual queda intacto para no interferir.
 */
const undoAuditLog = async (req, res) => {
  try {
    const admin = req.user || req.admin;

    if (!admin) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    if (!canManageGlobal(admin)) {
      return res.status(403).json({
        message: "Solo el Administrador Principal puede deshacer acciones.",
      });
    }

    const log = await AuditLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({ message: "Registro de bitácora no encontrado." });
    }

    const isLegacyAttendanceLog =
      log.module === "attendance" &&
      Boolean(log.metadata?.attendanceId || log.targetId);

    if (!log.reversible && !isLegacyAttendanceLog) {
      return res.status(400).json({
        message: "Esta acción no tiene una reversión segura disponible.",
      });
    }

    if (log.undone) {
      return res.status(400).json({
        message: "Esta acción ya fue deshecha.",
      });
    }

    const metadata = log.metadata || {};

    if (log.module !== "attendance") {
      return res.status(400).json({
        message: "Esta operación todavía no tiene una reversión segura implementada.",
      });
    }

    const attendanceId = metadata.attendanceId || log.targetId;
    const attendance = attendanceId
      ? await Attendance.findById(attendanceId)
      : null;

    const expectedUpdatedAt = metadata.afterUpdatedAt
      ? new Date(metadata.afterUpdatedAt)
      : null;

    /*
     * Detectamos cambios posteriores. Esto permite deshacer una acción
     * antigua sin borrar/alterar una acción que ocurrió después.
     */
    const changedAfterThisAction =
      attendance &&
      expectedUpdatedAt &&
      Number.isFinite(expectedUpdatedAt.getTime()) &&
      attendance.updatedAt &&
      attendance.updatedAt.getTime() !== expectedUpdatedAt.getTime();

    if (changedAfterThisAction) {
      log.undone = true;
      log.undoneAt = new Date();
      log.undoneBy = admin.adminId || admin.name || "ADM-001";
      log.undoMessage =
        "La acción fue retirada de la Bitácora sin modificar el estado actual porque hubo cambios posteriores.";
      await log.save();

      return res.json({
        message:
          "La acción fue deshecha en la Bitácora, pero el estado actual se conservó porque hubo cambios posteriores.",
        changedLater: true,
        log,
      });
    }

    const wasCreated = Boolean(metadata.wasCreated) || log.action === "CREATE_ATTENDANCE";

    /*
     * Logs antiguos no guardaban afterUpdatedAt. Para ellos aplicamos
     * una protección equivalente: solo restauramos si el estado actual
     * sigue siendo exactamente el estado producido por aquella acción.
     */
    if (attendance && !expectedUpdatedAt) {
      const expectedStatus = metadata.newStatus || "";
      const currentStatus = String(attendance.status || "").trim();

      if (expectedStatus && currentStatus !== expectedStatus) {
        log.undone = true;
        log.undoneAt = new Date();
        log.undoneBy = admin.adminId || admin.name || "ADM-001";
        log.undoMessage =
          "La acción fue retirada de la Bitácora sin modificar el estado actual porque hubo cambios posteriores.";
        await log.save();

        return res.json({
          message:
            "La acción fue deshecha en la Bitácora, pero el estado actual se conservó porque hubo cambios posteriores.",
          changedLater: true,
          log,
        });
      }
    }

    if (wasCreated) {
      if (attendance) {
        await Attendance.deleteOne({ _id: attendance._id });
      }
    } else {
      if (!attendance) {
        return res.status(409).json({
          message:
            "No se puede revertir: el registro de asistencia ya no existe.",
        });
      }

      const previous = metadata.previousAttendance || {};

      if (Object.keys(previous).length === 0 && metadata.previousStatus !== undefined) {
        attendance.status = metadata.previousStatus || "No asistió";
      }

      if (Object.prototype.hasOwnProperty.call(previous, "status")) {
        attendance.status = previous.status || "No asistió";
      }
      if (Object.prototype.hasOwnProperty.call(previous, "note")) {
        attendance.note = previous.note || "";
      }
      if (Object.prototype.hasOwnProperty.call(previous, "notes")) {
        attendance.notes = previous.notes || "";
      }
      if (Object.prototype.hasOwnProperty.call(previous, "justificationReason")) {
        attendance.justificationReason = previous.justificationReason || "";
      }
      if (Object.prototype.hasOwnProperty.call(previous, "justifiedBy")) {
        attendance.justifiedBy = previous.justifiedBy || "";
      }
      if (Object.prototype.hasOwnProperty.call(previous, "justifiedAt")) {
        attendance.justifiedAt = previous.justifiedAt || null;
      }
      if (Object.prototype.hasOwnProperty.call(previous, "attendedAt")) {
        attendance.attendedAt = previous.attendedAt || null;
      }
      if (Object.prototype.hasOwnProperty.call(previous, "registeredBy")) {
        attendance.registeredBy = previous.registeredBy || "";
      }
      if (Object.prototype.hasOwnProperty.call(previous, "source")) {
        attendance.source = previous.source || "ADMIN";
      }
      if (Object.prototype.hasOwnProperty.call(previous, "attendanceMode")) {
        attendance.attendanceMode = previous.attendanceMode || "MANUAL";
      }
      if (Object.prototype.hasOwnProperty.call(previous, "registeredAt")) {
        attendance.registeredAt = previous.registeredAt || attendance.registeredAt;
      }

      await attendance.save();
    }

    /*
     * Mantener el arreglo attendees sincronizado con el estado restaurado.
     */
    const meetingId = metadata.meetingId;
    const meeting = meetingId ? await Meeting.findById(meetingId) : null;

    if (meeting && log.module === "attendance") {
      if (!Array.isArray(meeting.attendees)) {
        meeting.attendees = [];
      }

      const restoredStatus = wasCreated
        ? "No asistió"
        : attendance?.status || "No asistió";

      const attendeeIndex = meeting.attendees.indexOf(
        metadata.memberDoc || metadata.doc || ""
      );

      const isAttended =
        restoredStatus === "Asistió" ||
        restoredStatus === "Clase Presencial";

      if (isAttended && attendeeIndex === -1) {
        meeting.attendees.push(metadata.memberDoc || metadata.doc);
      }

      if (!isAttended && attendeeIndex !== -1) {
        meeting.attendees.splice(attendeeIndex, 1);
      }

      await meeting.save();
    }

    log.undone = true;
    log.undoneAt = new Date();
    log.undoneBy = admin.adminId || admin.name || "ADM-001";
    log.undoMessage = wasCreated
      ? "Se eliminó el registro de asistencia creado por esta acción."
      : `Se restauró el estado anterior: ${metadata.previousStatus || "Sin registro"}.`;

    await log.save();

    return res.json({
      message: "Acción deshecha correctamente.",
      changedLater: false,
      log,
    });
  } catch (error) {
    console.error("Error deshaciendo acción de bitácora:", error);
    return res.status(500).json({
      message: "No se pudo deshacer la acción.",
    });
  }
};

module.exports = {
  getAuditLogs,
  undoAuditLog,
};
