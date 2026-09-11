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

  if (
    Array.isArray(specificCircles)
  ) {
    circles = [
      ...new Set(
        specificCircles
          .map((circle) =>
            String(
              circle || ""
            ).trim()
          )
          .filter(Boolean)
      ),
    ];
  } else {
    circles =
      await getExistingCircles();
  }

  if (!circles.length) {
    return [];
  }

  const createdSchedules = [];

  const today =
    getTodayString();

  for (
    const defaultSchedule of DEFAULT_SCHEDULES
  ) {
    for (
      const circle of circles
    ) {
      /*
       * Buscamos cualquier programación existente
       * para ese tipo y círculo.
       *
       * No importa si contiene otros círculos:
       * mientras este círculo ya esté incluido,
       * no creamos otra.
       */
      const existingSchedule =
        await Schedule.findOne({
          active: true,
          type:
            defaultSchedule.type,
          circles: circle,
        });

      if (existingSchedule) {
        continue;
      }

      /*
       * Si existe una programación inactiva,
       * NO la reutilizamos automáticamente porque
       * podría representar una programación terminada.
       *
       * Creamos una nueva programación activa.
       */
      const schedule =
        await Schedule.create({
          seriesId:
            crypto.randomUUID(),

          version: 1,

          previousScheduleId:
            null,

          name:
            defaultSchedule.name,

          circles: [circle],

          type:
            defaultSchedule.type,

          title:
            defaultSchedule.title,

          host: "",

          time:
            defaultSchedule.time,

          endTime:
            defaultSchedule.endTime,

          location: "",

          weekdays:
            defaultSchedule.weekdays,

          /*
           * Para círculos nuevos:
           * la programación comienza desde el día
           * en que fue creada.
           *
           * Para círculos que ya existían:
           * también funciona porque generateMeetingsForMonth
           * se encargará de crear las sesiones correspondientes.
           */
          startDate: today,

          endDate: null,

          changeType: "CREATED",

          active: true,

          createdBy: "SYSTEM",
        });

      createdSchedules.push(
        schedule
      );
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