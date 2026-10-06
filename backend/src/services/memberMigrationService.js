const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Meeting = require("../models/Meeting");
const MemberMigration = require("../models/MemberMigration");
const {
  resolveEffectiveCircleForPeriod,
} = require("./memberCircleHistoryService");

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const normalizeCircle = (value) =>
  normalizeText(value);

const escapeRegex = (value) =>
  String(value || "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

const isActive = (document) =>
  document?.active !== false;

const attendanceSnapshot = (attendance) => {
  if (!attendance) return null;

  const raw = attendance.toObject ? attendance.toObject() : attendance;

  return {
    active: raw.active !== false,
    doc: raw.doc || "",
    name: raw.name || "",
    circle: raw.circle || "",
    status: raw.status || "",
    justificationReason: raw.justificationReason || "",
    justifiedBy: raw.justifiedBy || "",
    justifiedAt: raw.justifiedAt || null,
    registeredBy: raw.registeredBy || "",
    source: raw.source || "",
    attendanceMode: raw.attendanceMode || "",
    attendedAt: raw.attendedAt || null,
    note: raw.note || "",
    notes: raw.notes || "",
    registeredAt: raw.registeredAt || null,
    deletedAt: raw.deletedAt || null,
    deletedBy: raw.deletedBy || "",
  };
};

const sortMeetings = (meetings) =>
  [...meetings].sort((a, b) => {
    const dateCompare = String(
      a.date || ""
    ).localeCompare(
      String(b.date || "")
    );

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return String(
      a.time || ""
    ).localeCompare(
      String(b.time || "")
    );
  });

/*
 * ============================================================
 * CATEGORÍA DE EQUIVALENCIA
 * ============================================================
 *
 * La migración NO compara las fechas de las reuniones.
 *
 * Cada una de estas categorías mantiene su propia numeración:
 *
 * CÍRCULO DE LIDERAZGO
 * HEALTH
 * MASTERCLASS
 * MENTORÍA
 * ANUNCIOS CORPORATIVOS
 *
 * Por ejemplo:
 *
 * Liderazgo sesión 1 (origen) -> Liderazgo sesión 1 (destino)
 * Liderazgo sesión 2 (origen) -> Liderazgo sesión 2 (destino)
 *
 * aunque las fechas sean diferentes.
 */
const meetingCategory = (meeting) => {
  const type = normalizeText(meeting?.type);
  const title = normalizeText(meeting?.title);
  const value = `${type} ${title}`;

  if (
    value.includes("liderazgo") ||
    value.includes("circulo de liderazgo")
  ) {
    return "circulo_liderazgo";
  }

  if (value.includes("health")) {
    return "health";
  }

  if (value.includes("masterclass")) {
    return "masterclass";
  }

  if (value.includes("mentoria")) {
    return "mentoria";
  }

  if (
    value.includes("anuncios corporativos") ||
    value.includes("anuncio corporativo")
  ) {
    return "anuncios_corporativos";
  }

  // Para cualquier categoría futura que no esté dentro de las cinco
  // principales, conservamos el tipo como clave independiente.
  return type || title || "sin_categoria";
};

/*
 * ============================================================
 * OBTENER ASISTENCIAS DEL MIEMBRO
 * ============================================================
 *
 * IMPORTANTE:
 *
 * active: { $ne: false }
 *
 * Esto incluye:
 *
 * active: true
 * active: undefined
 *
 * y solamente excluye:
 *
 * active: false
 *
 * Así no perdemos registros históricos creados antes
 * de implementar el soft delete.
 */
const getMemberAttendances = async ({
  userId,
  originCircle,
}) => {
  const records =
    await Attendance.find({
      user: userId,
      active: {
        $ne: false,
      },
    })
      .populate(
        "meeting",
        "title type circle date time endTime location scheduleId active"
      )
      .lean();

  const origin =
    normalizeCircle(originCircle);

  return records.filter((attendance) => {
    const meeting =
      attendance.meeting;

    if (!meeting) {
      return false;
    }

    /*
     * La reunión también puede haber sido eliminada
     * mediante soft delete.
     */
    if (meeting.active === false) {
      return false;
    }

    /*
     * IMPORTANTE:
     *
     * El círculo se determina por la reunión,
     * no por attendance.circle.
     */
    return (
      normalizeCircle(
        meeting.circle
      ) === origin
    );
  });
};

/*
 * ============================================================
 * OBTENER REUNIONES DE UN CÍRCULO
 * ============================================================
 */
const getCircleMeetings = async ({
  circle,
}) => {
  const query = {
    circle: {
      $regex: new RegExp(
        `^${escapeRegex(circle)}$`,
        "i"
      ),
    },

    active: {
      $ne: false,
    },
  };

  const meetings =
    await Meeting.find(query)
      .select(
        "title type circle date time endTime location scheduleId active"
      )
      .lean();

  return sortMeetings(meetings);
};

/*
 * ============================================================
 * AGRUPAR REUNIONES POR CATEGORÍA + MES
 * ============================================================
 *
 * La equivalencia de una migración se calcula por NÚMERO DE
 * SESIÓN DENTRO DEL MES, no por fecha exacta ni por día de la
 * semana.
 *
 * Ejemplo:
 *
 * Círculo origen (lunes)      Círculo destino (miércoles)
 * 06/10 -> sesión 1     =>    08/10 -> sesión 1
 * 13/10 -> sesión 2     =>    15/10 -> sesión 2
 * 20/10 -> sesión 3     =>    22/10 -> sesión 3
 *
 * Cada categoría mantiene su propia secuencia mensual.
 */
const getMeetingPeriod = (meeting) => {
  const date = String(meeting?.date || "").trim();
  const match = date.match(/^(\d{4})-(\d{2})-\d{2}$/);

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  // Fallback defensivo para registros antiguos con formatos no estándar.
  const parsed = new Date(date);

  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  return "sin_periodo";
};

const getCurrentMigrationPeriod = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

const normalizeMigrationPeriod = (value) => {
  const period = String(value || "").trim();

  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("Selecciona un mes válido para la migración.");
  }

  const [year, month] = period.split("-").map(Number);

  if (year < 2000 || month < 1 || month > 12) {
    throw new Error("Selecciona un mes válido para la migración.");
  }

  return `${year}-${String(month).padStart(2, "0")}`;
};

