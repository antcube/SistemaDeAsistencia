const User = require("../models/User");
const Meeting = require("../models/Meeting");
const Attendance = require("../models/Attendance");
const { isGlobalAdministrator } = require("../middleware/permissionMiddleware");

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const VALID_BONUS_CATEGORIES = [
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
  "ORDINARIA",
];

const normalize = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const normalizeStatus = (value) => {
  const status = normalize(value);
  if (status === "ASISTIO" || status === "CLASE PRESENCIAL") return "ATTENDED";
  if (status === "JUSTIFICADO" || status === "FALTA JUSTIFICADA") return "JUSTIFIED";
  return "ABSENT";
};

const normalizeCategory = (meeting) => {
  const type = normalize(meeting?.type);
  const title = normalize(meeting?.title);

  if (
    type === "CIRCULO DE LIDERAZGO" ||
    type === "MES" ||
    title.includes("CIRCULO DE LIDERAZGO") ||
    title === "MES" ||
    /^SESION\s+\d+$/.test(title)
  ) return "CIRCULO DE LIDERAZGO";

  if (type === "MENTORIA" || title === "MENTORIA") return "MENTORIA";
  if (type === "MASTERCLASS" || title.includes("MASTERCLASS")) return "MASTERCLASS";
  if (type === "HEALTH" || title === "HEALTH") return "HEALTH";
  if (type === "ANUNCIOS CORPORATIVOS" || title === "ANUNCIOS CORPORATIVOS") return "ANUNCIOS CORPORATIVOS";
  return type || "ORDINARIA";
};

const getWeekOfMonth = (dateString) => {
  const day = Number(String(dateString || "").slice(8, 10));
  return day ? Math.min(5, Math.ceil(day / 7)) : 1;
};

const formatDate = (value) => {
  const parts = String(value || "").slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : "—";
};

const isVirtualCircle = (circle) => normalize(circle).includes("VIRTUAL");

const buildMemberStats = (user, sessions, recordMap) => {
  const leadershipJs = [];
  const bonusJs = [];

  sessions.forEach((session) => {
    const record = recordMap.get(`${String(session.meeting._id)}|${String(user._id)}`);
    if (!record || normalizeStatus(record.status) !== "JUSTIFIED") return;

    if (session.category === "CIRCULO DE LIDERAZGO") leadershipJs.push(session);
    else if (VALID_BONUS_CATEGORIES.includes(session.category)) bonusJs.push(session);
  });

  const sorter = (a, b) =>
    String(a.meeting.date).localeCompare(String(b.meeting.date)) ||
    String(a.meeting.time || "").localeCompare(String(b.meeting.time || ""));

  leadershipJs.sort(sorter);
  bonusJs.sort(sorter);

  const validJ = new Set();
  leadershipJs.slice(0, 1).forEach((s) => validJ.add(String(s.meeting._id)));
  bonusJs.slice(0, 3).forEach((s) => validJ.add(String(s.meeting._id)));

  const now = new Date();
  now.setHours(23, 59, 59, 999);

  let scheduled = 0;
  let attended = 0;
  let absent = 0;
  let pending = 0;
  let justifiedValid = 0;
  let justifiedExtra = 0;

  sessions.forEach((session) => {
    const record = recordMap.get(`${String(session.meeting._id)}|${String(user._id)}`);
    const sessionDate = new Date(`${session.meeting.date}T23:59:59`);
    const occurred = sessionDate <= now;
    const hasProcessedRecord = Boolean(record);

    if (!occurred && !hasProcessedRecord) {
      pending += 1;
      return;
    }

    scheduled += 1;

    if (!record) {
      absent += 1;
      return;
    }

    const status = normalizeStatus(record.status);

    if (status === "JUSTIFIED") {
      if (validJ.has(String(session.meeting._id))) {
        attended += 1;
        justifiedValid += 1;
      } else {
        absent += 1;
        justifiedExtra += 1;
      }
    } else if (status === "ATTENDED") {
      attended += 1;
    } else {
      absent += 1;
    }
  });

  const pct = scheduled ? (attended / scheduled) * 100 : 0;
  const bonus = scheduled > 0 && pending === 0 && attended === scheduled;

  return {
    scheduled,
    attended,
    absent,
    pending,
    justifiedValid,
    justifiedExtra,
    pct,
    bonus,
  };
};

