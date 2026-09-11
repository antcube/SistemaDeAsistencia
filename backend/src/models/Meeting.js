const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
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

    circle: {
      type: String,
      required: true,
      trim: true,
    },

    host: {
      type: String,
      trim: true,
      default: "",
    },

    date: {
      type: String,
      required: true,
    },

    time: {
      type: String,
      default: "",
    },

    endTime: {
      type: String,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule",
      default: null,
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

    deletedBySchedule: {
      type: Boolean,
      default: false,
    },

    deletedByScheduleChange: {
      type: Boolean,
      default: false,
    },

    replacementScheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule",
      default: null,
    },

    createdBy: {
      type: String,
      trim: true,
      default: "",
    },

    qrActive: {
      type: Boolean,
      default: false,
    },

    qrStartTimestamp: {
      type: Date,
      default: null,
    },

    qrEndTimestamp: {
      type: Date,
      default: null,
    },

    attendees: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

meetingSchema.index({
  circle: 1,
  date: 1,
});

meetingSchema.index({
  scheduleId: 1,
  date: 1,
  circle: 1,
});

meetingSchema.index({
  active: 1,
  date: 1,
});

meetingSchema.index({
  scheduleId: 1,
  deletedByScheduleChange: 1,
  date: 1,
});

module.exports = mongoose.model("Meeting", meetingSchema);