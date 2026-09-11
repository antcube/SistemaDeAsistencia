import api from "./api";

const dashboardService = {
  async getDashboard(year, month) {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });

    return api.get(`/dashboard?${params.toString()}`);
  },
};

export default dashboardService;