const buildDataset = ({ label, users, meetings, records, selectedWeek = null }) => {
  const recordMap = new Map();
  records.forEach((record) => {
    recordMap.set(`${String(record.meeting)}|${String(record.user)}`, record);
  });

  const sessions = meetings.map((meeting) => ({
    meeting,
    category: normalizeCategory(meeting),
  }));

  const filteredSessions = selectedWeek === null
    ? sessions
    : sessions.filter((session) => getWeekOfMonth(session.meeting.date) === selectedWeek);

  const status = { attended: 0, absent: 0, justified: 0 };
  let totalSessionRates = 0;
  let sessionCount = 0;

  filteredSessions.forEach((session) => {
    let attended = 0;
    let absent = 0;
    let justified = 0;

    users.forEach((user) => {
      const record = recordMap.get(`${String(session.meeting._id)}|${String(user._id)}`);
      if (!record) {
        const date = new Date(`${session.meeting.date}T23:59:59`);
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        if (date <= now) absent += 1;
        return;
      }

      const current = normalizeStatus(record.status);
      if (current === "ATTENDED") attended += 1;
      else if (current === "JUSTIFIED") justified += 1;
      else absent += 1;
    });

    const resolved = attended + absent + justified;
    if (resolved > 0) {
      totalSessionRates += ((attended + justified) / resolved) * 100;
      sessionCount += 1;
    }

    status.attended += attended;
    status.absent += absent;
    status.justified += justified;
  });

  const memberStats = users.map((user) => {
    const stats = buildMemberStats(user, filteredSessions, recordMap);
    return {
      id: String(user._id),
      doc: user.doc || "",
      name: user.name || user.username || user.doc || "Sin Nombre",
      circle: user.circle || "",
      ...stats,
    };
  });

  const totalResolved = status.attended + status.absent + status.justified;
  const attendanceRate = totalResolved ? ((status.attended + status.justified) / totalResolved) * 100 : 0;
  const absenceRate = totalResolved ? (status.absent / totalResolved) * 100 : 0;
  const justifiedRate = totalResolved ? (status.justified / totalResolved) * 100 : 0;
  const averageSessionAttendance = sessionCount ? totalSessionRates / sessionCount : 0;

  const weekly = Array.from({ length: 5 }, (_, index) => {
    const week = index + 1;
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const weekSessions = sessions.filter((session) => {
      if (getWeekOfMonth(session.meeting.date) !== week) return false;
      const sessionDate = new Date(`${session.meeting.date}T23:59:59`);
      return sessionDate <= now;
    });

    let attended = 0;
    let absent = 0;
    let justified = 0;

    weekSessions.forEach((session) => {
      users.forEach((user) => {
        const record = recordMap.get(`${String(session.meeting._id)}|${String(user._id)}`);

        if (!record) {
          absent += 1;
          return;
        }

        const current = normalizeStatus(record.status);
        if (current === "ATTENDED") attended += 1;
        else if (current === "JUSTIFIED") justified += 1;
        else absent += 1;
      });
    });

    const possibleParticipations = users.length * weekSessions.length;

    return {
      week,
      label: `Semana ${week}`,
      attended,
      absent,
      justified,
      possibleParticipations,
      rate: possibleParticipations ? (attended / possibleParticipations) * 100 : 0,
    };
  });

  const categoryMap = new Map();
  filteredSessions.forEach((session) => {
    const type = session.category;
    if (!categoryMap.has(type)) {
      categoryMap.set(type, { type, sessions: 0, attended: 0, absent: 0, justified: 0 });
    }

    const bucket = categoryMap.get(type);
    bucket.sessions += 1;

    users.forEach((user) => {
      const record = recordMap.get(`${String(session.meeting._id)}|${String(user._id)}`);
      if (!record) return;
      const current = normalizeStatus(record.status);
      if (current === "ATTENDED") bucket.attended += 1;
      else if (current === "JUSTIFIED") bucket.justified += 1;
      else bucket.absent += 1;
    });
  });

  const categories = Array.from(categoryMap.values()).map((item) => {
    // El porcentaje de asistencia por tipo de sesión debe considerar
    // todas las participaciones posibles: Miembros × Sesiones.
    // Así, 2 asistencias en 4 sesiones de 14 miembros = 2 / 56 = 3.6%.
    const possibleParticipations = users.length * item.sessions;

    return {
      ...item,
      possibleParticipations,
      rate: possibleParticipations
        ? ((item.attended + item.justified) / possibleParticipations) * 100
        : 0,
    };
  }).sort((a, b) => b.rate - a.rate);

  const lowAttendance = memberStats
    .filter((member) => member.scheduled > 0 && member.pct < 70)
    .sort((a, b) => a.pct - b.pct || b.absent - a.absent)
    .slice(0, 12)
    .map((member) => ({
      ...member,
      lastAttendance: "",
    }));

  const recipients = memberStats.filter((member) => member.bonus);
  const nonRecipients = memberStats
    .filter((member) => member.scheduled > 0 && !member.bonus)
    .sort((a, b) => b.absent - a.absent || a.pct - b.pct)
    .slice(0, 30);

  const justificationMap = new Map();
  filteredSessions.forEach((session) => {
    users.forEach((user) => {
      const record = recordMap.get(`${String(session.meeting._id)}|${String(user._id)}`);
      if (!record || normalizeStatus(record.status) !== "JUSTIFIED") return;
      const reason = String(record.justificationReason || "").trim() || "Sin Tipo Especificado";
      justificationMap.set(reason, (justificationMap.get(reason) || 0) + 1);
    });
  });

  const justificationTypes = Array.from(justificationMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const growth = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    growth.push({ label: MONTHS[d.getMonth()].slice(0, 3), value: 0 });
  }

  return {
    label,
    summary: {
      members: users.length,
      meetings: filteredSessions.length,
      attended: status.attended,
      absent: status.absent,
      justified: status.justified,
      attendanceRate: Number(attendanceRate.toFixed(1)),
      absenceRate: Number(absenceRate.toFixed(1)),
      justifiedRate: Number(justifiedRate.toFixed(1)),
      averageSessionAttendance: Number(averageSessionAttendance.toFixed(1)),
      bonus: recipients.length,
    },
    status,
    weekly,
    categories,
    justificationTypes,
    lowAttendance,
    recipients,
    nonRecipients,
    growth,
  };
};

