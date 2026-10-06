const Schedule = require("../models/Schedule");
const { createAuditLog } = require("../services/auditService");

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
      migrationPeriod,
    } = req.body;

    const preview = await buildPreview({
      userId,
      originScheduleId,
      destinationScheduleId,
      originCircle,
      destinationCircle,
      migrationPeriod,
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
      migrationPeriod,
    } = req.body;

    const result = await executeMigration({
      userId,
      originScheduleId,
      destinationScheduleId,
      originCircle,
      destinationCircle,
      migrationPeriod,
      migratedBy:
        req.user?.adminId ||
        req.user?.name ||
        "Sistema",
    });

    const migration = result.migration;

    await createAuditLog({
      admin: req.user || req.admin,
      action: "MIGRATE_MEMBER",
      module: "member_migrations",
      description: result.scheduled
        ? `${migration.memberName || "Miembro"} fue programado para migrar de ${result.sourceCircle} a ${result.targetCircle} desde ${result.migrationPeriod}.`
        : `${migration.memberName || "Miembro"} fue migrado de ${result.sourceCircle} a ${result.targetCircle} desde ${result.migrationPeriod}. Se convalidaron ${result.migratedSessions} sesión(es).`,
      targetId: migration._id,
      targetName: migration.memberName || migration.memberDoc || "Miembro",
      circle: `${result.sourceCircle}, ${result.targetCircle}`,
      reversible: true,
      metadata: {
        migrationId: migration._id,
        memberId: migration.member,
        memberDoc: migration.memberDoc || "",
        memberName: migration.memberName || "",
        sourceCircle: result.sourceCircle,
        targetCircle: result.targetCircle,
        effectivePeriod: result.migrationPeriod,
        migrationStatus: migration.status,
        scheduled: Boolean(result.scheduled),
        migratedSessions: result.migratedSessions,
      },
    });

    return res.json({
      message: result.scheduled
        ? `Migración programada correctamente desde ${result.migrationPeriod}.`
        : "Miembro migrado y sesiones convalidadas correctamente.",
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
