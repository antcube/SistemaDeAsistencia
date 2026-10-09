const normalizeMeetingId = (value) => String(value || "").replace(/\D/g, "");

// Un Meeting ID por categoría. Las variables de Railway tienen prioridad.
// Los fallback permiten que HEALTH y ANUNCIOS CORPORATIVOS queden listos
// con los IDs ya definidos para las pruebas actuales.
const CONFIG = [
  {
    type: "HEALTH",
    env: "ZOOM_HEALTH_MEETING_ID",
    fallbackMeetingId: "85757884631",
  },
  {
    type: "MASTERCLASS",
    env: "ZOOM_MASTERCLASS_MEETING_ID",
    fallbackMeetingId: "",
  },
  {
    type: "MENTORIA",
    env: "ZOOM_MENTORIA_MEETING_ID",
    fallbackMeetingId: "",
  },
  {
    type: "ANUNCIOS CORPORATIVOS",
    env: "ZOOM_ANUNCIOS_MEETING_ID",
    fallbackMeetingId: "84454183100",
  },
];

const getConfiguredMeetings = () => {
  return CONFIG.map((item) => {
    const meetingId = normalizeMeetingId(
      process.env[item.env] || item.fallbackMeetingId
    );

    if (!meetingId) return null;

    return {
      type: item.type,
      meetingId,
      env: item.env,
    };
  }).filter(Boolean);
};

const getSessionTypeByMeetingId = (meetingId) => {
  const normalized = normalizeMeetingId(meetingId);
  if (!normalized) return null;

  return (
    getConfiguredMeetings().find((item) => item.meetingId === normalized) ||
    null
  );
};

module.exports = {
  normalizeMeetingId,
  getConfiguredMeetings,
  getSessionTypeByMeetingId,
};