const periodToParts = (period) => {
  const normalized = normalizeMigrationPeriod(period);
  const [year, month] = normalized.split("-").map(Number);
  return { year, month };
};

const migrationGroupKey = (meeting) =>
  `${meetingCategory(meeting)}|${getMeetingPeriod(meeting)}`;

const groupMeetingsByCategoryAndPeriod = (meetings) => {
  const groups = new Map();

  for (const meeting of meetings) {
    const key = migrationGroupKey(meeting);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(meeting);
  }

  for (const [key, values] of groups) {
    groups.set(key, sortMeetings(values));
  }

  return groups;
};

/*
 * ============================================================
 * CONSTRUIR FILAS DE MIGRACIÓN
 * ============================================================
 */
const buildMigrationRows = async ({
  userId,
  originCircle,
  destinationCircle,
  migrationPeriod = getCurrentMigrationPeriod(),
}) => {
  /*
   * ==========================================================
   * REGLA DE MIGRACIÓN
   * ==========================================================
   *
   * 1. SOLO se convalida el mes en el que se realiza la migración.
   *    Los meses anteriores permanecen intactos en el círculo origen.
   *
   * 2. La equivalencia es por CATEGORÍA + NÚMERO DE SESIÓN DEL MES.
   *    La fecha exacta y el día de la semana NO intervienen.
   *
   * 3. Si origen tiene más sesiones que destino, se convalidan solo
   *    las primeras N sesiones que tengan equivalente en destino.
   *    Las sesiones sobrantes del origen NO bloquean la migración y
   *    se conservan únicamente como historial del círculo anterior.
   */

  const sourceAttendances = await getMemberAttendances({
    userId,
    originCircle,
  });

  if (!sourceAttendances.length) {
    return {
      rows: [],
      missingDestinationSessions: 0,
      skippedOriginSessions: 0,
      migrationPeriod,
    };
  }

  const sourceMeetings = await getCircleMeetings({
    circle: originCircle,
  });

  const destinationMeetings = await getCircleMeetings({
    circle: destinationCircle,
  });

  const sourceGroups = groupMeetingsByCategoryAndPeriod(sourceMeetings);
  const destinationGroups = groupMeetingsByCategoryAndPeriod(destinationMeetings);

  const attendanceByMeeting = new Map();

  for (const attendance of sourceAttendances) {
    if (!attendance.meeting?._id) {
      continue;
    }

    attendanceByMeeting.set(
      String(attendance.meeting._id),
      attendance
    );
  }

  const rows = [];
  let skippedOriginSessions = 0;

  for (const [groupKey, sourceGroup] of sourceGroups.entries()) {
    const [category, period] = groupKey.split("|");

    /*
     * El historial de meses anteriores NO se toca.
     * Tampoco adelantamos información de meses futuros.
     */
    if (period !== migrationPeriod) {
      continue;
    }

    const destinationGroup = destinationGroups.get(groupKey) || [];

    /*
     * Solo existen equivalencias hasta donde existan sesiones
     * en AMBOS círculos.
     *
     * Ejemplo:
     * Origen:  5 sesiones
     * Destino: 4 sesiones
     * => se pueden convalidar sesiones 1..4.
     * => la sesión 5 queda únicamente en el historial origen.
     */
    const equivalentSessionCount = Math.min(
      sourceGroup.length,
      destinationGroup.length
    );

    for (let index = 0; index < sourceGroup.length; index += 1) {
      const sourceMeeting = sourceGroup[index];
      const attendance = attendanceByMeeting.get(
        String(sourceMeeting._id)
      );

      // Si el miembro no tiene estado registrado en esa sesión,
      // no hay nada que convalidar.
      if (!attendance) {
        continue;
      }

      // Sesión del origen sin equivalente en destino:
      // se conserva en origen y NO bloquea la migración.
      if (index >= equivalentSessionCount) {
        skippedOriginSessions += 1;
        continue;
      }

      const destinationMeeting = destinationGroup[index];
      const sessionNumber = index + 1;

      rows.push({
        category,
        period,
        sessionNumber,

        originMeeting: {
          _id: sourceMeeting._id,
          date: sourceMeeting.date,
          time: sourceMeeting.time,
          title: sourceMeeting.title,
          type: sourceMeeting.type,
        },

        destinationMeeting: {
          _id: destinationMeeting._id,
          date: destinationMeeting.date,
          time: destinationMeeting.time,
          title: destinationMeeting.title,
          type: destinationMeeting.type,
        },

        status:
          attendance.status === "Faltó"
            ? "No asistió"
            : attendance.status || "No asistió",
      });
    }
  }

  rows.sort((a, b) => {
    const categoryCompare = String(a.category || "").localeCompare(
      String(b.category || "")
    );

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return Number(a.sessionNumber || 0) - Number(b.sessionNumber || 0);
  });

  return {
    rows,
    // Ya no se considera error que sobren sesiones en origen.
    missingDestinationSessions: 0,
    skippedOriginSessions,
    migrationPeriod,
  };
};

