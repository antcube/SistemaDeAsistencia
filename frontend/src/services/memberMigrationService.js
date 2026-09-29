import api from "./api";

const memberMigrationService = {
  async preview(data) {
    return api.post(
      "/member-migrations/preview",
      data
    );
  },

  async migrate(data) {
    return api.post(
      "/member-migrations",
      data
    );
  },
};

export default memberMigrationService;
