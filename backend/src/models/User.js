const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    doc: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      trim: true,
      default: "",
    },

    circle: {
      type: String,
      required: true,
      trim: true,
    },

    job: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
    type: String,
    trim: true,
    default: "",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);