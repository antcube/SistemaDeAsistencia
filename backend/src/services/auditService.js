const AuditLog = require("../models/AuditLog");

const createAuditLog = async ({
  admin,
  action,
  module,
  description = "",
  targetId = "",
  targetName = "",
  circle = "",
  metadata = {},
}) => {
  try {
    const log = await AuditLog.create({
      adminId:
        admin?.adminId || "",

      adminName:
        admin?.name || "",

      action,

      module,

      description,

      targetId:
        targetId
          ? String(targetId)
          : "",

      targetName,

      circle,

      metadata,
    });

    return log;
  } catch (error) {
    /*
     * La bitácora nunca debe tumbar una operación
     * principal del sistema.
     */
    console.error(
      "Error creando bitácora:",
      error.message
    );

    return null;
  }
};

module.exports = {
  createAuditLog,
};