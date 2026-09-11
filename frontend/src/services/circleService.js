import api from "./api";

const circleService = {
  async getCircles() {
    return api.get("/circles");
  },

  async getCircleById(id) {
    return api.get(`/circles/${id}`);
  },

  async createCircle(data) {
    return api.post("/circles", data);
  },

  async updateCircle(id, data) {
    return api.put(`/circles/${id}`, data);
  },

  async deleteCircle(id) {
    return api.delete(`/circles/${id}`);
  },
};

export default circleService;