const dashboardController = {
  async getDashboard(req, res) {
    try {
      if (!isGlobalAdministrator(req.user)) {
        return res.status(403).json({
          message: "Solo El Administrador Principal Puede Consultar El Dashboard.",
        });
      }

      const now = new Date();
      const year = Number(req.query.year) || now.getFullYear();
      const month = Number(req.query.month) || now.getMonth() + 1;
      const requestedCircle = String(req.query.circle || "").trim();
      const requestedWeek = req.query.week === undefined || req.query.week === ""
        ? null
        : Number(req.query.week);

      if (month < 1 || month > 12) {
        return res.status(400).json({ message: "El Mes Seleccionado No Es Válido." });
      }

      if (requestedWeek !== null && (!Number.isInteger(requestedWeek) || requestedWeek < 1 || requestedWeek > 5)) {
        return res.status(400).json({ message: "La Semana Seleccionada No Es Válida." });
      }

      const monthString = String(month).padStart(2, "0");
      const firstDate = `${year}-${monthString}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const lastDate = `${year}-${monthString}-${String(lastDay).padStart(2, "0")}`;

      const [users, meetings] = await Promise.all([
        User.find({}).lean(),
        Meeting.find({
          active: true,
          date: { $gte: firstDate, $lte: lastDate },
        }).sort({ date: 1, time: 1 }).lean(),
      ]);

      const meetingIds = meetings.map((meeting) => meeting._id);
      const records = meetingIds.length
        ? await Attendance.find({ meeting: { $in: meetingIds }, active: { $ne: false } }).lean()
        : [];

      const circleNames = [...new Set(users.map((user) => String(user.circle || "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "es"));

      const buildForCircle = (circle, week = requestedWeek) => {
        const circleKey = normalize(circle);
        const circleUsers = users.filter((user) => normalize(user.circle) === circleKey);
        const circleMeetings = meetings.filter((meeting) => normalize(meeting.circle) === circleKey);
        const circleMeetingIds = new Set(circleMeetings.map((meeting) => String(meeting._id)));
        const circleRecords = records.filter((record) => circleMeetingIds.has(String(record.meeting)));
        return buildDataset({
          label: circle,
          users: circleUsers,
          meetings: circleMeetings,
          records: circleRecords,
          selectedWeek: week,
        });
      };

      if (requestedCircle) {
        const exists = circleNames.some((name) => normalize(name) === normalize(requestedCircle));
        if (!exists) {
          return res.status(404).json({ message: "El Círculo Seleccionado No Existe." });
        }

        return res.json({
          mode: "circle",
          period: {
            year,
            month,
            monthLabel: `${MONTHS[month - 1]} ${year}`,
            circle: requestedCircle,
            week: requestedWeek,
          },
          circles: circleNames,
          ...buildForCircle(requestedCircle),
        });
      }

      const classify = (name) => isVirtualCircle(name) ? "virtual" : "presential";
      const presentialUsers = users.filter((user) => classify(user.circle) === "presential");
      const virtualUsers = users.filter((user) => classify(user.circle) === "virtual");
      const presentialMeetings = meetings.filter((meeting) => classify(meeting.circle) === "presential");
      const virtualMeetings = meetings.filter((meeting) => classify(meeting.circle) === "virtual");

      const presentialMeetingIds = new Set(presentialMeetings.map((meeting) => String(meeting._id)));
      const virtualMeetingIds = new Set(virtualMeetings.map((meeting) => String(meeting._id)));

      const comparison = {
        presential: buildDataset({
          label: "Asistencias Presenciales",
          users: presentialUsers,
          meetings: presentialMeetings,
          records: records.filter((record) => presentialMeetingIds.has(String(record.meeting))),
          selectedWeek: requestedWeek,
        }),
        virtual: buildDataset({
          label: "Asistencias Virtuales",
          users: virtualUsers,
          meetings: virtualMeetings,
          records: records.filter((record) => virtualMeetingIds.has(String(record.meeting))),
          selectedWeek: requestedWeek,
        }),
      };

      res.json({
        mode: "comparison",
        period: {
          year,
          month,
          monthLabel: `${MONTHS[month - 1]} ${year}`,
          circle: null,
          week: requestedWeek,
        },
        circles: circleNames,
        comparison,
      });
    } catch (error) {
      console.error("[Dashboard] Error:", error);
      res.status(500).json({
        message: "No Se Pudo Cargar El Dashboard.",
        error: error.message,
      });
    }
  },
};

module.exports = dashboardController;