/*
 * ============================================================
 * PREVIEW
 * ============================================================
 */
const buildPreview = async ({
  userId,
  destinationCircle,
  migrationPeriod = getCurrentMigrationPeriod(),
}) => {
  if (!userId) {
    throw new Error(
      "El miembro es obligatorio."
    );
  }

  if (!destinationCircle) {
    throw new Error(
      "El círculo de destino es obligatorio."
    );
  }

  const user =
    await User.findById(
      userId
    ).lean();

  if (!user) {
    throw new Error(
      "Miembro no encontrado."
    );
  }

  const normalizedMigrationPeriod = normalizeMigrationPeriod(migrationPeriod);
  const { year: migrationYear, month: migrationMonth } =
    periodToParts(normalizedMigrationPeriod);

  // El círculo de origen corresponde al círculo efectivo que el
  // miembro tendrá al inicio del mes seleccionado. Esto permite
  // encadenar migraciones históricas/futuras sin perder trazabilidad.
  const originCircle = String(
    await resolveEffectiveCircleForPeriod({
      user,
      year: migrationYear,
      month: migrationMonth,
    })
  ).trim();

  const targetCircle =
    String(
      destinationCircle || ""
    ).trim();

  if (!originCircle) {
    throw new Error(
      "El miembro no tiene un círculo de origen."
    );
  }

  if (
    normalizeCircle(
      originCircle
    ) ===
    normalizeCircle(
      targetCircle
    )
  ) {
    throw new Error(
      "El círculo de destino debe ser diferente al círculo actual."
    );
  }

  const migration =
    await buildMigrationRows({
      userId,
      originCircle,
      destinationCircle:
        targetCircle,
      migrationPeriod: normalizedMigrationPeriod,
    });


  return {
    user: {
      _id:
        user._id,

      doc:
        user.doc,

      name:
        user.name,
    },

    originCircle,

    destinationCircle:
      targetCircle,

    rows:
      migration.rows,

    missingDestinationSessions:
      migration.missingDestinationSessions,

    skippedOriginSessions:
      migration.skippedOriginSessions || 0,

    migrationPeriod:
      migration.migrationPeriod,

    isFutureMigration:
      migration.migrationPeriod > getCurrentMigrationPeriod(),
  };
};

