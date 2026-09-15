const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    doc: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
    },

    name: {
      type: String,
      required: false,
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

    rangeChangeDate: {
      type: Date,
      default: null,
    },

    rangeHistory: {
      type: [
        {
          range: {
            type: String,
            trim: true,
          },
          startDate: {
            type: Date,
            default: null,
          },
          endDate: {
            type: Date,
            default: null,
          },
          changedBy: {
            type: String,
            trim: true,
            default: "",
          },
        },
      ],
      default: [],
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