import api from "./api";

const scheduleService = {
  async getSchedules(circle = "") {
    const params =
      new URLSearchParams();

    if (circle) {
      params.set(
        "circle",
        circle
      );
    }

    const query =
      params.toString();

    return api.get(
      query
        ? `/schedules?${query}`
        : "/schedules"
    );
  },

  async getScheduleById(id) {
    return api.get(
      `/schedules/${id}`
    );
  },

  async createSchedule(data) {
    return api.post(
      "/schedules",
      data
    );
  },

  async updateSchedule(
    id,
    data
  ) {
    return api.put(
      `/schedules/${id}`,
      data
    );
  },

  async generateMonth(
    id,
    year,
    month
  ) {
    return api.post(
      `/schedules/${id}/generate-month`,
      {
        year,
        month,
      }
    );
  },

  async migrateSchedule(
    id,
    data
  ) {
    return api.post(
      `/schedules/${id}/migrate`,
      data
    );
  },

  async terminateFromDate(
    id,
    effectiveDate
  ) {
    return api.post(
      `/schedules/${id}/terminate-from-date`,
      {
        effectiveDate,
      }
    );
  },

  async restoreSchedule(id) {
    return api.post(
      `/schedules/${id}/restore`,
      {}
    );
  },
};

export default scheduleService;