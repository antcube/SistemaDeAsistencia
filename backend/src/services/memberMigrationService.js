const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Meeting = require("../models/Meeting");
const MemberMigration = require("../models/MemberMigration");

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
 * AGRUPAR REUNIONES POR CATEGORÍA
 * ============================================================
 *
 * IMPORTANTE:
 *
 * Ya NO usamos título + horario como parte de la equivalencia.
 * Las fechas, títulos y horarios pueden cambiar al migrar de
 * círculo. Lo que determina la equivalencia es la categoría y
 * la posición cronológica de la sesión dentro de esa categoría.
 */
const groupMeetingsByCategory = (meetings) => {
  const groups = new Map();

  for (const meeting of meetings) {
    const key = meetingCategory(meeting);

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
}) => {
  /*
   * ----------------------------------------------------------
   * 1. ASISTENCIAS DEL MIEMBRO EN EL CÍRCULO ORIGEN
   * ----------------------------------------------------------
   */
  const sourceAttendances =
    await getMemberAttendances({
      userId,
      originCircle,
    });

  if (!sourceAttendances.length) {
    return {
      rows: [],
      missingDestinationSessions: 0,
    };
  }

  /*
   * ----------------------------------------------------------
   * 2. TODAS LAS REUNIONES DE AMBOS CÍRCULOS
   * ----------------------------------------------------------
   *
   * No filtramos por type porque dos círculos pueden representar
   * la misma categoría con valores distintos de type/título.
   */
  const sourceMeetings =
    await getCircleMeetings({
      circle: originCircle,
    });

  const destinationMeetings =
    await getCircleMeetings({
      circle: destinationCircle,
    });

  /*
   * ----------------------------------------------------------
   * 3. AGRUPAR POR CATEGORÍA
   * ----------------------------------------------------------
   *
   * Cada categoría tiene su propia secuencia de sesiones.
   */
  const sourceGroups =
    groupMeetingsByCategory(sourceMeetings);

  const destinationGroups =
    groupMeetingsByCategory(destinationMeetings);

  /*
   * Attendance por reunión.
   */
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
  let missingDestinationSessions = 0;

  /*
   * ----------------------------------------------------------
   * 4. EQUIVALENCIA POR POSICIÓN
   * ----------------------------------------------------------
   *
   * Ejemplo:
   *
   * ORIGEN                         DESTINO
   * Liderazgo #1  -> Liderazgo #1
   * Liderazgo #2  -> Liderazgo #2
   * Health #1     -> Health #1
   * Health #2     -> Health #2
   * Mentoría #1   -> Mentoría #1
   *
   * Las fechas no intervienen en la equivalencia.
   */
  for (const [category, sourceGroup] of sourceGroups.entries()) {
    const destinationGroup =
      destinationGroups.get(category) || [];

    for (let index = 0; index < sourceGroup.length; index += 1) {
      const sourceMeeting = sourceGroup[index];
      const attendance = attendanceByMeeting.get(
        String(sourceMeeting._id)
      );

      /*
       * Solo migramos sesiones en las que el miembro realmente
       * tiene un registro de asistencia/estado.
       *
       * Pero usamos TODAS las reuniones anteriores para calcular
       * correctamente su número de sesión.
       */
      if (!attendance) {
        continue;
      }

      const sessionNumber = index + 1;
      const destinationMeeting =
        destinationGroup[index] || null;

      if (!destinationMeeting) {
        missingDestinationSessions += 1;
      }

      rows.push({
        category,
        sessionNumber,

        originMeeting: {
          _id: sourceMeeting._id,
          date: sourceMeeting.date,
          time: sourceMeeting.time,
          title: sourceMeeting.title,
          type: sourceMeeting.type,
        },

        destinationMeeting: destinationMeeting
          ? {
              _id: destinationMeeting._id,
              date: destinationMeeting.date,
              time: destinationMeeting.time,
              title: destinationMeeting.title,
              type: destinationMeeting.type,
            }
          : null,

        status:
          attendance.status === "Faltó"
            ? "No asistió"
            : attendance.status || "No asistió",
      });
    }
  }

  /*
   * Ordenamos por fecha de origen únicamente para que el preview
   * sea fácil de leer. Esto NO modifica la equivalencia.
   */
  rows.sort((a, b) => {
    const dateCompare = String(
      a.originMeeting?.date || ""
    ).localeCompare(
      String(b.originMeeting?.date || "")
    );

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return (
      Number(a.sessionNumber || 0) -
      Number(b.sessionNumber || 0)
    );
  });

  return {
    rows,
    missingDestinationSessions,
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

  const originCircle =
    String(
      user.circle || ""
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
    });

  /*
   * Solamente mostramos error si realmente no existen
   * asistencias/faltas/justificaciones.
   */
  if (!migration.rows.length) {
    throw new Error(
      `No se encontraron asistencias, faltas o justificaciones del miembro en el círculo de origen "${originCircle}".`
    );
  }

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

  const sourceCircle =
    String(
      user.circle || ""
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
    });

  if (!migration.rows.length) {
    throw new Error(
      `No se encontraron asistencias, faltas o justificaciones del miembro en el círculo de origen "${sourceCircle}".`
    );
  }

  /*
   * No permitimos migrar si alguna asistencia
   * no tiene su sesión equivalente.
   */
  if (
    migration.missingDestinationSessions >
    0
  ) {
    throw new Error(
      `No se puede realizar la migración porque faltan ${migration.missingDestinationSessions} sesiones equivalentes en el círculo de destino.`
    );
  }

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

    /*
     * Si ya existía, reutilizamos el registro.
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
  user.circle =
    targetCircle;

  await user.save();

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
  };
};

module.exports = {
  buildPreview,
  executeMigration,
};