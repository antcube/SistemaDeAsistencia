const MemberMigration = require("../models/MemberMigration");

const normalizePeriod = (year, month) =>
  `${Number(year)}-${String(Number(month)).padStart(2, "0")}`;

const getMigrationPeriod = (migration) => {
  const explicitPeriod = String(migration?.effectivePeriod || "").trim();

  if (/^\d{4}-\d{2}$/.test(explicitPeriod)) {
    return explicitPeriod;
  }

  // Compatibilidad con migraciones antiguas que todavía no tengan
  // effectivePeriod guardado.
  const date = new Date(
    migration?.migratedAt || migration?.createdAt || 0
  );

  if (Number.isNaN(date.getTime())) {
    return "0000-00";
  }

  return normalizePeriod(
    date.getFullYear(),
    date.getMonth() + 1
  );
};

const resolveCircleFromMigrations = ({
  user,
  migrations = [],
  year,
  month,
}) => {
  const targetPeriod = normalizePeriod(year, month);
  const ordered = [...migrations]
    .filter((migration) => migration?.status !== "CANCELLED")
    .sort((a, b) => {
      const periodCompare = getMigrationPeriod(a).localeCompare(
        getMigrationPeriod(b)
      );

      if (periodCompare !== 0) {
        return periodCompare;
      }

      const aDate = new Date(a.migratedAt || a.createdAt || 0).getTime();
      const bDate = new Date(b.migratedAt || b.createdAt || 0).getTime();
      return aDate - bDate;
    });

  if (!ordered.length) {
    return String(user?.circle || "").trim();
  }

  // Antes de la primera migración, el círculo histórico es el origen
  // de esa primera migración, no el círculo actual del usuario.
  let effectiveCircle = String(
    ordered[0]?.sourceCircle || user?.circle || ""
  ).trim();

  for (const migration of ordered) {
    if (getMigrationPeriod(migration) > targetPeriod) {
      break;
    }

    effectiveCircle = String(
      migration?.targetCircle || effectiveCircle
    ).trim();
  }

  return effectiveCircle || String(user?.circle || "").trim();
};

const resolveEffectiveCircleForPeriod = async ({
  user,
  year,
  month,
}) => {
  if (!user?._id) {
    return String(user?.circle || "").trim();
  }

  const migrations = await MemberMigration.find({
    member: user._id,
    status: { $ne: "CANCELLED" },
  })
    .sort({ migratedAt: 1, createdAt: 1 })
    .lean();

  return resolveCircleFromMigrations({
    user,
    migrations,
    year,
    month,
  });
};

const buildEffectiveCircleMap = async ({
  users = [],
  year,
  month,
}) => {
  const map = new Map();

  if (!users.length) {
    return map;
  }

  const userIds = users.map((user) => user._id);
  const migrations = await MemberMigration.find({
    member: { $in: userIds },
    status: { $ne: "CANCELLED" },
  })
    .sort({ migratedAt: 1, createdAt: 1 })
    .lean();

  const migrationsByUser = new Map();

  for (const migration of migrations) {
    const key = String(migration.member);

    if (!migrationsByUser.has(key)) {
      migrationsByUser.set(key, []);
    }

    migrationsByUser.get(key).push(migration);
  }

  for (const user of users) {
    const key = String(user._id);

    map.set(
      key,
      resolveCircleFromMigrations({
        user,
        migrations: migrationsByUser.get(key) || [],
        year,
        month,
      })
    );
  }

  return map;
};

module.exports = {
  resolveEffectiveCircleForPeriod,
  buildEffectiveCircleMap,
};
