const API_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

const getToken = () => localStorage.getItem("authToken");

const sendForm = async (endpoint, file, year, month, expectBlob = false) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("year", String(year));
  formData.append("month", String(month));

  const token = getToken();
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : {},
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "No se pudo procesar el archivo de bonos.");
  }

  if (expectBlob) {
    return response.blob();
  }

  return response.json();
};

const bonusService = {
  preview(file, year, month) {
    return sendForm("/bonuses/preview", file, year, month, false);
  },

  async download(file, year, month) {
    const blob = await sendForm("/bonuses/process", file, year, month, true);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bonos_${year}_${String(month).padStart(2, "0")}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default bonusService;
