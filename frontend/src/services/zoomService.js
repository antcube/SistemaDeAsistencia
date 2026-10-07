import api from "./api";

const API_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

const zoomService = {
  async getInfo() {
    return api.get(
      "/zoom/info"
    );
  },

  async processReport(
    formData
  ) {
    const token =
      localStorage.getItem(
        "authToken"
      );

    const response =
      await fetch(
        `${API_URL}/zoom/process`,
        {
          method: "POST",

          headers: token
            ? {
                Authorization:
                  `Bearer ${token}`,
              }
            : {},

          body: formData,
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (
      !response.ok
    ) {
      throw new Error(
        data.message ||
          "No se pudo procesar el reporte de Zoom."
      );
    }

    return data;
  },
};

export default zoomService;