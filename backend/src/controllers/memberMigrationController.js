const Schedule = require("../models/Schedule");

const {
  buildPreview,
  executeMigration,
} = require("../services/memberMigrationService");

const getMigrationOptions = async (req, res) => {
  try {
    const schedules = await Schedule.find({})
      .sort({ active: -1, startDate: -1, createdAt: -1 })
      .lean();

    return res.json({ schedules });
  } catch (error) {
    console.error(
      "Error obteniendo opciones de migración:",
      error
    );

    return res.status(500).json({
      message: "No se pudieron cargar las programaciones de migración.",
    });
  }
};

const previewMemberMigration = async (req, res) => {
  try {
    const {
      userId,
      originScheduleId,
      destinationScheduleId,
      originCircle,
      destinationCircle,
    } = req.body;

    const preview = await buildPreview({
      userId,
      originScheduleId,
      destinationScheduleId,
      originCircle,
      destinationCircle,
    });

    return res.json(preview);
  } catch (error) {
    console.error(
      "Error preparando migración de miembro:",
      error
    );

    return res.status(400).json({
      message:
        error.message ||
        "No se pudo preparar la migración.",
    });
  }
};

const migrateMember = async (req, res) => {
  try {
    const {
      userId,
      originScheduleId,
      destinationScheduleId,
      originCircle,
      destinationCircle,
    } = req.body;

    const result = await executeMigration({
      userId,
      originScheduleId,
      destinationScheduleId,
      originCircle,
      destinationCircle,
      migratedBy:
        req.user?.adminId ||
        req.user?.name ||
        "Sistema",
    });

    return res.json({
      message:
        "Miembro migrado y sesiones convalidadas correctamente.",
      ...result,
    });
  } catch (error) {
    console.error(
      "Error migrando miembro:",
      error
    );

    return res.status(400).json({
      message:
        error.message ||
        "No se pudo realizar la migración.",
    });
  }
};

module.exports = {
  getMigrationOptions,
  previewMemberMigration,
  migrateMember,
};
