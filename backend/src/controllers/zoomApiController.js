const User = require("../models/User");
const Circle = require("../models/Circle");
const Meeting = require("../models/Meeting");
const Attendance = require("../models/Attendance");

const {
  canManageGlobal,
  canManageCircle,
  getCircleScope,
} = require("../middleware/permissionMiddleware");

const { createAuditLog } = require("../services/auditService");
const { buildEffectiveCircleMap } = require("../services/memberCircleHistoryService");
const {
  getConfiguredMeetings,
  getSessionTypeByMeetingId,
  normalizeMeetingId,
} = require("../services/zoomMeetingConfig");
const {
  listPastInstances,
  listParticipantsForInstance,
} = require("../services/zoomApiService");

const MINIMUM_MINUTES = 10;
const DEFAULT_TIMEZONE = process.env.ZOOM_TIMEZONE || "America/Lima";

const SESSION_DEFAULTS = {
  HEALTH: { title: "HEALTH", time: "19:00", endTime: "20:00" },
  MASTERCLASS: { title: "MASTERCLASS", time: "19:00", endTime: "20:00" },
  MENTORIA: { title: "MENTORIA", time: "20:00", endTime: "21:00" },
  "ANUNCIOS CORPORATIVOS": {
    title: "ANUNCIOS CORPORATIVOS",
    time: "19:00",
    endTime: "20:00",
  },
};

const cleanEmail = (value) => String(value || "").trim().toLowerCase();

const normalizeType = (value) => {
  const type = String(value || "").trim().toUpperCase();
  if (type === "MENTORÍA") return "MENTORIA";
  return type;
};

const dateInTimezone = (value, timeZone = DEFAULT_TIMEZONE) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const getAllowedCircleNames = async (req) => {
  const activeCircles = await Circle.find({ active: true }).sort({ name: 1 }).lean();

  if (canManageGlobal(req.user)) {
    return activeCircles.map((circle) => String(circle.name || "").trim()).filter(Boolean);
  }

  const scope = getCircleScope(req.user);
  const allowed = new Set(scope.map((circle) => String(circle || "").trim().toUpperCase()));

  return activeCircles
    .filter((circle) => allowed.has(String(circle.name || "").trim().toUpperCase()))
    .map((circle) => String(circle.name || "").trim())
    .filter(Boolean);
};

const ensureCanProcess = async (req) => {
  if (canManageGlobal(req.user)) return;

  const scope = getCircleScope(req.user);
  if (!scope.length || !scope.some((circle) => canManageCircle(req.user, circle))) {
    const error = new Error("Tu usuario no tiene permisos para procesar asistencia de Zoom.");
    error.status = 403;
    throw error;
  }
};

const assertValidDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    const error = new Error("Indica la fecha en formato YYYY-MM-DD.");
    error.status = 400;
    throw error;
  }
};

