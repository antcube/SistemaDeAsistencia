const ZOOM_API_BASE = "https://api.zoom.us/v2";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";

let cachedToken = "";
let cachedTokenExpiresAt = 0;

const requireEnv = (name) => {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`Falta configurar ${name} en Railway.`);
  }

  return value;
};

const getAccessToken = async () => {
  const now = Date.now();

  if (cachedToken && cachedTokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  const accountId = requireEnv("ZOOM_ACCOUNT_ID");
  const clientId = requireEnv("ZOOM_CLIENT_ID");
  const clientSecret = requireEnv("ZOOM_CLIENT_SECRET");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const url = `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.reason ||
        data.error ||
        data.message ||
        "Zoom no pudo generar el access token."
    );
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + Math.max(60, Number(data.expires_in || 3600)) * 1000;

  return cachedToken;
};

const zoomFetch = async (path) => {
  const token = await getAccessToken();

  const response = await fetch(`${ZOOM_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message || data.reason || `Zoom respondió HTTP ${response.status}.`
    );
    error.status = response.status;
    error.zoomCode = data.code;
    throw error;
  }

  return data;
};

const encodeMeetingUuid = (uuid) => {
  const raw = String(uuid || "");
  const once = encodeURIComponent(raw);

  if (raw.startsWith("/") || raw.includes("//")) {
    return encodeURIComponent(once);
  }

  return once;
};

const listPastInstances = async (meetingId) => {
  const cleanId = String(meetingId || "").replace(/\D/g, "");

  if (!cleanId) {
    throw new Error("Meeting ID inválido.");
  }

  const data = await zoomFetch(`/past_meetings/${cleanId}/instances`);
  return Array.isArray(data.meetings) ? data.meetings : [];
};

const listParticipantsForInstance = async (uuid) => {
  const encodedUuid = encodeMeetingUuid(uuid);
  const participants = [];
  let nextPageToken = "";

  do {
    const query = new URLSearchParams({ page_size: "300" });

    if (nextPageToken) {
      query.set("next_page_token", nextPageToken);
    }

    const data = await zoomFetch(
      `/past_meetings/${encodedUuid}/participants?${query.toString()}`
    );

    if (Array.isArray(data.participants)) {
      participants.push(...data.participants);
    }

    nextPageToken = String(data.next_page_token || "").trim();
  } while (nextPageToken);

  return participants;
};

module.exports = {
  getAccessToken,
  listPastInstances,
  listParticipantsForInstance,
};