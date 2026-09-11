import api from "./api";

const reportService = {
  async getMonthlyReport(
    year,
    month,
    circle = ""
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "year",
      String(year)
    );

    params.set(
      "month",
      String(month)
    );

    if (circle) {
      params.set(
        "circle",
        circle
      );
    }

    return api.get(
      `/reports/monthly?${params.toString()}`
    );
  },
};

export default reportService;