const loadZoomDay = async ({ meetingId, date }) => {
  const configured = getSessionTypeByMeetingId(meetingId);

  if (!configured) {
    const error = new Error(
      "Ese Meeting ID no está configurado para HEALTH, MASTERCLASS, MENTORIA o ANUNCIOS CORPORATIVOS."
    );
    error.status = 400;
    throw error;
  }

  assertValidDate(date);

  const instances = await listPastInstances(configured.meetingId);
  const dayInstances = instances.filter(
    (instance) => dateInTimezone(instance.start_time) === date
  );

  const allRows = [];

  for (const instance of dayInstances) {
    const participants = await listParticipantsForInstance(instance.uuid);

    participants.forEach((participant) => {
      allRows.push({
        ...participant,
        instanceUuid: instance.uuid,
        instanceStartTime: instance.start_time,
      });
    });
  }

  const byEmail = new Map();
  let rowsWithoutEmail = 0;

  for (const row of allRows) {
    const email = cleanEmail(row.user_email || row.email);

    if (!email) {
      rowsWithoutEmail += 1;
      continue;
    }

    const current = byEmail.get(email) || {
      email,
      zoomNames: new Set(),
      entries: 0,
      seconds: 0,
      instanceUuids: new Set(),
    };

    if (row.name || row.user_name) {
      current.zoomNames.add(String(row.name || row.user_name).trim());
    }

    current.entries += 1;
    current.seconds += Math.max(0, Number(row.duration || 0));
    current.instanceUuids.add(String(row.instanceUuid || ""));
    byEmail.set(email, current);
  }

  const aggregated = [...byEmail.values()].map((item) => ({
    email: item.email,
    zoomName: [...item.zoomNames].filter(Boolean).join(" / "),
    entries: item.entries,
    totalSeconds: item.seconds,
    totalMinutes: Number((item.seconds / 60).toFixed(2)),
    instanceCount: item.instanceUuids.size,
    qualifies: item.seconds >= MINIMUM_MINUTES * 60,
  }));

  return {
    meetingId: configured.meetingId,
    sessionType: configured.type,
    date,
    timezone: DEFAULT_TIMEZONE,
    instances: dayInstances,
    allRows,
    aggregated,
    rowsWithoutEmail,
  };
};

const enrichWithDirectory = async ({ req, zoomDay }) => {
  const allowedCircles = await getAllowedCircleNames(req);

  if (!allowedCircles.length) {
    const error = new Error("No tienes círculos disponibles para procesar Zoom.");
    error.status = 403;
    throw error;
  }

  const allMembers = await User.find({}).sort({ name: 1 }).lean();
  const [year, month] = zoomDay.date.split("-").map(Number);
  const circleMap = await buildEffectiveCircleMap({
    users: allMembers,
    year,
    month,
  });

  const allowedSet = new Set(allowedCircles.map((circle) => circle.toUpperCase()));
  const members = allMembers
    .map((member) => ({
      ...member,
      effectiveCircle: String(circleMap.get(String(member._id)) || member.circle || "").trim(),
    }))
    .filter((member) => allowedSet.has(member.effectiveCircle.toUpperCase()));

  const membersByEmail = new Map();
  for (const member of members) {
    const email = cleanEmail(member.email);
    if (email && !membersByEmail.has(email)) {
      membersByEmail.set(email, member);
    }
  }

  const results = zoomDay.aggregated.map((item) => {
    const member = membersByEmail.get(item.email);

    return {
      ...item,
      matched: Boolean(member),
      memberId: member?._id || null,
      dni: member?.doc || "",
      name: member?.name || "",
      circle: member?.effectiveCircle || "",
      willApply: Boolean(member && item.qualifies),
    };
  });

  return {
    allowedCircles,
    members,
    results,
  };
};

const getCalendarCoverage = async ({ sessionType, date, allowedCircles }) => {
  const meetings = await Meeting.find({
    active: true,
    type: sessionType,
    date,
    circle: { $in: allowedCircles },
  })
    .sort({ circle: 1, createdAt: 1 })
    .lean();

  const byCircle = new Map();
  for (const meeting of meetings) {
    const key = String(meeting.circle || "").trim().toUpperCase();
    if (key && !byCircle.has(key)) byCircle.set(key, meeting);
  }

  const missingCircles = allowedCircles.filter(
    (circle) => !byCircle.has(String(circle || "").trim().toUpperCase())
  );

  return {
    meetings,
    byCircle,
    missingCircles,
    complete: missingCircles.length === 0,
  };
};

const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));

