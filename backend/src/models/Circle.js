const mongoose = require("mongoose");

const circleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    active: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Circle", circleSchema);