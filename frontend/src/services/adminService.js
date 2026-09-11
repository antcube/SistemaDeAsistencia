import api from "./api";

const adminService = {
  async getAdmins() {
    return api.get("/admins");
  },

  async getAdminById(id) {
    return api.get(`/admins/${id}`);
  },

  async createAdmin(data) {
    return api.post("/admins", data);
  },

  async updateAdmin(id, data) {
    return api.put(`/admins/${id}`, data);
  },

  async deleteAdmin(id) {
    return api.delete(`/admins/${id}`);
  },
};

export default adminService;