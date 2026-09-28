import api from "./api";

const dashboardService = {
  async getDashboard(year, month, circle = "", week = null) {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });

    if (circle) params.set("circle", String(circle));
    if (week !== null && week !== undefined && week !== "") {
      params.set("week", String(week));
    }

    return api.get(`/dashboard?${params.toString()}`);
  },
};

export default dashboardService;
