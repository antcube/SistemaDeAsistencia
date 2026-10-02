    const AuditLog = require("../models/AuditLog");
    const Attendance = require("../models/Attendance");
    const Meeting = require("../models/Meeting");
    const User = require("../models/User");
    const Admin = require("../models/Admin");

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

        // Todas las acciones de Bitácora muestran la opción Deshacer.
        // La API valida después si existen datos suficientes para restaurarlas.
        logs = logs.map((log) => {
          if (!log.undone) log.reversible = true;
          return log;
        });

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

        /*
         * ============================================================
         * DESHACER UN PROCESAMIENTO COMPLETO DE ZOOM
         * ============================================================
         *
         * El procesamiento se guarda como un único lote.
         * Cada asistencia conserva su estado anterior y la marca de
         * actualización producida por Zoom. Si alguien modificó esa
         * asistencia después, no la sobrescribimos.
         */
        if (log.module === "zoom") {
          const attendanceChanges =
            Array.isArray(metadata.attendanceChanges)
              ? metadata.attendanceChanges
              : [];

          const meetingChanges =
            Array.isArray(metadata.meetingChanges)
              ? metadata.meetingChanges
              : [];

          let restoredAttendances = 0;
          let removedCreatedAttendances = 0;
          let preservedLaterChanges = 0;
          let restoredMeetings = 0;
          let preservedLaterMeetings = 0;

          const syncMeetingAttendee = async (
            meetingId,
            memberDoc,
            status
          ) => {
            if (!meetingId || !memberDoc) return;

            const meeting =
              await Meeting.findById(
                meetingId
              );

            if (!meeting) return;

            if (
              !Array.isArray(
                meeting.attendees
              )
            ) {
              meeting.attendees = [];
            }

            const index =
              meeting.attendees.indexOf(
                memberDoc
              );

            const isAttended =
              status === "Asistió" ||
              status === "Clase Presencial";

            if (
              isAttended &&
              index === -1
            ) {
              meeting.attendees.push(
                memberDoc
              );
            }

            if (
              !isAttended &&
              index !== -1
            ) {
              meeting.attendees.splice(
                index,
                1
              );
            }

            await meeting.save();
          };

          for (
            const change of attendanceChanges
          ) {
            const attendance =
              change.attendanceId
                ? await Attendance.findById(
                    change.attendanceId
                  )
                : null;

            if (!attendance) {
              continue;
            }

            const expectedUpdatedAt =
              change.afterUpdatedAt
                ? new Date(
                    change.afterUpdatedAt
                  )
                : null;

            const changedAfterZoom =
              expectedUpdatedAt &&
              Number.isFinite(
                expectedUpdatedAt.getTime()
              ) &&
              attendance.updatedAt &&
              attendance.updatedAt.getTime() !==
                expectedUpdatedAt.getTime();

            if (
              changedAfterZoom
            ) {
              preservedLaterChanges++;
              continue;
            }

            if (
              change.wasCreated
            ) {
              attendance.active =
                false;
              attendance.deletedAt =
                new Date();
              attendance.deletedBy =
                admin.adminId ||
                admin.name ||
                "ADM-001";

              await attendance.save();

              removedCreatedAttendances++;
              continue;
            }

            const previous =
              change.previousAttendance ||
              {};

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "active"
              )
            ) {
              attendance.active =
                previous.active;
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "deletedAt"
              )
            ) {
              attendance.deletedAt =
                previous.deletedAt;
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "deletedBy"
              )
            ) {
              attendance.deletedBy =
                previous.deletedBy;
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "doc"
              )
            ) {
              attendance.doc =
                previous.doc || "";
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "name"
              )
            ) {
              attendance.name =
                previous.name || "";
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "circle"
              )
            ) {
              attendance.circle =
                previous.circle || "";
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "status"
              )
            ) {
              attendance.status =
                previous.status ||
                "No asistió";
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "justificationReason"
              )
            ) {
              attendance.justificationReason =
                previous.justificationReason ||
                "";
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "justifiedBy"
              )
            ) {
              attendance.justifiedBy =
                previous.justifiedBy ||
                "";
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "justifiedAt"
              )
            ) {
              attendance.justifiedAt =
                previous.justifiedAt ||
                null;
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "registeredBy"
              )
            ) {
              attendance.registeredBy =
                previous.registeredBy ||
                "";
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "source"
              )
            ) {
              attendance.source =
                previous.source ||
                "ADMIN";
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "attendanceMode"
              )
            ) {
              attendance.attendanceMode =
                previous.attendanceMode ||
                "MANUAL";
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "attendedAt"
              )
            ) {
              attendance.attendedAt =
                previous.attendedAt ||
                null;
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "registeredAt"
              )
            ) {
              attendance.registeredAt =
                previous.registeredAt ||
                attendance.registeredAt;
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "note"
              )
            ) {
              attendance.note =
                previous.note || "";
            }

            if (
              Object.prototype.hasOwnProperty.call(
                previous,
                "notes"
              )
            ) {
              attendance.notes =
                previous.notes || "";
            }

            await attendance.save();

            await syncMeetingAttendee(
              change.meetingId,
              change.memberDoc,
              attendance.status
            );

            restoredAttendances++;
          }

          /*
           * Restaurar las reuniones creadas por este procesamiento.
           * Solo se desactiva una reunión nueva si nadie la modificó
           * después del procesamiento.
           */
          for (
            const change of meetingChanges
          ) {
            if (!change.meetingId) {
              continue;
            }

            const meeting =
              await Meeting.findById(
                change.meetingId
              );

            if (!meeting) {
              continue;
            }

            const expectedUpdatedAt =
              change.afterUpdatedAt
                ? new Date(
                    change.afterUpdatedAt
                  )
                : null;

            const changedAfterZoom =
              expectedUpdatedAt &&
              Number.isFinite(
                expectedUpdatedAt.getTime()
              ) &&
              meeting.updatedAt &&
              meeting.updatedAt.getTime() !==
                expectedUpdatedAt.getTime();

            if (
              changedAfterZoom
            ) {
              preservedLaterMeetings++;
              continue;
            }

            if (
              change.wasCreated
            ) {
              meeting.active =
                false;
              meeting.deletedAt =
                new Date();
              meeting.deletedBy =
                admin.adminId ||
                admin.name ||
                "ADM-001";

              await meeting.save();
              restoredMeetings++;
              continue;
            }

            if (
              Array.isArray(
                change.previousAttendees
              )
            ) {
              meeting.attendees =
                [
                  ...change.previousAttendees,
                ];

              await meeting.save();
            }
          }

          log.undone = true;
          log.undoneAt = new Date();
          log.undoneBy =
            admin.adminId ||
            admin.name ||
            "ADM-001";

          if (
            preservedLaterChanges ||
            preservedLaterMeetings
          ) {
            log.undoMessage =
              `Se deshizo el procesamiento de Zoom sin sobrescribir ${preservedLaterChanges} asistencia(s) y ${preservedLaterMeetings} reunión(es) que tuvieron cambios posteriores.`;
          } else {
            log.undoMessage =
              `Se restauró el estado anterior al procesamiento de Zoom. Asistencias restauradas: ${restoredAttendances}. Registros creados por Zoom retirados: ${removedCreatedAttendances}. Reuniones creadas por Zoom retiradas: ${restoredMeetings}.`;
          }

          await log.save();

          return res.json({
            message:
              "Procesamiento de Zoom deshecho correctamente.",
            changedLater:
              Boolean(
                preservedLaterChanges ||
                  preservedLaterMeetings
              ),
            restoredAttendances,
            removedCreatedAttendances,
            restoredMeetings,
            preservedLaterChanges,
            preservedLaterMeetings,
            log,
          });
        }

        // ============================================================
        // DESHACER MIEMBROS
        // ============================================================
        if (String(log.module || "").toLowerCase() === "members") {
          const action = String(log.action || "").trim().toUpperCase();
          const metadata = log.metadata || {};

          const normalizeMemberSnapshot = (value) => ({
            doc: value?.doc || "",
            name: value?.name || "",
            username: value?.username || "",
            circle: value?.circle || "",
            job: value?.job || "",
            rangeChangeDate: value?.rangeChangeDate || null,
            rangeHistory: Array.isArray(value?.rangeHistory) ? value.rangeHistory : [],
            email: value?.email || "",
            phone: value?.phone || "",
          });

          const sameMemberState = (user, snapshot) => {
            const expected = normalizeMemberSnapshot(snapshot);
            const actual = normalizeMemberSnapshot(user);
            return JSON.stringify(actual) === JSON.stringify(expected);
          };

          const restoreMember = async (snapshot) => {
            if (!snapshot) return null;
            const data = normalizeMemberSnapshot(snapshot);
            const userId = snapshot.userId || snapshot._id || null;
            if (userId) {
              const existing = await User.findById(userId);
              if (existing) return existing;
              try {
                return await User.create({
                  _id: userId,
                  ...data,
                });
              } catch (_) {
                return await User.create(data);
              }
            }
            return await User.create(data);
          };

          let changedLater = 0;
          let restored = 0;
          let removed = 0;

          if (action === "IMPORTÓ MIEMBROS" || action === "IMPORTO MIEMBROS") {
            const changes = Array.isArray(metadata.changes) ? metadata.changes : [];
            if (!changes.length) {
              return res.status(409).json({
                message: "Este registro de importación fue creado antes de guardar los estados necesarios para deshacerlo.",
              });
            }

            for (const change of changes) {
              const user = change.userId ? await User.findById(change.userId) : null;

              if (change.wasCreated) {
                if (!user) continue;
                const expected = normalizeMemberSnapshot(change.current);
                if (!sameMemberState(user, expected)) {
                  changedLater++;
                  continue;
                }
                await User.findByIdAndDelete(user._id);
                removed++;
                continue;
              }

              if (!user) {
                changedLater++;
                continue;
              }

              if (!sameMemberState(user, change.current)) {
                changedLater++;
                continue;
              }

              const previous = normalizeMemberSnapshot(change.previous);
              user.doc = previous.doc;
              user.name = previous.name;
              user.username = previous.username;
              user.circle = previous.circle;
              user.job = previous.job;
              user.rangeChangeDate = previous.rangeChangeDate;
              user.rangeHistory = previous.rangeHistory;
              user.email = previous.email;
              user.phone = previous.phone;
              await user.save();
              restored++;
            }
          } else if (action === "CREATE_MEMBER") {
            const user = await User.findById(metadata.userId || log.targetId);
            if (user) {
              if (!sameMemberState(user, metadata)) {
                changedLater = 1;
              } else {
                await User.findByIdAndDelete(user._id);
                removed = 1;
              }
            }
          } else if (action === "UPDATE_MEMBER") {
            const user = await User.findById(metadata.userId || log.targetId);
            if (user) {
              if (!sameMemberState(user, metadata.current)) {
                changedLater = 1;
              } else {
                const previous = normalizeMemberSnapshot(metadata.previous);
                user.doc = previous.doc;
                user.name = previous.name;
                user.username = previous.username;
                user.circle = previous.circle;
                user.job = previous.job;
                user.rangeChangeDate = previous.rangeChangeDate;
                user.rangeHistory = previous.rangeHistory;
                user.email = previous.email;
                user.phone = previous.phone;
                await user.save();
                restored = 1;
              }
            }
          } else if (action === "DELETE_MEMBER") {
            const snapshot = {
              userId: metadata.userId || log.targetId,
              ...metadata,
            };
            const existing = metadata.doc
              ? await User.findOne({ doc: metadata.doc })
              : null;
            if (existing) {
              changedLater = 1;
            } else {
              await restoreMember(snapshot);
              restored = 1;
            }
          } else if (action === "DELETE_CIRCLE_MEMBERS") {
            const snapshots = Array.isArray(metadata.members) ? metadata.members : [];
            for (const snapshot of snapshots) {
              const existing = snapshot.doc
                ? await User.findOne({ doc: snapshot.doc })
                : null;
              if (existing) {
                changedLater++;
                continue;
              }
              await restoreMember(snapshot);
              restored++;
            }
          } else {
            return res.status(400).json({
              message: "Esta acción de miembros no contiene una reversión compatible.",
            });
          }

          log.undone = true;
          log.undoneAt = new Date();
          log.undoneBy = admin.adminId || admin.name || "ADM-001";
          log.undoMessage = changedLater
            ? `Se deshizo la acción sin sobrescribir ${changedLater} registro(s) que tuvieron cambios posteriores.`
            : `Se restauró el estado anterior. Registros restaurados: ${restored}. Registros retirados: ${removed}.`;
          await log.save();

          return res.json({
            message: "Cambio de miembros deshecho correctamente.",
            changedLater: Boolean(changedLater),
            restored,
            removed,
            log,
          });
        }

        // ============================================================
        // DESHACER ADMINISTRADORES
        // ============================================================
        if (String(log.module || "").toLowerCase() === "admins") {
          const action = String(log.action || "").trim().toUpperCase();
          const metadata = log.metadata || {};
          const adminId = metadata.adminId || log.targetId;
          const target = await Admin.findById(adminId);

          if (action === "CREATE_ADMIN") {
            if (!target) {
              log.undone = true;
              log.undoneAt = new Date();
              log.undoneBy = admin.adminId || admin.name || "ADM-001";
              log.undoMessage = "El administrador ya no existía; la acción quedó deshecha.";
              await log.save();
              return res.json({ message: "Acción deshecha.", changedLater: false, log });
            }

            if (target.adminId === "ADM-001") {
              return res.status(409).json({ message: "ADM-001 no puede deshacerse." });
            }

            await Admin.findByIdAndDelete(target._id);
            log.undone = true;
            log.undoneAt = new Date();
            log.undoneBy = admin.adminId || admin.name || "ADM-001";
            log.undoMessage = "Se eliminó el administrador creado por esta acción.";
            await log.save();
            return res.json({ message: "Administrador restaurado al estado anterior.", changedLater: false, log });
          }

          if (action === "UPDATE_ADMIN") {
            if (!target) {
              return res.status(409).json({ message: "No se puede revertir: el administrador ya no existe." });
            }
            const current = metadata.current || {};
            const currentComparable = {
              adminId: target.adminId,
              phone: target.phone,
              name: target.name,
              email: target.email,
              role: target.role,
              circleScope: target.circleScope,
              active: target.active,
            };
            if (JSON.stringify(currentComparable) !== JSON.stringify(current)) {
              log.undone = true;
              log.undoneAt = new Date();
              log.undoneBy = admin.adminId || admin.name || "ADM-001";
              log.undoMessage = "La acción se retiró de la Bitácora sin sobrescribir cambios posteriores del administrador.";
              await log.save();
              return res.json({ message: log.undoMessage, changedLater: true, log });
            }

            const previous = metadata.previous || {};
            target.adminId = previous.adminId || target.adminId;
            target.phone = previous.phone || "";
            target.name = previous.name || target.name;
            target.email = previous.email || target.email;
            target.role = previous.role || target.role;
            target.circleScope = Array.isArray(previous.circleScope) ? previous.circleScope : [];
            target.active = previous.active !== undefined ? previous.active : target.active;
            await target.save();

            log.undone = true;
            log.undoneAt = new Date();
            log.undoneBy = admin.adminId || admin.name || "ADM-001";
            log.undoMessage = "Se restauró el estado anterior del administrador. Si la contraseña cambió, se conservó la contraseña actual por seguridad.";
            await log.save();
            return res.json({ message: "Administrador restaurado.", changedLater: false, log });
          }

          if (action === "DEACTIVATE_ADMIN") {
            if (!target) {
              return res.status(409).json({ message: "No se puede revertir: el administrador ya no existe." });
            }
            if (target.adminId === "ADM-001") {
              return res.status(409).json({ message: "ADM-001 no puede deshacerse." });
            }
            if (target.active !== false) {
              return res.status(409).json({ message: "El administrador ya fue modificado después de esta acción." });
            }
            target.active = true;
            await target.save();
            log.undone = true;
            log.undoneAt = new Date();
            log.undoneBy = admin.adminId || admin.name || "ADM-001";
            log.undoMessage = "Se restauró el administrador a activo.";
            await log.save();
            return res.json({ message: "Administrador reactivado.", changedLater: false, log });
          }

          return res.status(400).json({
            message: "Esta acción administrativa no contiene una reversión compatible.",
          });
        }

        if (log.module !== "attendance") {
          return res.status(400).json({
            message: "Esta acción aparece como reversible, pero no contiene datos suficientes para restaurar su estado.",
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
            attendance.active = false;
            attendance.deletedAt = new Date();
            attendance.deletedBy = admin.adminId || admin.name || "ADM-001";
            await attendance.save();
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
