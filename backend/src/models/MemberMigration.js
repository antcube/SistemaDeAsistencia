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

    migratedBy: {
      type: String,
      trim: true,
      default: "",
    },

    migratedAt: {
      type: Date,
      default: Date.now,
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
