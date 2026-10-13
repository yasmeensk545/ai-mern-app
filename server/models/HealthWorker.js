
const mongoose = require("mongoose");

const healthWorkerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ["health_worker", "admin"],
      default: "health_worker"
    }
  },
  { timestamps: true, collection: "healthworkers" }
);

module.exports = mongoose.model(
  "HealthWorker",
  healthWorkerSchema
);
