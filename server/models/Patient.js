

const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const patientSchema = new mongoose.Schema(
  {
    healthId: {
      type: String,
      default: () => randomUUID(),
      unique: true,
      immutable: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    age: {
      type: Number,
      required: true,
      min: 0,
      max: 130
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true
    },

    village: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: true }
);

patientSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.model("Patient", patientSchema);
