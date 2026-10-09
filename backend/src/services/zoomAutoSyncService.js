const Meeting = require("../models/Meeting");
const ZoomAutoSyncRun = require("../models/ZoomAutoSyncRun");
const { getConfiguredMeetings } = require("./zoomMeetingConfig");
const { runAutomaticSync } = require("../controllers/zoomApiController");

const TIMEZONE = process.env.ZOOM_TIMEZONE || "America/Lima";
const CHECK_EVERY_MS = 60 * 1000;
const NIGHTLY_MINUTE = 23 * 60 + 30;
const runningKeys = new Set();

const normalizeType = (value) => {
  const type = String(value || "").trim().toUpperCase();
  return type === "MENTORÍA" ? "MENTORIA" : type;
};

const getLocalParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    minuteOfDay: Number(map.hour) * 60 + Number(map.minute),
  };
};

const hhmmToMinutes = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;

  let match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour > 23 || minute > 59) return null;

    return hour * 60 + minute;
  }

  match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3];

  if (hour < 1 || hour > 12 || minute > 59) return null;

  if (period === "AM") {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }

  return hour * 60 + minute;
};

const canAttemptRun = async ({ meetingId, date, trigger }) => {
  const existing = await ZoomAutoSyncRun.findOne({
    meetingId,
    date,
    trigger,
  }).lean();

  if (!existing) return true;
  if (existing.status === "success") return false;

  const lastRun = new Date(existing.ranAt || existing.updatedAt || 0).getTime();

  return Date.now() - lastRun >= 10 * 60 * 1000;
};

const saveRun = async ({ meetingId, sessionType, date, trigger, result, error }) => {
  await ZoomAutoSyncRun.findOneAndUpdate(
    { meetingId, date, trigger },
    {
      $set: {
        sessionType,
        status: error
          ? "failed"
          : result?.linkRequired
            ? "pending_link"
            : "success",
        applied: Number(result?.applied || 0),
        instances: Number(result?.instances || 0),
        message: error
          ? String(error.message || error)
          : String(result?.message || ""),
        ranAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const executeOnce = async ({ meetingId, sessionType, date, trigger }) => {
  const key = `${meetingId}:${date}:${trigger}`;

  if (runningKeys.has(key)) return;
  if (!(await canAttemptRun({ meetingId, date, trigger }))) return;

  runningKeys.add(key);

  try {
    const result = await runAutomaticSync({ meetingId, date, trigger });

    await saveRun({
      meetingId,
      sessionType,
      date,
      trigger,
      result,
    });

    console.log(
      `[Zoom Auto] ${trigger} ${sessionType} ${date} ID ${meetingId} -> ${result.applied || 0} asistencia(s), ${result.instances || 0} instancia(s).`
    );
  } catch (error) {
    await saveRun({
      meetingId,
      sessionType,
      date,
      trigger,
      error,
    }).catch(() => {});

    console.error(
      `[Zoom Auto] Error ${trigger} ${sessionType} ${date} ID ${meetingId}:`,
      error.message
    );
  } finally {
    runningKeys.delete(key);
  }
};

const runSchedulerTick = async () => {
  const { date, minuteOfDay } = getLocalParts();
  const configured = getConfiguredMeetings();

  if (!configured.length) return;

  const types = [...new Set(configured.map((item) => normalizeType(item.type)))];

  const meetings = await Meeting.find({
    active: true,
    date,
    type: { $in: types },
  })
    .select("type date endTime")
    .lean();

  const endMinuteByType = new Map();

  for (const meeting of meetings) {
    const type = normalizeType(meeting.type);
    const endMinute = hhmmToMinutes(meeting.endTime);

    if (endMinute === null) continue;

    const current = endMinuteByType.get(type);

    if (current === undefined || endMinute > current) {
      endMinuteByType.set(type, endMinute);
    }
  }

  for (const config of configured) {
    const type = normalizeType(config.type);
    const endMinute = endMinuteByType.get(type);

    if (endMinute === undefined) continue;

    if (minuteOfDay >= endMinute + 10) {
      await executeOnce({
        meetingId: config.meetingId,
        sessionType: type,
        date,
        trigger: "END_PLUS_10",
      });
    }

    if (minuteOfDay >= NIGHTLY_MINUTE) {
      await executeOnce({
        meetingId: config.meetingId,
        sessionType: type,
        date,
        trigger: "NIGHTLY_2330",
      });
    }
  }
};

const startZoomAutoSyncScheduler = () => {
  if (
    String(process.env.ZOOM_AUTO_SYNC_ENABLED || "true").toLowerCase() ===
    "false"
  ) {
    console.log("[Zoom Auto] Desactivado por ZOOM_AUTO_SYNC_ENABLED=false");
    return;
  }

  console.log(
    `[Zoom Auto] Activo. Revisión cada minuto (${TIMEZONE}); una sesión se identifica por fecha + Meeting ID, primera sync = fin + 10 min y revisión final = 23:30.`
  );

  setTimeout(() => {
    runSchedulerTick().catch((error) =>
      console.error("[Zoom Auto] Error inicial:", error.message)
    );
  }, 5000);

  const timer = setInterval(() => {
    runSchedulerTick().catch((error) =>
      console.error("[Zoom Auto] Error scheduler:", error.message)
    );
  }, CHECK_EVERY_MS);

  if (typeof timer.unref === "function") timer.unref();
};

module.exports = {
  startZoomAutoSyncScheduler,
  runSchedulerTick,
};
