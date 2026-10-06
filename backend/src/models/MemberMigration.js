const mongoose = require("mongoose");

const migrationSessionSchema = new mongoose.Schema(
  {
    sessionNumber: {
      type: Number,
      required: true,
    },

    originMeeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },

    destinationMeeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },

    status: {
      type: String,
      required: true,
    },

    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      default: null,
    },

    wasCreated: {
      type: Boolean,
      default: false,
    },

    previousAttendance: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    afterUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const memberMigrationSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    memberDoc: {
      type: String,
      trim: true,
      default: "",
    },

    memberName: {
      type: String,
      trim: true,
      default: "",
    },

    sourceCircle: {
      type: String,
      required: true,
      trim: true,
    },

    targetCircle: {
      type: String,
      required: true,
      trim: true,
    },

    sessions: {
      type: [migrationSessionSchema],
      default: [],
    },

    // Mes desde el cual el cambio de círculo entra en vigencia.
    // Formato: YYYY-MM. Permite programar migraciones futuras sin
    // reescribir el historial de meses anteriores.
    effectivePeriod: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}$/,
      index: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["SCHEDULED", "APPLIED", "CANCELLED"],
      default: "APPLIED",
      index: true,
    },

    migratedBy: {
      type: String,
      trim: true,
      default: "",
    },

    migratedAt: {
      type: Date,
      default: Date.now,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "MemberMigration",
  memberMigrationSchema
);