/*
 * ============================================================
 * EJECUTAR MIGRACIÓN
 * ============================================================
 */
const executeMigration = async ({
  userId,
  destinationCircle,
  migrationPeriod = getCurrentMigrationPeriod(),
  migratedBy = "Sistema",
}) => {
  if (!userId) {
    throw new Error(
      "El miembro es obligatorio."
    );
  }

  if (!destinationCircle) {
    throw new Error(
      "El círculo de destino es obligatorio."
    );
  }

  const user =
    await User.findById(
      userId
    );

  if (!user) {
    throw new Error(
      "Miembro no encontrado."
    );
  }

  const normalizedMigrationPeriod = normalizeMigrationPeriod(migrationPeriod);
  const { year: migrationYear, month: migrationMonth } =
    periodToParts(normalizedMigrationPeriod);

  const sourceCircle = String(
    await resolveEffectiveCircleForPeriod({
      user,
      year: migrationYear,
      month: migrationMonth,
    })
  ).trim();

  const targetCircle =
    String(
      destinationCircle || ""
    ).trim();

  if (!sourceCircle) {
    throw new Error(
      "El miembro no tiene un círculo de origen."
    );
  }

  if (
    normalizeCircle(
      sourceCircle
    ) ===
    normalizeCircle(
      targetCircle
    )
  ) {
    throw new Error(
      "El círculo de destino debe ser diferente al círculo actual."
    );
  }

  const migration =
    await buildMigrationRows({
      userId,
      originCircle:
        sourceCircle,
      destinationCircle:
        targetCircle,
      migrationPeriod: normalizedMigrationPeriod,
    });


  /*
   * Si el círculo origen tiene más sesiones que el destino,
   * las sesiones sobrantes permanecen como historial del origen.
   * Eso NO bloquea la migración.
   */

  let createdAttendances = 0;
  let existingAttendances = 0;
  let migratedSessions = 0;

  const migrationSessions = [];

  /*
   * ==========================================================
   * COPIAR CADA ASISTENCIA
   * ==========================================================
   */
  for (const row of migration.rows) {
    const originAttendance =
      await Attendance.findOne({
        meeting:
          row.originMeeting._id,

        user:
          user._id,

        active: {
          $ne: false,
        },
      }).lean();

    if (!originAttendance) {
      continue;
    }

    const destinationMeetingId =
      row.destinationMeeting._id;

    let destinationAttendance =
      await Attendance.findOne({
        meeting:
          destinationMeetingId,

        user:
          user._id,
      });

    const wasCreated = !destinationAttendance;
    const previousAttendance = attendanceSnapshot(destinationAttendance);

    /*
     * Si ya existía, reutilizamos el registro y guardamos una instantánea
     * para que la Bitácora pueda restaurarlo al deshacer la migración.
     */
    if (destinationAttendance) {
      existingAttendances += 1;

      if (
        destinationAttendance.active ===
        false
      ) {
        destinationAttendance.active =
          true;

        destinationAttendance.deletedAt =
          null;

        destinationAttendance.deletedBy =
          "";
      }
    } else {
      destinationAttendance =
        new Attendance({
          meeting:
            destinationMeetingId,

          user:
            user._id,

          active: true,
        });

      createdAttendances += 1;
    }

    /*
     * ========================================================
     * COPIAR DATOS
     * ========================================================
     */
    destinationAttendance.doc =
      user.doc || "";

    destinationAttendance.name =
      user.name || "";

    destinationAttendance.circle =
      targetCircle;

    destinationAttendance.status =
      originAttendance.status ||
      "No asistió";

    destinationAttendance.justificationReason =
      originAttendance.justificationReason ||
      "";

    destinationAttendance.justifiedBy =
      originAttendance.justifiedBy ||
      "";

    destinationAttendance.justifiedAt =
      originAttendance.justifiedAt ||
      null;

    destinationAttendance.registeredBy =
      String(
        migratedBy ||
          "Sistema"
      ).trim();

    destinationAttendance.source =
      "SYSTEM";

    destinationAttendance.attendanceMode =
      originAttendance.attendanceMode ||
      "MANUAL";

    destinationAttendance.attendedAt =
      originAttendance.attendedAt ||
      null;

    destinationAttendance.note =
      originAttendance.note ||
      "";

    destinationAttendance.notes =
      originAttendance.notes ||
      "";

    destinationAttendance.registeredAt =
      new Date();

    await destinationAttendance.save();

    migrationSessions.push({
      sessionNumber:
        row.sessionNumber,

      originMeeting:
        row.originMeeting._id,

      destinationMeeting:
        row.destinationMeeting._id,

      status:
        destinationAttendance.status,

      attendanceId:
        destinationAttendance._id,

      wasCreated,

      previousAttendance,

      afterUpdatedAt:
        destinationAttendance.updatedAt || new Date(),
    });

    migratedSessions += 1;
  }

  /*
   * ==========================================================
   * CAMBIAR CÍRCULO ACTUAL DEL MIEMBRO
   * ==========================================================
   *
   * IMPORTANTE:
   * El historial original permanece intacto.
   */
  const currentPeriod = getCurrentMigrationPeriod();
  const isFutureMigration = normalizedMigrationPeriod > currentPeriod;

  // Si la migración inicia en un mes futuro, NO cambiamos todavía
  // el círculo actual del miembro. Los reportes/portal resolverán el
  // círculo correcto usando effectivePeriod.
  if (!isFutureMigration) {
    user.circle = targetCircle;
    await user.save();
  }

  /*
   * ==========================================================
   * REGISTRAR MIGRACIÓN
   * ==========================================================
   */
  const migrationRecord =
    await MemberMigration.create({
      member:
        user._id,

      memberDoc:
        user.doc || "",

      memberName:
        user.name || "",

      sourceCircle,

      targetCircle,

      effectivePeriod: normalizedMigrationPeriod,

      status: isFutureMigration ? "SCHEDULED" : "APPLIED",

      sessions:
        migrationSessions,

      migratedBy:
        String(
          migratedBy ||
            "Sistema"
        ).trim(),

      migratedAt:
        new Date(),
    });

  return {
    migratedSessions,
    createdAttendances,
    existingAttendances,
    migration:
      migrationRecord,
    migrationPeriod: normalizedMigrationPeriod,
    scheduled: isFutureMigration,
    sourceCircle,
    targetCircle,
  };
};

module.exports = {
  buildPreview,
  executeMigration,
};