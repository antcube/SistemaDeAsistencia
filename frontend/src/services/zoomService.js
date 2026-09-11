import api from "./api";

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
        "/api/zoom/process",
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