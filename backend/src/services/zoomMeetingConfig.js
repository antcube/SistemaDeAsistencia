const normalizeMeetingId = (value) => String(value || "").replace(/\D/g, "");

const CONFIG = [
  {
    key: "LEADERSHIP_VIRTUAL_1",
    label: "CÍRCULO DE LIDERAZGO · Virtual 1",
    types: ["CIRCULO DE LIDERAZGO"],
    circles: ["Virtual 1"],
    env: "ZOOM_LEADERSHIP_VIRTUAL_1_MEETING_ID",
    fallbackMeetingId: "86403642347",
  },
  {
    key: "LEADERSHIP_VIRTUAL_2",
    label: "CÍRCULO DE LIDERAZGO · Virtual 2",
    types: ["CIRCULO DE LIDERAZGO"],
    circles: ["Virtual 2"],
    env: "ZOOM_LEADERSHIP_VIRTUAL_2_MEETING_ID",
    fallbackMeetingId: "86549993647",
  },
  {
    key: "LEADERSHIP_VIRTUAL_3",
    label: "CÍRCULO DE LIDERAZGO · Virtual 3",
    types: ["CIRCULO DE LIDERAZGO"],
    circles: ["Virtual 3"],
    env: "ZOOM_LEADERSHIP_VIRTUAL_3_MEETING_ID",
    fallbackMeetingId: "87854281414",
  },
  {
    key: "LEADERSHIP_VIRTUAL_4",
    label: "CÍRCULO DE LIDERAZGO · Virtual 4",
    types: ["CIRCULO DE LIDERAZGO"],
    circles: ["Virtual 4"],
    env: "ZOOM_LEADERSHIP_VIRTUAL_4_MEETING_ID",
    fallbackMeetingId: "83462984009",
  },
  {
    key: "LEADERSHIP_VIRTUAL_5",
    label: "CÍRCULO DE LIDERAZGO · Virtual 5",
    types: ["CIRCULO DE LIDERAZGO"],
    circles: ["Virtual 5"],
    env: "ZOOM_LEADERSHIP_VIRTUAL_5_MEETING_ID",
    fallbackMeetingId: "82378993088",
  },
  {
    key: "HEALTH",
    label: "HEALTH · General",
    types: ["HEALTH"],
    circles: [],
    env: "ZOOM_HEALTH_MEETING_ID",
    fallbackMeetingId: "85757884631",
  },
  {
    key: "MASTERCLASS",
    label: "MASTERCLASS · General",
    types: ["MASTERCLASS"],
    circles: [],
    env: "ZOOM_MASTERCLASS_MEETING_ID",
    fallbackMeetingId: "88164887157",
  },
  {
    key: "MENTORIA_ANUNCIOS",
    label: "MENTORÍA / ANUNCIOS CORPORATIVOS · General",
    types: ["MENTORIA", "ANUNCIOS CORPORATIVOS"],
    circles: [],
    env: "ZOOM_MENTORIA_ANUNCIOS_MEETING_ID",
    fallbackMeetingId: "81367253393",
  },
];

const getConfiguredMeetings = () => {
  return CONFIG.map((item) => {
    const meetingId = normalizeMeetingId(
      process.env[item.env] || item.fallbackMeetingId
    );

    if (!meetingId) return null;

    return {
      key: item.key,
      label: item.label,
      meetingId,
      env: item.env,
      types: [...item.types],
      type: item.types[0],
      circles: [...item.circles],
      isGeneral: item.circles.length === 0,
    };
  }).filter(Boolean);
};

const getMeetingConfigById = (meetingId) => {
  const normalized = normalizeMeetingId(meetingId);
  if (!normalized) return null;

  return (
    getConfiguredMeetings().find((item) => item.meetingId === normalized) ||
    null
  );
};

const getSessionTypeByMeetingId = (meetingId, preferredType = "") => {
  const config = getMeetingConfigById(meetingId);
  if (!config) return null;

  const normalizedPreferred = String(preferredType || "")
    .trim()
    .toUpperCase()
    .replace("MENTORÍA", "MENTORIA");

  if (
    normalizedPreferred &&
    config.types.includes(normalizedPreferred)
  ) {
    return {
      ...config,
      type: normalizedPreferred,
    };
  }

  if (config.types.length === 1) {
    return {
      ...config,
      type: config.types[0],
    };
  }

  return {
    ...config,
    type: "",
  };
};

module.exports = {
  normalizeMeetingId,
  getConfiguredMeetings,
  getMeetingConfigById,
  getSessionTypeByMeetingId,
};
