const mongoose = require("mongoose");

const adminSchema =
  new mongoose.Schema(
    {
      adminId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },


      phone: {
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

      email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
      },

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
        default:
          "Gestor de Círculo",
      },

      circleScope: {
        type: [String],
        default: [],
      },

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

module.exports =
  mongoose.model(
    "Admin",
    adminSchema
  );