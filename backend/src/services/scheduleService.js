const crypto = require("crypto");

const Schedule = require("../models/Schedule");
const Meeting = require("../models/Meeting");
const Circle = require("../models/Circle");

const formatDate = (year, month, day) => {
  return `${year}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
};

const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

const getWeekday = (dateString) => {
  const [year, month, day] =
    dateString.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  ).getDay();
};

/**
 * ============================================================
 * PROGRAMACIONES PREDETERMINADAS
 * ============================================================
 *
 * HEALTH
 * Jueves 7:00 PM - 8:00 PM
 *
 * MENTORÍA
 * Domingo 8:00 PM - 9:00 PM
 */
const DEFAULT_SCHEDULES = [
  {
    type: "HEALTH",
    name: "HEALTH",
    title: "HEALTH",
    time: "7:00 PM",
    endTime: "8:00 PM",
    weekdays: [4],
  },
  {
    type: "MENTORIA",
    name: "MENTORÍA",
    title: "MENTORÍA",
    time: "8:00 PM",
    endTime: "9:00 PM",
    weekdays: [0],
  },
];

/**
 * ============================================================
 * FECHA ACTUAL LOCAL
 * ============================================================
 */
const getTodayString = () => {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

/**
 * ============================================================
 * OBTENER TODOS LOS CÍRCULOS ACTIVOS
 * ============================================================
 *
 * IMPORTANTE:
 * Ya NO usamos User.distinct("circle").
 *
 * Los círculos son entidades propias del sistema,
 * por lo que se consultan directamente desde Circle.
 */
const getExistingCircles = async () => {
  const circles = await Circle.find({
    active: true,
  })
    .select("name")
    .sort({
      name: 1,
    });

  return circles
    .map((circle) =>
      String(circle.name || "").trim()
    )
    .filter(Boolean);
};

/**
 * ============================================================
 * ASEGURAR PROGRAMACIONES PREDETERMINADAS
 * ============================================================
 *
 * Crea HEALTH y MENTORÍA para TODOS los círculos activos.
 *
 * Si una programación ya existe para ese círculo y tipo,
 * no se vuelve a crear.
 *
 * Puede recibir:
 *
 * ensureDefaultSchedules()
 *
 * o:
 *
 * ensureDefaultSchedules(["NUEVO CIRCULO"])
 *
 * En ambos casos funciona.
 */
const ensureDefaultSchedules = async (
  specificCircles = null
) => {
  let circles;

  if (Array.isArray(specificCircles)) {
    circles = [
      ...new Set(
        specificCircles
          .map((circle) => String(circle || "").trim())
          .filter(Boolean)
      ),
    ];
  } else {
    circles = await getExistingCircles();
  }

  if (!circles.length) {
    return [];
  }

  const createdSchedules = [];
  const today = getTodayString();

  for (const defaultSchedule of DEFAULT_SCHEDULES) {
    for (const circle of circles) {
      /*
       * Una programación predeterminada es única por:
       * tipo + círculo + nombre + horario + días.
       *
       * Primero buscamos una programación activa que ya incluya
       * el círculo. Esto conserva las programaciones existentes
       * que fueron creadas para varios círculos.
       */
      let existingSchedules = await Schedule.find({
        active: true,
        type: defaultSchedule.type,
        circles: circle,
      }).sort({ createdAt: 1, _id: 1 });

      if (existingSchedules.length) {
        /*
         * Si por una ejecución anterior ya quedaron dos o más
         * programaciones predeterminadas para el mismo círculo,
         * conservamos la primera y desactivamos las demás SOLO
         * cuando tienen las características del horario oficial.
         */
        const matchingSchedules = existingSchedules.filter(
          (schedule) =>
            String(schedule.name || "").trim() ===
              defaultSchedule.name &&
            String(schedule.title || "").trim() ===
              defaultSchedule.title &&
            String(schedule.time || "").trim() ===
              defaultSchedule.time &&
            String(schedule.endTime || "").trim() ===
              defaultSchedule.endTime &&
            JSON.stringify(
              [...(schedule.weekdays || [])].sort((a, b) => a - b)
            ) ===
              JSON.stringify(
                [...defaultSchedule.weekdays].sort((a, b) => a - b)
              )
        );

        if (matchingSchedules.length) {
          const keeper = matchingSchedules[0];
          const duplicateIds = matchingSchedules
            .slice(1)
            .map((schedule) => schedule._id);

          if (duplicateIds.length) {
            await Schedule.updateMany(
              { _id: { $in: duplicateIds } },
              {
                $set: {
                  active: false,
                  deletedAt: new Date(),
                  deletedBy: "SYSTEM_DUPLICATE_CLEANUP",
                  changeType: "TERMINATED",
                },
              }
            );

            /*
             * También desactivamos las reuniones duplicadas que
             * pertenecían a las programaciones repetidas. No
             * tocamos la reunión que pertenece a la programación
             * que conservamos.
             */
            await Meeting.updateMany(
              {
                scheduleId: { $in: duplicateIds },
                active: true,
              },
              {
                $set: {
                  active: false,
                  deletedAt: new Date(),
                  deletedBy: "SYSTEM_DUPLICATE_CLEANUP",
                  deletedBySchedule: true,
                },
              }
            );
          }

          continue;
        }

        /*
         * Hay una programación del mismo tipo para el círculo,
         * pero no coincide exactamente con el horario oficial.
         * No la tocamos: podría ser una programación personalizada.
         */
        continue;
      }

      /*
       * No existe una programación activa para este círculo.
       * La creamos una sola vez.
       *
       * El filtro exacto de arriba, combinado con esta sección
       * dentro de un proceso, evita que una navegación normal del
       * calendario genere nuevas copias.
       */
      const schedule = await Schedule.create({
        seriesId: crypto.randomUUID(),
        version: 1,
        previousScheduleId: null,
        name: defaultSchedule.name,
        circles: [circle],
        type: defaultSchedule.type,
        title: defaultSchedule.title,
        host: "",
        time: defaultSchedule.time,
        endTime: defaultSchedule.endTime,
        location: "",
        weekdays: defaultSchedule.weekdays,
        startDate: today,
        endDate: null,
        changeType: "CREATED",
        active: true,
        createdBy: "SYSTEM",
      });

      createdSchedules.push(schedule);
    }
  }

  /*
   * Limpieza final de reuniones oficiales duplicadas.
   *
   * Esto corrige también duplicados que ya estaban almacenados
   * antes de instalar esta corrección. Conservamos la reunión
   * activa más antigua para cada combinación:
   * tipo + círculo + fecha + hora.
   */
  for (const defaultSchedule of DEFAULT_SCHEDULES) {
    for (const circle of circles) {
      const meetings = await Meeting.find({
        active: true,
        type: defaultSchedule.type,
        circle,
        time: defaultSchedule.time,
      }).sort({ date: 1, createdAt: 1, _id: 1 });

      const keeperByDate = new Map();
      const duplicateMeetingIds = [];

      for (const meeting of meetings) {
        const key = `${meeting.date}|${meeting.time}`;

        if (!keeperByDate.has(key)) {
          keeperByDate.set(key, meeting._id);
          continue;
        }

        duplicateMeetingIds.push(meeting._id);
      }

      if (duplicateMeetingIds.length) {
        await Meeting.updateMany(
          { _id: { $in: duplicateMeetingIds } },
          {
            $set: {
              active: false,
              deletedAt: new Date(),
              deletedBy: "SYSTEM_DUPLICATE_CLEANUP",
              deletedBySchedule: true,
            },
          }
        );
      }
    }
  }

  return createdSchedules;
};

/**
 * ============================================================
 * GENERAR REUNIONES DE UNA PROGRAMACIÓN
 * ============================================================
 */
const generateMeetingsForSchedule = async (
  schedule,
  year,
  month
) => {
  const createdMeetings = [];

  const totalDays =
    getDaysInMonth(
      year,
      month
    );

  for (
    let day = 1;
    day <= totalDays;
    day++
  ) {
    const date =
      formatDate(
        year,
        month,
        day
      );

    /*
     * La fecha debe estar dentro
     * de la vigencia de la programación.
     */
    if (
      date <
      schedule.startDate
    ) {
      continue;
    }

    if (
      schedule.endDate &&
      date >
        schedule.endDate
    ) {
      continue;
    }

    const weekday =
      getWeekday(date);

    if (
      !schedule.weekdays.includes(
        weekday
      )
    ) {
      continue;
    }

    for (
      const circle of schedule.circles
    ) {
      /*
       * Primero comprobamos si ESTA programación
       * ya generó la reunión.
       */
      const existingMeeting =
        await Meeting.findOne({
          scheduleId:
            schedule._id,

          circle,

          date,

          time:
            schedule.time,

          active: true,
        });

      if (existingMeeting) {
        continue;
      }

      /*
       * Protección adicional:
       *
       * Si existe otra reunión activa del mismo
       * tipo, círculo, fecha y horario, no creamos
       * otra.
       */
      const duplicateMeeting =
        await Meeting.findOne({
          circle,

          date,

          time:
            schedule.time,

          type:
            schedule.type,

          active: true,
        });

      if (duplicateMeeting) {
        continue;
      }

      const meeting =
        await Meeting.create({
          title:
            schedule.title,

          type:
            schedule.type,

          circle,

          host:
            schedule.host,

          date,

          time:
            schedule.time,

          endTime:
            schedule.endTime,

          location:
            schedule.location,

          scheduleId:
            schedule._id,

          active: true,

          createdBy:
            schedule.createdBy,
        });

      createdMeetings.push(
        meeting
      );
    }
  }

  return createdMeetings;
};

/**
 * ============================================================
 * GENERAR REUNIONES DEL MES
 * ============================================================
 *
 * IMPORTANTE:
 * Antes de generar reuniones, aseguramos que TODOS
 * los círculos activos tengan HEALTH y MENTORÍA.
 */
const generateMeetingsForMonth = async (
  year,
  month
) => {
  /*
   * Esto ahora consulta Circle directamente.
   *
   * Por eso:
   * - todos los círculos existentes quedan cubiertos
   * - los círculos nuevos también quedan cubiertos
   * - no depende de tener miembros
   */
  await ensureDefaultSchedules();

  const firstDate =
    formatDate(
      year,
      month,
      1
    );

  const lastDate =
    formatDate(
      year,
      month,
      getDaysInMonth(
        year,
        month
      )
    );

  const schedules =
    await Schedule.find({
      active: true,

      startDate: {
        $lte: lastDate,
      },

      $or: [
        {
          endDate: null,
        },
        {
          endDate: {
            $gte: firstDate,
          },
        },
      ],
    });

  const createdMeetings = [];

  for (
    const schedule of schedules
  ) {
    const meetings =
      await generateMeetingsForSchedule(
        schedule,
        year,
        month
      );

    createdMeetings.push(
      ...meetings
    );
  }

  return createdMeetings;
};

/**
 * ============================================================
 * OBTENER REUNIONES DEL MES
 * ============================================================
 */
const getMeetingsForMonth = async (
  year,
  month,
  filters = {}
) => {
  /*
   * Asegura primero las programaciones
   * y reuniones oficiales.
   */
  await generateMeetingsForMonth(
    year,
    month
  );

  const firstDate =
    formatDate(
      year,
      month,
      1
    );

  const lastDate =
    formatDate(
      year,
      month,
      getDaysInMonth(
        year,
        month
      )
    );

  const query = {
    active: true,

    date: {
      $gte: firstDate,
      $lte: lastDate,
    },
  };

  if (filters.circle) {
    query.circle =
      filters.circle;
  }

  if (filters.type) {
    query.type =
      filters.type;
  }

  return Meeting.find(
    query
  ).sort({
    date: 1,
    time: 1,
    createdAt: 1,
  });
};

/**
 * ============================================================
 * PROGRAMACIONES ACTIVAS
 * ============================================================
 */
const getActiveSchedules = async (
  circle = null
) => {
  const query = {
    active: true,
  };

  if (circle) {
    query.circles =
      circle;
  }

  return Schedule.find(
    query
  ).sort({
    startDate: 1,
    version: 1,
    createdAt: 1,
  });
};

/**
 * ============================================================
 * DESACTIVAR REUNIONES FUTURAS
 * ============================================================
 */
const deactivateFutureMeetings = async ({
  scheduleId,
  effectiveDate,
  userId,
  replacementScheduleId = null,
  byScheduleChange = false,
}) => {
  const update = {
    active: false,

    deletedAt:
      new Date(),

    deletedBy:
      userId || "",
  };

  if (
    byScheduleChange
  ) {
    update.deletedByScheduleChange =
      true;

    update.replacementScheduleId =
      replacementScheduleId;
  } else {
    update.deletedBySchedule =
      true;
  }

  const result =
    await Meeting.updateMany(
      {
        scheduleId,

        date: {
          $gte:
            effectiveDate,
        },

        active: true,
      },
      update
    );

  return result;
};

module.exports = {
  formatDate,

  getDaysInMonth,

  getWeekday,

  getExistingCircles,

  ensureDefaultSchedules,

  generateMeetingsForSchedule,

  generateMeetingsForMonth,

  getMeetingsForMonth,

  getActiveSchedules,

  deactivateFutureMeetings,
};