const API_URL = "/api";

const getToken = () => localStorage.getItem("authToken");

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const importService = {
  async downloadTemplate() {
    const response = await fetch(`${API_URL}/import/users/template`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      let message = "No se pudo descargar la plantilla.";
      try { const data = await response.json(); message = data.message || message; } catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "plantilla_miembros.xlsx";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },

  async previewUsers(file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_URL}/import/users/preview`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "No se pudo leer el archivo Excel.");
    return data;
  },

  async uploadUsers(file, targetCircle) {
    if (!targetCircle) throw new Error("Selecciona el círculo destino.");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("targetCircle", targetCircle);
    const response = await fetch(`${API_URL}/import/users`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "No se pudo importar el archivo.");
    return data;
  },
};

export default importService;
