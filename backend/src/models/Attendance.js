const mongoose = require("mongoose");

const ATTENDANCE_STATUSES = [
  "Asistió",
  "No asistió",
  "Justificado",
  "Clase Presencial",

  // Compatibilidad con registros históricos.
  // El sistema nuevo siempre guarda "No asistió".
  "Faltó",
];

const attendanceSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /*
     * Datos históricos del miembro.
     *
     * Se conservan para no romper registros
     * existentes ni perder información histórica.
     */
    doc: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    name: {
      type: String,
      trim: true,
      default: "",
    },

    circle: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    /*
     * Estados funcionales actuales:
     *
     * Asistió
     * No asistió
     * Justificado
     * Clase Presencial
     *
     * "Faltó" se conserva únicamente para
     * compatibilidad con registros antiguos.
     */
    status: {
      type: String,
      required: true,
      enum: ATTENDANCE_STATUSES,
      default: "No asistió",
    },

    /*
     * Motivo de la justificación.
     */
    justificationReason: {
      type: String,
      trim: true,
      default: "",
    },

    /*
     * Administrador que realizó la justificación.
     */
    justifiedBy: {
      type: String,
      trim: true,
      default: "",
    },

    justifiedAt: {
      type: Date,
      default: null,
    },

    /*
     * Usuario administrativo que registró
     * o modificó el estado.
     */
    registeredBy: {
      type: String,
      trim: true,
      default: "",
    },

    /*
     * Origen del registro:
     *
     * ADMIN   → modificación administrativa
     * QR      → registro mediante QR
     * SYSTEM  → operación automática
     */
    source: {
      type: String,
      enum: [
        "ADMIN",
        "QR",
        "SYSTEM",
      ],
      default: "ADMIN",
    },

    /*
     * Forma mediante la cual se produjo
     * la asistencia.
     *
     * MANUAL
     * PRESENCIAL
     * QR
     */
    attendanceMode: {
      type: String,
      enum: [
        "MANUAL",
        "PRESENCIAL",
        "QR",
      ],
      default: "MANUAL",
    },

    /*
     * Fecha/hora en que realmente se registró
     * una asistencia válida.
     */
    attendedAt: {
      type: Date,
      default: null,
    },

    /*
     * Fecha/hora de creación o modificación
     * del registro de asistencia.
     */
    registeredAt: {
      type: Date,
      default: Date.now,
    },

    /*
     * Nota principal.
     */
    note: {
      type: String,
      trim: true,
      default: "",
    },

    /*
     * Compatibilidad con la estructura histórica.
     */
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Un miembro solo puede tener un registro
 * de asistencia por reunión.
 *
 * Esto es fundamental para evitar duplicados.
 */
attendanceSchema.index(
  {
    meeting: 1,
    user: 1,
  },
  {
    unique: true,
  }
);

/*
 * Índice utilizado para consultas por DNI
 * y reunión.
 */
attendanceSchema.index({
  doc: 1,
  meeting: 1,
});

/*
 * Índice para consultas por círculo.
 */
attendanceSchema.index({
  circle: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Attendance",
  attendanceSchema
);