const createMissingMeetings = async ({
  req,
  zoomDay,
  selectedType,
  allowedCircles,
  startTime,
  endTime,
}) => {
  if (!canManageGlobal(req.user)) {
    const error = new Error(
      "Solo el Administrador Principal puede crear reuniones faltantes desde la detección de Zoom."
    );
    error.status = 403;
    throw error;
  }

  const normalizedSelectedType = normalizeType(selectedType);
  const recognizedType = normalizeType(zoomDay.sessionType);

  if (!SESSION_DEFAULTS[normalizedSelectedType]) {
    const error = new Error("Selecciona un tipo de reunión válido.");
    error.status = 400;
    throw error;
  }

  // El Meeting ID sigue siendo la fuente de verdad de la categoría.
  if (normalizedSelectedType !== recognizedType) {
    const error = new Error(
      `Ese Meeting ID está configurado como ${recognizedType}. Para evitar cruces de asistencia, selecciona ${recognizedType}.`
    );
    error.status = 400;
    throw error;
  }

  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    const error = new Error("Indica una hora de inicio y una hora de fin válidas.");
    error.status = 400;
    throw error;
  }

  if (String(endTime) <= String(startTime)) {
    const error = new Error("La hora de fin debe ser posterior a la hora de inicio.");
    error.status = 400;
    throw error;
  }

  const coverage = await getCalendarCoverage({
    sessionType: normalizedSelectedType,
    date: zoomDay.date,
    allowedCircles,
  });

  const defaults = SESSION_DEFAULTS[normalizedSelectedType];
  const created = [];

  for (const circle of coverage.missingCircles) {
    const meeting = await Meeting.create({
      title: defaults.title,
      type: normalizedSelectedType,
      circle,
      host: "Sistema",
      date: zoomDay.date,
      time: startTime,
      endTime,
      location: "Zoom",
      active: true,
      createdBy: req.user?.adminId || req.user?.name || "ZOOM API",
      attendees: [],
    });

    created.push(meeting);
  }

  return created;
};

const getMeetingMap = async ({ sessionType, date, allowedCircles }) => {
  const meetings = await Meeting.find({
    active: true,
    type: sessionType,
    date,
    circle: { $in: allowedCircles },
  }).sort({ createdAt: 1 });

  const map = new Map();
  for (const meeting of meetings) {
    const key = String(meeting.circle || "").trim().toUpperCase();
    if (key && !map.has(key)) map.set(key, meeting);
  }
  return map;
};

const applyAttendance = async ({ req, zoomDay, directory }) => {
  const applied = [];
  const alreadyPresent = [];
  const meetingMap = await getMeetingMap({
    sessionType: zoomDay.sessionType,
    date: zoomDay.date,
    allowedCircles: directory.allowedCircles,
  });

  const memberMap = new Map(directory.members.map((member) => [String(member._id), member]));

  for (const item of directory.results) {
    if (!item.willApply) continue;

    const member = memberMap.get(String(item.memberId));
    if (!member) continue;

    if (!canManageGlobal(req.user) && !canManageCircle(req.user, member.effectiveCircle)) {
      continue;
    }

    const meeting = meetingMap.get(member.effectiveCircle.toUpperCase());
    if (!meeting) continue;

    let attendance = await Attendance.findOne({
      meeting: meeting._id,
      user: member._id,
    });

    if (
      attendance &&
      attendance.active !== false &&
      ["Asistió", "Clase Presencial"].includes(attendance.status)
    ) {
      alreadyPresent.push({
        dni: member.doc || "",
        name: member.name || "",
        email: item.email,
        circle: member.effectiveCircle,
        totalMinutes: item.totalMinutes,
        status: attendance.status,
      });
      continue;
    }

    if (!attendance) {
      attendance = new Attendance({
        meeting: meeting._id,
        user: member._id,
      });
    }

    attendance.active = true;
    attendance.deletedAt = null;
    attendance.deletedBy = "";
    attendance.doc = member.doc || "";
    attendance.name = member.name || "";
    attendance.circle = member.effectiveCircle || "";
    attendance.status = "Asistió";
    attendance.justificationReason = "";
    attendance.justifiedBy = "";
    attendance.justifiedAt = null;
    attendance.registeredBy = "ZOOM API";
    attendance.source = "SYSTEM";
    attendance.attendanceMode = "MANUAL";
    attendance.attendedAt = attendance.attendedAt || new Date();
    attendance.registeredAt = new Date();
    attendance.note = `Zoom API: ${item.totalMinutes} min acumulados en ${item.instanceCount} instancia(s).`;
    attendance.notes = attendance.note;

    await attendance.save();

    if (!Array.isArray(meeting.attendees)) meeting.attendees = [];
    if (member.doc && !meeting.attendees.includes(member.doc)) {
      meeting.attendees.push(member.doc);
      await meeting.save();
    }

    applied.push({
      dni: member.doc || "",
      name: member.name || "",
      email: item.email,
      circle: member.effectiveCircle,
      totalMinutes: item.totalMinutes,
      instanceCount: item.instanceCount,
      status: "Asistió",
      meetingId: meeting._id,
    });
  }

  return { applied, alreadyPresent };
};

