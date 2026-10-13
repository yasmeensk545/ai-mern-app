const mongoose = require("mongoose");

const healthIdPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const medicalHistorySchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },

    healthId: {
      type: String,
      required: true,
      trim: true,
      match: healthIdPattern,
      index: true,
    },

    allergies: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    existingConditions: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    currentMedications: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    pastIllnessesOrSurgeries: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    familyMedicalHistory: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    visitDate: {
      type: Date,
      required: true,
    },

    symptomsOrVisitNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },

    providerNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
  },
  { timestamps: true }
);

medicalHistorySchema.index({ patient: 1, visitDate: -1 });

module.exports = mongoose.model("MedicalHistory", medicalHistorySchema);
