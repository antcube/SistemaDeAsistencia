import api from "./api";

const auditService = {
  async getLogs({
    page = 1,
    limit = 50,
    search = "",
    module = "",
    action = "",
    circle = "",
  } = {}) {
    const params = new URLSearchParams();

    params.set(
      "page",
      String(page)
    );

    params.set(
      "limit",
      String(limit)
    );

    if (search.trim()) {
      params.set(
        "search",
        search.trim()
      );
    }

    if (module.trim()) {
      params.set(
        "module",
        module.trim()
      );
    }

    if (action.trim()) {
      params.set(
        "action",
        action.trim()
      );
    }

    if (circle.trim()) {
      params.set(
        "circle",
        circle.trim()
      );
    }

    return api.get(
      `/audit?${params.toString()}`
    );
  },
};

export default auditService;