const finalizeAbsences = async ({ req, zoomDay, directory }) => {
  const meetingMap = await getMeetingMap({
    sessionType: zoomDay.sessionType,
    date: zoomDay.date,
    allowedCircles: directory.allowedCircles,
  });

  const absent = [];
  const preserved = [];

  for (const member of directory.members) {
    if (!canManageGlobal(req.user) && !canManageCircle(req.user, member.effectiveCircle)) {
      continue;
    }

    const meeting = meetingMap.get(member.effectiveCircle.toUpperCase());
    if (!meeting) continue;

    let attendance = await Attendance.findOne({
      meeting: meeting._id,
      user: member._id,
    });

    if (
      attendance &&
      attendance.active !== false &&
      ["Asistió", "Clase Presencial", "Justificado"].includes(attendance.status)
    ) {
      preserved.push({
        dni: member.doc || "",
        name: member.name || "",
        circle: member.effectiveCircle,
        status: attendance.status,
      });
      continue;
    }

    if (!attendance) {
      attendance = new Attendance({
        meeting: meeting._id,
        user: member._id,
      });
    }

    attendance.active = true;
    attendance.deletedAt = null;
    attendance.deletedBy = "";
    attendance.doc = member.doc || "";
    attendance.name = member.name || "";
    attendance.circle = member.effectiveCircle || "";
    attendance.status = "No asistió";
    attendance.registeredBy = "ZOOM API";
    attendance.source = "SYSTEM";
    attendance.attendanceMode = "MANUAL";
    attendance.registeredAt = new Date();
    attendance.note = "Zoom API: sesión finalizada sin alcanzar 10 minutos acumulados.";
    attendance.notes = attendance.note;

    await attendance.save();

    absent.push({
      dni: member.doc || "",
      name: member.name || "",
      email: cleanEmail(member.email),
      circle: member.effectiveCircle,
      status: "No asistió",
    });
  }

  return { absent, preserved };
};

const buildCommonResponse = ({ zoomDay, directory, coverage }) => ({
  meetingId: zoomDay.meetingId,
  sessionType: zoomDay.sessionType,
  date: zoomDay.date,
  timezone: zoomDay.timezone,
  instances: zoomDay.instances.length,
  records: zoomDay.allRows.length,
  emails: zoomDay.aggregated.length,
  rowsWithoutEmail: zoomDay.rowsWithoutEmail,
  matched: directory.results.filter((item) => item.matched).length,
  qualified: directory.results.filter((item) => item.willApply).length,
  minimumMinutes: MINIMUM_MINUTES,
  linkRequired: !coverage.complete,
  missingCircles: coverage.missingCircles,
});

const getConfig = async (req, res) => {
  const meetings = getConfiguredMeetings().map((item) => ({
    type: item.type,
    configured: true,
    // El Meeting ID no es una credencial secreta y el frontend lo necesita
    // completo para ofrecerlo en el selector de reuniones configuradas.
    meetingId: item.meetingId,
  }));

  return res.json({
    minimumMinutes: MINIMUM_MINUTES,
    timezone: DEFAULT_TIMEZONE,
    meetings,
  });
};

