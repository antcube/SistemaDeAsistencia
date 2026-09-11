const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    // ID administrativo del sistema.
    // El Administrador Principal utiliza ADM-001.
    adminId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // DNI/documento del administrador
    doc: {
      type: String,
      trim: true,
      default: "",
    },

    // Nombre completo
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Correo utilizado para identificar al administrador
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // Contraseña/PIN almacenado de forma segura.
    // Aquí NO guardaremos el PIN en texto plano.
    passwordHash: {
      type: String,
      required: true,
    },

    // Roles del sistema
    role: {
      type: String,
      required: true,
      enum: [
        "Administrador General",
        "Gestor de Círculo",
        "Administrador de Círculos",
        "Sub Administrador",
        "Moderador",
      ],
      default: "Gestor de Círculo",
    },

    circleScope: {
      type: [String],
      default: [],
    },

    // Permite desactivar una cuenta sin eliminarla
    active: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Admin", adminSchema);