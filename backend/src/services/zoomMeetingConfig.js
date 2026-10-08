const normalizeMeetingId = (value) => String(value || "").replace(/\D/g, "");

const CONFIG = [
  {
    type: "HEALTH",
    env: "ZOOM_HEALTH_MEETING_ID",
  },
  {
    type: "MASTERCLASS",
    env: "ZOOM_MASTERCLASS_MEETING_ID",
  },
  {
    type: "MENTORIA",
    env: "ZOOM_MENTORIA_MEETING_ID",
  },
  {
    type: "ANUNCIOS CORPORATIVOS",
    env: "ZOOM_ANUNCIOS_MEETING_ID",
  },
];

const getConfiguredMeetings = () => {
  return CONFIG.map((item) => ({
    type: item.type,
    meetingId: normalizeMeetingId(process.env[item.env]),
    env: item.env,
  })).filter((item) => item.meetingId);
};

const getSessionTypeByMeetingId = (meetingId) => {
  const normalized = normalizeMeetingId(meetingId);

  if (!normalized) {
    return null;
  }

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