const preview = async (req, res) => {
  try {
    await ensureCanProcess(req);

    const meetingId = normalizeMeetingId(req.body?.meetingId);
    const date = String(req.body?.date || "").trim();
    const zoomDay = await loadZoomDay({ meetingId, date });
    const directory = await enrichWithDirectory({ req, zoomDay });
    const coverage = await getCalendarCoverage({
      sessionType: zoomDay.sessionType,
      date: zoomDay.date,
      allowedCircles: directory.allowedCircles,
    });

    return res.json({
      success: true,
      mode: "preview",
      ...buildCommonResponse({ zoomDay, directory, coverage }),
      message: coverage.complete
        ? "La reunión está vinculada al Calendario. Puedes sincronizar asistencias."
        : "Zoom encontró la sesión, pero faltan reuniones de Calendario para uno o más círculos. Debes vincularla antes de aplicar asistencia.",
      results: directory.results,
    });
  } catch (error) {
    console.error("[Zoom API] Preview error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "No se pudo consultar Zoom.",
      zoomCode: error.zoomCode || null,
    });
  }
};

const linkMissing = async (req, res) => {
  try {
    await ensureCanProcess(req);

    const meetingId = normalizeMeetingId(req.body?.meetingId);
    const date = String(req.body?.date || "").trim();
    const selectedType = String(req.body?.sessionType || "").trim();
    const startTime = String(req.body?.startTime || "").trim();
    const endTime = String(req.body?.endTime || "").trim();
    const zoomDay = await loadZoomDay({ meetingId, date });
    const allowedCircles = await getAllowedCircleNames(req);

    const created = await createMissingMeetings({
      req,
      zoomDay,
      selectedType,
      allowedCircles,
      startTime,
      endTime,
    });

    await createAuditLog({
      admin: req.user,
      action: "Vinculó reunión detectada por Zoom API",
      module: "zoom",
      description: `Se vinculó ${zoomDay.sessionType} del ${zoomDay.date} (${startTime} - ${endTime}). Se crearon ${created.length} reunión(es) faltante(s) en Calendario.`,
      targetId: `${zoomDay.sessionType}-${zoomDay.date}`,
      targetName: `${zoomDay.sessionType} ${zoomDay.date}`,
      circle: "GLOBAL",
      reversible: false,
      metadata: {
        source: "ZOOM_API",
        zoomMeetingId: zoomDay.meetingId,
        sessionType: zoomDay.sessionType,
        date: zoomDay.date,
        startTime,
        endTime,
        createdMeetings: created.map((meeting) => ({
          id: String(meeting._id),
          circle: meeting.circle,
        })),
      },
    });

    return res.json({
      success: true,
      mode: "link",
      message:
        created.length > 0
          ? `Se crearon y vincularon ${created.length} reunión(es) faltante(s). Ya puedes sincronizar la asistencia.`
          : "La reunión ya estaba vinculada. No fue necesario crear registros nuevos.",
      meetingId: zoomDay.meetingId,
      sessionType: zoomDay.sessionType,
      date: zoomDay.date,
      startTime,
      endTime,
      created: created.length,
      createdMeetings: created.map((meeting) => ({
        id: meeting._id,
        circle: meeting.circle,
        type: meeting.type,
        date: meeting.date,
      })),
    });
  } catch (error) {
    console.error("[Zoom API] Link error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "No se pudo vincular la reunión de Zoom.",
      zoomCode: error.zoomCode || null,
    });
  }
};

