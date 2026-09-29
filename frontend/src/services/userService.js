import api from "./api";

const userService = {
  async getUsers({
    search = "",
    circle = "",
    mode = "",
    page = 1,
    limit = 50,
  } = {}) {
    const params = new URLSearchParams();

    params.set(
      "page",
      String(page)
    );

    params.set(
      "limit",
      String(limit)
    );

    if (search.trim()) {
      params.set(
        "search",
        search.trim()
      );
    }

    if (circle.trim()) {
      params.set(
        "circle",
        circle.trim()
      );
    }

    if (mode.trim()) {
      params.set(
        "mode",
        mode.trim()
      );
    }

    return api.get(
      `/users?${params.toString()}`
    );
  },

  async getUserById(id) {
    return api.get(
      `/users/${id}`
    );
  },

  async getRangeHistory(id) {
    return api.get(
      `/users/${id}/range-history`
    );
  },

  async createUser(data) {
    return api.post(
      "/users",
      data
    );
  },

  async updateUser(
    id,
    data
  ) {
    return api.put(
      `/users/${id}`,
      data
    );
  },

  async deleteUser(id) {
    return api.delete(
      `/users/${id}`
    );
  },

  // ============================================================
  // ELIMINAR TODOS LOS MIEMBROS DE UN CÍRCULO
  // ============================================================
  async deleteUsersByCircle(circle) {
    return api.delete(
      `/users/circle/${encodeURIComponent(circle)}/all`
    );
  },
};

export default userService;