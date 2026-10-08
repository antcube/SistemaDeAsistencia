const mongoose = require("mongoose");

const zoomAutoSyncRunSchema = new mongoose.Schema(
  {
    meetingId: { type: String, required: true, trim: true },
    sessionType: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    trigger: {
      type: String,
      required: true,
      enum: ["END_PLUS_10", "NIGHTLY_2330"],
    },
    status: {
      type: String,
      required: true,
      enum: ["success", "failed", "pending_link"],
      default: "success",
    },
    applied: { type: Number, default: 0 },
    instances: { type: Number, default: 0 },
    message: { type: String, trim: true, default: "" },
    ranAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

zoomAutoSyncRunSchema.index(
  { meetingId: 1, date: 1, trigger: 1 },
  { unique: true }
);

module.exports = mongoose.model("ZoomAutoSyncRun", zoomAutoSyncRunSchema);