const sync = async (req, res) => {
  try {
    await ensureCanProcess(req);

    const meetingId = normalizeMeetingId(req.body?.meetingId);
    const date = String(req.body?.date || "").trim();
    const zoomDay = await loadZoomDay({ meetingId, date });
    const directory = await enrichWithDirectory({ req, zoomDay });
    const coverage = await getCalendarCoverage({
      sessionType: zoomDay.sessionType,
      date: zoomDay.date,
      allowedCircles: directory.allowedCircles,
    });

    if (!coverage.complete) {
      return res.status(409).json({
        message:
          "La sesión todavía no está vinculada completamente al Calendario. Crea las reuniones faltantes antes de sincronizar.",
        linkRequired: true,
        sessionType: zoomDay.sessionType,
        date: zoomDay.date,
        missingCircles: coverage.missingCircles,
      });
    }

    const changes = await applyAttendance({ req, zoomDay, directory });

    await createAuditLog({
      admin: req.user,
      action: "Sincronizó asistencia desde Zoom API",
      module: "zoom",
      description: `Zoom API ${zoomDay.sessionType} ${zoomDay.date}: ${changes.applied.length} asistencia(s) aplicada(s). Los ausentes y quienes no llegaron a ${MINIMUM_MINUTES} minutos quedaron sin cambios hasta finalizar la sesión.`,
      targetId: `${zoomDay.sessionType}-${zoomDay.date}`,
      targetName: `${zoomDay.sessionType} ${zoomDay.date}`,
      circle: canManageGlobal(req.user) ? "GLOBAL" : directory.allowedCircles.join(", "),
      reversible: false,
      metadata: {
        source: "ZOOM_API",
        zoomMeetingId: zoomDay.meetingId,
        sessionType: zoomDay.sessionType,
        date: zoomDay.date,
        instances: zoomDay.instances.map((item) => ({
          uuid: item.uuid,
          startTime: item.start_time,
        })),
        records: zoomDay.allRows.length,
        emails: zoomDay.aggregated.length,
        matched: directory.results.filter((item) => item.matched).length,
        qualified: directory.results.filter((item) => item.willApply).length,
        applied: changes.applied.length,
      },
    });

    return res.json({
      success: true,
      mode: "sync",
      message:
        "Sincronización completada. Solo se agregaron asistencias >= 10 min; todavía no se generaron faltas.",
      ...buildCommonResponse({ zoomDay, directory, coverage }),
      applied: changes.applied.length,
      alreadyPresent: changes.alreadyPresent.length,
      absent: 0,
      results: directory.results,
    });
  } catch (error) {
    console.error("[Zoom API] Sync error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "No se pudo sincronizar Zoom.",
      zoomCode: error.zoomCode || null,
    });
  }
};

const finalize = async (req, res) => {
  try {
    await ensureCanProcess(req);

    const meetingId = normalizeMeetingId(req.body?.meetingId);
    const date = String(req.body?.date || "").trim();
    const zoomDay = await loadZoomDay({ meetingId, date });
    const directory = await enrichWithDirectory({ req, zoomDay });
    const coverage = await getCalendarCoverage({
      sessionType: zoomDay.sessionType,
      date: zoomDay.date,
      allowedCircles: directory.allowedCircles,
    });

    if (!coverage.complete) {
      return res.status(409).json({
        message:
          "No puedes finalizar mientras existan reuniones sin vincular al Calendario.",
        linkRequired: true,
        sessionType: zoomDay.sessionType,
        date: zoomDay.date,
        missingCircles: coverage.missingCircles,
      });
    }

    // Antes de cerrar, vuelve a consultar TODAS las instancias del día y aplica
    // cualquier asistencia que haya alcanzado 10 minutos desde la última sync.
    const attendanceChanges = await applyAttendance({ req, zoomDay, directory });
    const absenceChanges = await finalizeAbsences({ req, zoomDay, directory });

    await createAuditLog({
      admin: req.user,
      action: "Finalizó asistencia de Zoom API",
      module: "zoom",
      description: `Se finalizó ${zoomDay.sessionType} del ${zoomDay.date}: ${attendanceChanges.applied.length} asistencia(s) nueva(s) y ${absenceChanges.absent.length} falta(s) oficiales.`,
      targetId: `${zoomDay.sessionType}-${zoomDay.date}`,
      targetName: `${zoomDay.sessionType} ${zoomDay.date}`,
      circle: canManageGlobal(req.user) ? "GLOBAL" : directory.allowedCircles.join(", "),
      reversible: false,
      metadata: {
        source: "ZOOM_API",
        zoomMeetingId: zoomDay.meetingId,
        sessionType: zoomDay.sessionType,
        date: zoomDay.date,
        instances: zoomDay.instances.map((item) => ({
          uuid: item.uuid,
          startTime: item.start_time,
        })),
        appliedNow: attendanceChanges.applied.length,
        alreadyPresent: attendanceChanges.alreadyPresent.length,
        absencesCreatedOrConfirmed: absenceChanges.absent.length,
        preservedStatuses: absenceChanges.preserved.length,
      },
    });

    return res.json({
      success: true,
      mode: "finalize",
      message:
        "Sesión finalizada. Se conservaron Asistió, Clase Presencial y Justificado; los demás miembros quedaron como No asistió.",
      ...buildCommonResponse({ zoomDay, directory, coverage }),
      applied: attendanceChanges.applied.length,
      alreadyPresent: attendanceChanges.alreadyPresent.length,
      absent: absenceChanges.absent.length,
      preserved: absenceChanges.preserved.length,
      results: directory.results,
    });
  } catch (error) {
    console.error("[Zoom API] Finalize error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "No se pudo finalizar la asistencia Zoom.",
      zoomCode: error.zoomCode || null,
    });
  }
};

