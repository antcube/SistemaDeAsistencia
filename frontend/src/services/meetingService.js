import api from "./api";

const meetingService = {
  async getMeetings(
    year,
    month,
    filters = {}
  ) {
    const params = new URLSearchParams();

    params.set(
      "year",
      String(year)
    );

    params.set(
      "month",
      String(month)
    );

    if (filters.circle) {
      params.set(
        "circle",
        filters.circle
      );
    }

    if (filters.type) {
      params.set(
        "type",
        filters.type
      );
    }

    return api.get(
      `/meetings?${params.toString()}`
    );
  },

  async getMeetingById(id) {
    return api.get(
      `/meetings/${id}`
    );
  },

  async getPublicQrMeeting(id) {
    if (!id) {
      throw new Error(
        "No se recibió el identificador de la reunión."
      );
    }

    return api.get(
      `/meetings/qr/${encodeURIComponent(id)}`
    );
  },

  async createMeeting(data) {
    return api.post(
      "/meetings",
      data
    );
  },

  async updateMeeting(
    id,
    data
  ) {
    return api.put(
      `/meetings/${id}`,
      data
    );
  },

  async deleteMeeting(id) {
    return api.delete(
      `/meetings/${id}`
    );
  },

  async restoreMeeting(id) {
    return api.post(
      `/meetings/${id}/restore`,
      {}
    );
  },

  async activateQr(
    id,
    durationMinutes = 10
  ) {
    return api.post(
      `/meetings/${id}/qr/activate`,
      {
        durationMinutes,
      }
    );
  },

  async deactivateQr(id) {
    return api.post(
      `/meetings/${id}/qr/deactivate`,
      {}
    );
  },

  /**
   * ============================================================
   * CREAR MASTERCLASS DEL MES
   * ============================================================
   *
   * REGLA:
   * La Masterclass mensual es GLOBAL.
   *
   * Al pulsar el botón:
   * - Se toma TODOS los círculos existentes.
   * - Se crean las fechas de Masterclass para TODOS.
   * - El círculo seleccionado del calendario NO limita esta acción.
   * - Si una Masterclass ya existe para una fecha + círculo,
   *   no se vuelve a crear.
   */
  async createMonthlyMasterclasses(
    year,
    month,
    circles = []
  ) {
    const cleanCircles = [
      ...new Set(
        circles
          .map((circle) =>
            typeof circle === "string"
              ? circle
              : circle?.name
          )
          .filter(Boolean)
          .map((circle) =>
            String(circle).trim()
          )
      ),
    ];

    if (!cleanCircles.length) {
      throw new Error(
        "No hay círculos disponibles para crear las Masterclass."
      );
    }

    /*
     * Buscar TODAS las reuniones del mes.
     *
     * IMPORTANTE:
     * NO enviamos circle aquí.
     * Necesitamos conocer las Masterclass existentes
     * de todos los círculos para evitar duplicados.
     */
    const existingResponse =
      await this.getMeetings(
        year,
        month,
        {}
      );

    const existingMeetings =
      Array.isArray(existingResponse)
        ? existingResponse
        : Array.isArray(
            existingResponse?.data
          )
        ? existingResponse.data
        : Array.isArray(
            existingResponse?.meetings
          )
        ? existingResponse.meetings
        : [];

    const existingMasterclasses =
      new Set(
        existingMeetings
          .filter(
            (meeting) =>
              String(
                meeting?.type || ""
              )
                .trim()
                .toUpperCase() ===
              "MASTERCLASS"
          )
          .map(
            (meeting) =>
              `${String(
                meeting?.date || ""
              ).slice(0, 10)}|${String(
                meeting?.circle || ""
              )
                .trim()
                .toLowerCase()}`
          )
      );

    /*
     * Buscar todos los viernes del mes.
     */
    const fridayDates = [];

    const daysInMonth =
      new Date(
        year,
        month,
        0
      ).getDate();

    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      const date =
        new Date(
          year,
          month - 1,
          day
        );

      // 5 = viernes
      if (
        date.getDay() === 5
      ) {
        fridayDates.push(
          `${year}-${String(
            month
          ).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`
        );
      }
    }

    const created = [];
    const skipped = [];

    /*
     * Crear para TODOS los círculos.
     */
    for (
      const date of fridayDates
    ) {
      for (
        const circle of cleanCircles
      ) {
        const key =
          `${date}|${String(
            circle
          )
            .trim()
            .toLowerCase()}`;

        /*
         * Si ya existe:
         * NO duplicar.
         */
        if (
          existingMasterclasses.has(
            key
          )
        ) {
          skipped.push({
            date,
            circle,
          });

          continue;
        }

        const result =
          await this.createMeeting({
            title:
              "MASTERCLASS",

            type:
              "MASTERCLASS",

            circle,

            host: "",

            date,

            time: "19:00",

            endTime: "20:00",

            location: "",
          });

        const meeting =
          result?.meeting ||
          result;

        created.push(
          meeting
        );

        /*
         * Agregar inmediatamente al Set
         * para evitar duplicados dentro
         * de esta misma ejecución.
         */
        existingMasterclasses.add(
          key
        );
      }
    }

    return {
      year,
      month,

      fridayDates,

      circles:
        cleanCircles,

      created,

      skipped,

      total:
        created.length,

      totalSkipped:
        skipped.length,
    };
  },

  /**
   * ============================================================
   * ELIMINAR MASTERCLASS DEL MES — GLOBAL
   * ============================================================
   *
   * IMPORTANTE:
   *
   * Esta función NO depende del círculo seleccionado
   * en el calendario.
   *
   * Obtiene todas las reuniones del mes y elimina
   * todas las MASTERCLASS encontradas.
   */
  async deleteMonthlyMasterclasses(
    year,
    month
  ) {
    /*
     * IMPORTANTE:
     * Sin filtro de círculo.
     */
    const response =
      await this.getMeetings(
        year,
        month,
        {}
      );

    const allMeetings =
      Array.isArray(response)
        ? response
        : Array.isArray(
            response?.data
          )
        ? response.data
        : Array.isArray(
            response?.meetings
          )
        ? response.meetings
        : [];

    const masterclasses =
      allMeetings.filter(
        (meeting) =>
          String(
            meeting?.type || ""
          )
            .trim()
            .toUpperCase() ===
          "MASTERCLASS"
      );

    if (!masterclasses.length) {
      return {
        year,
        month,
        deleted: [],
        total: 0,
      };
    }

    const deleted = [];

    for (
      const meeting of masterclasses
    ) {
      const id =
        meeting?._id ||
        meeting?.id;

      if (!id) {
        continue;
      }

      await this.deleteMeeting(
        id
      );

      deleted.push({
        id,
        circle:
          meeting?.circle || "",
        date:
          meeting?.date || "",
      });
    }

    return {
      year,
      month,
      deleted,
      total:
        deleted.length,
    };
  },
};

export default meetingService;