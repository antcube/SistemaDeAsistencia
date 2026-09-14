import api from "./api";

const auditService = {
  async getLogs({ page = 1, limit = 50, circle = "" } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));

    const normalizedCircle = String(circle || "").trim();
    if (normalizedCircle) {
      params.set("circle", normalizedCircle);
    }

    return api.get(`/audit?${params.toString()}`);
  },

  async undoLog(logId) {
    if (!logId) {
      throw new Error("No se especificó el registro que se desea deshacer.");
    }

    return api.post(`/audit/${encodeURIComponent(logId)}/undo`, {});
  },
};

export default auditService;
