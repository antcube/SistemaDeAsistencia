const mongoose = require("mongoose");

const zoomAutoSyncRunSchema = new mongoose.Schema(
  {
    meetingId: { type: String, required: true, trim: true },
    sessionType: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },

    // Puede ser, por ejemplo:
    // END_PLUS_10_1725
    // END_PLUS_10_1810
    // NIGHTLY_2330
    // Se deja como String para distinguir varias sesiones de la misma categoría
    // y Meeting ID durante un mismo día.
    trigger: { type: String, required: true, trim: true },

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

// Mantenemos esta misma combinación para que sea compatible con el índice
// existente. Ahora el trigger incluye la hora de fin, por lo que dos sesiones
// del mismo Meeting ID en el mismo día no se bloquean entre sí.
zoomAutoSyncRunSchema.index(
  { meetingId: 1, date: 1, trigger: 1 },
  { unique: true }
);

module.exports = mongoose.model("ZoomAutoSyncRun", zoomAutoSyncRunSchema);