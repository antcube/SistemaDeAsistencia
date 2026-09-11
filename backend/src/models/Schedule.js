const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema(
  {
    seriesId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    previousScheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule",
      default: null,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    circles: {
      type: [String],
      required: true,
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Debe seleccionar al menos un círculo.",
      },
    },

    type: {
      type: String,
      required: true,
      enum: [
        "CIRCULO DE LIDERAZGO",
        "HEALTH",
        "MENTORIA",
        "MASTERCLASS",
        "ANUNCIOS CORPORATIVOS",
      ],
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    host: {
      type: String,
      trim: true,
      default: "",
    },

    time: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    // 0 = Domingo
    // 1 = Lunes
    // 2 = Martes
    // 3 = Miércoles
    // 4 = Jueves
    // 5 = Viernes
    // 6 = Sábado
    weekdays: {
      type: [Number],
      required: true,
      validate: {
        validator: function (value) {
          return (
            Array.isArray(value) &&
            value.length > 0 &&
            value.every(
              (day) =>
                Number.isInteger(day) &&
                day >= 0 &&
                day <= 6
            )
          );
        },
        message:
          "Los días de la semana deben estar entre 0 y 6.",
      },
    },

    startDate: {
      type: String,
      required: true,
    },

    endDate: {
      type: String,
      default: null,
    },

    changeType: {
      type: String,
      enum: [
        "CREATED",
        "MIGRATED",
        "TERMINATED",
      ],
      default: "CREATED",
    },

    active: {
      type: Boolean,
      default: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

scheduleSchema.index({
  seriesId: 1,
  version: 1,
});

scheduleSchema.index({
  active: 1,
  type: 1,
  startDate: 1,
});

scheduleSchema.index({
  seriesId: 1,
  startDate: 1,
  endDate: 1,
});

module.exports = mongoose.model(
  "Schedule",
  scheduleSchema
);