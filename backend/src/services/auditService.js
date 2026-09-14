const AuditLog = require("../models/AuditLog");

const createAuditLog = async ({
  admin,
  action,
  module,
  description = "",
  targetId = "",
  targetName = "",
  circle = "",
  reversible = false,
  metadata = {},
}) => {
  try {
    const log = await AuditLog.create({
      adminId: admin?.adminId || "",
      adminName: admin?.name || "",
      adminRole: admin?.role || "",
      action,
      module,
      description,
      targetId: targetId ? String(targetId) : "",
      targetName,
      circle,
      reversible: Boolean(reversible),
      undone: false,
      metadata,
    });

    return log;
  } catch (error) {
    /*
     * La bitácora nunca debe tumbar una operación
     * principal del sistema.
     */
    console.error("Error creando bitácora:", error.message);
    return null;
  }
};

module.exports = { createAuditLog };
