import api from "./api";

const attendanceService = {
  async getMonthAttendance(
    year,
    month,
    filters = {}
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

    if (
      filters.doc?.trim()
    ) {
      params.set(
        "doc",
        filters.doc.trim()
      );
    }

    if (
      filters.circle?.trim()
    ) {
      params.set(
        "circle",
        filters.circle.trim()
      );
    }

    return api.get(
      `/attendance/month?${params.toString()}`
    );
  },

  async getMeetingAttendance(
    meetingId
  ) {
    return api.get(
      `/attendance/meeting/${meetingId}`
    );
  },

  async getUserAttendance(
    doc,
    year,
    month
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "dni",
      String(doc).trim()
    );

    params.set(
      "year",
      String(year)
    );

    params.set(
      "month",
      String(month)
    );

    return api.get(
      `/attendance/monthly-by-dni?${params.toString()}`
    );
  },

  async registerAttendance(
    data
  ) {
    return api.post(
      "/attendance",
      {
        ...data,

        meetingId:
          data.meetingId ||
          data.meeting ||
          "",

        doc:
          data.doc ||
          data.dni ||
          "",

        status:
          data.status ||
          "No asistió",

        justificationReason:
          data.justificationReason ||
          "",

        source:
          data.source ||
          "ADMIN",

        attendanceMode:
          data.attendanceMode ||
          (data.status ===
          "Clase Presencial"
            ? "PRESENCIAL"
            : "MANUAL"),
      }
    );
  },

  async deleteAttendance(
    id
  ) {
    return api.delete(
      `/attendance/${id}`
    );
  },

  async countMonthlyJustifications(
    userId,
    type,
    year,
    month
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "userId",
      userId
    );

    params.set(
      "type",
      type
    );

    params.set(
      "year",
      String(year)
    );

    params.set(
      "month",
      String(month)
    );

    return api.get(
      `/attendance/justifications/count?${params.toString()}`
    );
  },

  async getJustificationLimit(
    type
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "type",
      type
    );

    return api.get(
      `/attendance/justifications/limit?${params.toString()}`
    );
  },

  async registerByQr(
    meetingId,
    dni
  ) {
    return api.post(
      "/attendance/qr",
      {
        meetingId,
        dni,
      }
    );
  },
};

export default attendanceService;