const SYSTEM_REQ = {
  user: {
    adminId: "ADM-001",
    name: "Zoom Automático",
    role: "Administrador General",
    circleScope: [],
  },
};

const runAutomaticSync = async ({ meetingId, date, trigger = "AUTO" }) => {
  const req = SYSTEM_REQ;
  const zoomDay = await loadZoomDay({
    meetingId: normalizeMeetingId(meetingId),
    date: String(date || "").trim(),
  });

  const directory = await enrichWithDirectory({ req, zoomDay });
  const coverage = await getCalendarCoverage({
    sessionType: zoomDay.sessionType,
    date: zoomDay.date,
    allowedCircles: directory.allowedCircles,
  });

  if (!coverage.complete) {
    return {
      success: false,
      skipped: true,
      linkRequired: true,
      sessionType: zoomDay.sessionType,
      date: zoomDay.date,
      meetingId: zoomDay.meetingId,
      instances: zoomDay.instances.length,
      applied: 0,
      missingCircles: coverage.missingCircles,
      message: "La sincronización automática quedó pendiente porque faltan reuniones por vincular en el Calendario.",
    };
  }

  const changes = await applyAttendance({ req, zoomDay, directory });

  await createAuditLog({
    admin: req.user,
    action: "Sincronización automática desde Zoom API",
    module: "zoom",
    description: `${trigger}: ${zoomDay.sessionType} ${zoomDay.date}. ${changes.applied.length} asistencia(s) nueva(s); no se generaron faltas.`,
    targetId: `${zoomDay.sessionType}-${zoomDay.date}`,
    targetName: `${zoomDay.sessionType} ${zoomDay.date}`,
    circle: "GLOBAL",
    reversible: false,
    metadata: {
      source: "ZOOM_API_AUTO",
      trigger,
      zoomMeetingId: zoomDay.meetingId,
      sessionType: zoomDay.sessionType,
      date: zoomDay.date,
      instances: zoomDay.instances.map((item) => ({
        uuid: item.uuid,
        startTime: item.start_time,
      })),
      applied: changes.applied.length,
      alreadyPresent: changes.alreadyPresent.length,
    },
  });

  return {
    success: true,
    skipped: false,
    linkRequired: false,
    sessionType: zoomDay.sessionType,
    date: zoomDay.date,
    meetingId: zoomDay.meetingId,
    instances: zoomDay.instances.length,
    applied: changes.applied.length,
    alreadyPresent: changes.alreadyPresent.length,
    message: "Sincronización automática completada sin generar faltas.",
  };
};

module.exports = {
  getConfig,
  preview,
  linkMissing,
  sync,
  finalize,
  runAutomaticSync,
};