const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: String, trim: true, default: "" },
    adminName: { type: String, trim: true, default: "" },
    adminRole: { type: String, trim: true, default: "" },

    action: { type: String, required: true, trim: true },
    module: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },

    targetId: { type: String, trim: true, default: "" },
    targetName: { type: String, trim: true, default: "" },
    circle: { type: String, trim: true, default: "" },

    /*
     * Datos específicos de una operación que puede revertirse.
     * Se mantienen separados de description para que el botón
     * Deshacer pueda operar de forma segura sobre MongoDB.
     */
    reversible: { type: Boolean, default: false, index: true },
    undone: { type: Boolean, default: false, index: true },
    undoneAt: { type: Date, default: null },
    undoneBy: { type: String, trim: true, default: "" },
    undoMessage: { type: String, trim: true, default: "" },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ circle: 1, createdAt: -1 });

auditLogSchema.index({ reversible: 1, undone: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
