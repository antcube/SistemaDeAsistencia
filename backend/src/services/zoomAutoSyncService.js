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

  const map = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

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

    if (
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    return hour * 60 + minute;
  }

  match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3];

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  if (period === "AM") {
    if (hour === 12) {
      hour = 0;
    }
  } else if (hour !== 12) {
    hour += 12;
  }

  return hour * 60 + minute;
};

const minutesToTriggerSuffix = (minutes) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, "0")}${String(minute).padStart(
    2,
    "0"
  )}`;
};

const canAttemptRun = async ({
  meetingId,
  date,
  trigger,
}) => {
  const existing = await ZoomAutoSyncRun.findOne({
    meetingId,
    date,
    trigger,
  }).lean();

  if (!existing) {
    return true;
  }

  if (existing.status === "success") {
    return false;
  }

  const lastRun = new Date(
    existing.ranAt ||
      existing.updatedAt ||
      0
  ).getTime();

  return (
    Date.now() - lastRun >=
    10 * 60 * 1000
  );
};

const saveRun = async ({
  meetingId,
  sessionType,
  date,
  trigger,
  result,
  error,
}) => {
  await ZoomAutoSyncRun.findOneAndUpdate(
    {
      meetingId,
      date,
      trigger,
    },
    {
      $set: {
        sessionType,
        status: error
          ? "failed"
          : result?.linkRequired
            ? "pending_link"
            : "success",
        applied: Number(
          result?.applied || 0
        ),
        instances: Number(
          result?.instances || 0
        ),
        message: error
          ? String(
              error.message || error
            )
          : String(
              result?.message || ""
            ),
        ranAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

const executeOnce = async ({
  meetingId,
  sessionType,
  date,
  trigger,
}) => {
  const key =
    `${meetingId}:${date}:${trigger}`;

  if (runningKeys.has(key)) {
    return;
  }

  const allowed =
    await canAttemptRun({
      meetingId,
      date,
      trigger,
    });

  if (!allowed) {
    return;
  }

  runningKeys.add(key);

  try {
    const result =
      await runAutomaticSync({
        meetingId,
        date,
        trigger,
      });

    await saveRun({
      meetingId,
      sessionType,
      date,
      trigger,
      result,
    });

    console.log(
      `[Zoom Auto] ${trigger} ${sessionType} ${date} ID ${meetingId} -> ${
        result?.applied || 0
      } asistencia(s), ${
        result?.instances || 0
      } instancia(s).`
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
  const {
    date,
    minuteOfDay,
  } = getLocalParts();

  const configured =
    getConfiguredMeetings();

  if (!configured.length) {
    return;
  }

  const types = [
    ...new Set(
      configured.map((item) =>
        normalizeType(item.type)
      )
    ),
  ];

  const meetings =
    await Meeting.find({
      active: true,
      date,
      type: {
        $in: types,
      },
    })
      .select(
        "type date endTime"
      )
      .lean();

  const endMinutesByType =
    new Map();

  for (const meeting of meetings) {
    const type =
      normalizeType(
        meeting.type
      );

    const endMinute =
      hhmmToMinutes(
        meeting.endTime
      );

    if (endMinute === null) {
      continue;
    }

    if (
      !endMinutesByType.has(type)
    ) {
      endMinutesByType.set(
        type,
        new Set()
      );
    }

    endMinutesByType
      .get(type)
      .add(endMinute);
  }

  for (const config of configured) {
    const type =
      normalizeType(
        config.type
      );

    const meetingId =
      String(
        config.meetingId || ""
      ).trim();

    if (!meetingId) {
      continue;
    }

    const endMinutes =
      endMinutesByType.get(type);

    if (
      endMinutes &&
      endMinutes.size
    ) {
      const sortedEndMinutes = [
        ...endMinutes,
      ].sort(
        (a, b) => a - b
      );

      for (
        const endMinute
        of sortedEndMinutes
      ) {
        const syncMinute =
          endMinute + 5;

        if (
          minuteOfDay <
          syncMinute
        ) {
          continue;
        }

        const trigger =
          `END_PLUS_5_${minutesToTriggerSuffix(
            endMinute
          )}`;

        await executeOnce({
          meetingId,
          sessionType: type,
          date,
          trigger,
        });
      }
    }

    if (
      minuteOfDay >=
      NIGHTLY_MINUTE
    ) {
      await executeOnce({
        meetingId,
        sessionType: type,
        date,
        trigger:
          "NIGHTLY_2330",
      });
    }
  }
};

const startZoomAutoSyncScheduler =
  () => {
    if (
      String(
        process.env
          .ZOOM_AUTO_SYNC_ENABLED ||
          "true"
      ).toLowerCase() ===
      "false"
    ) {
      console.log(
        "[Zoom Auto] Desactivado por ZOOM_AUTO_SYNC_ENABLED=false"
      );

      return;
    }

    console.log(
      `[Zoom Auto] Activo. Revisión cada minuto (${TIMEZONE}); misma fecha + Meeting ID se procesa como una sola reunión lógica, cada hora final genera una revisión a +5 min y existe revisión final a las 23:30.`
    );

    setTimeout(() => {
      runSchedulerTick().catch(
        (error) =>
          console.error(
            "[Zoom Auto] Error inicial:",
            error.message
          )
      );
    }, 5000);

    const timer =
      setInterval(() => {
        runSchedulerTick().catch(
          (error) =>
            console.error(
              "[Zoom Auto] Error scheduler:",
              error.message
            )
        );
      }, CHECK_EVERY_MS);

    if (
      typeof timer.unref ===
      "function"
    ) {
      timer.unref();
    }
  };

module.exports = {
  startZoomAutoSyncScheduler,
  runSchedulerTick,
};