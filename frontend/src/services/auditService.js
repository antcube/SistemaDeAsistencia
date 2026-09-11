import api from "./api";

const auditService = {

  async getLogs({
    page = 1,
    limit = 50,
    circle = "",
  } = {}) {

    const params =
      new URLSearchParams();

    params.set(
      "page",
      String(page)
    );

    params.set(
      "limit",
      String(limit)
    );

    const normalizedCircle =
      String(
        circle || ""
      ).trim();

    if (
      normalizedCircle
    ) {
      params.set(
        "circle",
        normalizedCircle
      );
    }

    return api.get(
      `/audit?${params.toString()}`
    );
  },

};

export default auditService;