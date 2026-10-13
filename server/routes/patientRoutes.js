
const express = require("express");
const Patient = require("../models/Patient");
const MedicalHistory = require("../models/MedicalHistory");
const authMiddleware = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const healthIdPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const FIELD_LIMITS = {
  allergies: 2000,
  existingConditions: 2000,
  currentMedications: 2000,
  pastIllnessesOrSurgeries: 2000,
  familyMedicalHistory: 2000,
  symptomsOrVisitNotes: 5000,
  providerNotes: 5000,
};

function validateHealthId(value) {
  return typeof value === "string" && healthIdPattern.test(value.trim());
}

function normalizeOptionalText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.length > maxLength) {
    throw new Error(`Field exceeds the maximum length of ${maxLength} characters.`);
  }

  return trimmed;
}

function logAuditAccess(req) {
  const payload = {
    event: "patient_record_access",
    timestamp: new Date().toISOString(),
    method: req.method,
    route: `${req.baseUrl}${req.route?.path || ""}`,
    workerId: req.worker?.id || null,
    role: req.worker?.role || null,
  };

  console.info(JSON.stringify(payload));
}

function logOperationFailure(operation, error) {
  const details = { name: error?.name || "Error" };

  if (Number.isInteger(error?.code)) {
    details.code = error.code;
  }

  console.error(`${operation} failed:`, details);
}

router.get(
  "/",
  authMiddleware,
  allowRoles("health_worker", "admin"),
  async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      search.length > 100
    ) {
      return res.status(400).json({
        message: "Page, page size, or search term is invalid.",
      });
    }

    try {
      const filter = search
        ? {
            $or: ["name", "healthId", "village"].map((field) => ({
              [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
            })),
          }
        : {};
      const [patients, total] = await Promise.all([
        Patient.find(filter)
          .select("healthId name age gender village createdAt")
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Patient.countDocuments(filter),
      ]);

      logAuditAccess(req);

      return res.json({
        patients: patients.map((patient) => ({
          healthId: patient.healthId,
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          village: patient.village,
          registrationDate: patient.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logOperationFailure("Patient list retrieval", error);
      return res.status(500).json({
        message: "Unable to retrieve patient records.",
      });
    }
  }
);

router.post(
  "/",
  authMiddleware,
  allowRoles("health_worker", "admin"),
  async (req, res) => {
    try {
      const { name, age, gender, village } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100 ||
        !Number.isInteger(age) ||
        age < 0 ||
        age > 130 ||
        !["Male", "Female", "Other"].includes(gender) ||
        typeof village !== "string" ||
        !village.trim() ||
        village.trim().length > 100
      ) {
        return res.status(400).json({
          message: "Please provide valid patient details.",
        });
      }

      const patient = await Patient.create({
        name: name.trim(),
        age,
        gender,
        village: village.trim(),
      });

      logAuditAccess(req);

      return res.status(201).json({
        message: "Patient registered successfully.",
        patient: {
          healthId: patient.healthId,
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          village: patient.village,
          createdAt: patient.createdAt,
        },
      });
    } catch (error) {
      logOperationFailure("Patient registration", error);
      return res.status(500).json({
        message: "Unable to register patient.",
      });
    }
  }
);

router.get(
  "/:healthId",
  authMiddleware,
  allowRoles("health_worker", "admin"),
  async (req, res) => {
    const requestedHealthId = req.params.healthId;

    if (!validateHealthId(requestedHealthId)) {
      return res.status(400).json({
        message: "Invalid Health ID format.",
      });
    }

    try {
      const patient = await Patient.findOne({
        healthId: requestedHealthId.trim(),
      }).lean();

      logAuditAccess(req);

      if (!patient) {
        return res.status(404).json({
          message: "Patient not found.",
        });
      }

      return res.json({
        patient: {
          healthId: patient.healthId,
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          village: patient.village,
          createdAt: patient.createdAt,
        },
      });
    } catch (error) {
      logOperationFailure("Patient lookup", error);
      return res.status(500).json({
        message: "Unable to retrieve patient record.",
      });
    }
  }
);

router.get(
  "/:healthId/history",
  authMiddleware,
  allowRoles("health_worker", "admin"),
  async (req, res) => {
    const requestedHealthId = req.params.healthId;

    if (!validateHealthId(requestedHealthId)) {
      return res.status(400).json({
        message: "Invalid Health ID format.",
      });
    }

    try {
      const patient = await Patient.findOne({
        healthId: requestedHealthId.trim(),
      }).select("_id healthId").lean();

      if (!patient) {
        return res.status(404).json({
          message: "Patient not found.",
        });
      }

      const history = await MedicalHistory.find({
        patient: patient._id,
      })
        .sort({ visitDate: -1, createdAt: -1 })
        .lean();

      logAuditAccess(req);

      return res.json({
        history: history.map((entry) => ({
          _id: entry._id,
          healthId: entry.healthId,
          allergies: entry.allergies || "",
          existingConditions: entry.existingConditions || "",
          currentMedications: entry.currentMedications || "",
          pastIllnessesOrSurgeries: entry.pastIllnessesOrSurgeries || "",
          familyMedicalHistory: entry.familyMedicalHistory || "",
          visitDate: entry.visitDate,
          symptomsOrVisitNotes: entry.symptomsOrVisitNotes || "",
          providerNotes: entry.providerNotes || "",
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })),
      });
    } catch (error) {
      logOperationFailure("Medical history retrieval", error);
      return res.status(500).json({
        message: "Unable to retrieve medical history.",
      });
    }
  }
);

router.post(
  "/:healthId/history",
  authMiddleware,
  allowRoles("health_worker", "admin"),
  async (req, res) => {
    const requestedHealthId = req.params.healthId;

    if (!validateHealthId(requestedHealthId)) {
      return res.status(400).json({
        message: "Invalid Health ID format.",
      });
    }

    try {
      const patient = await Patient.findOne({
        healthId: requestedHealthId.trim(),
      }).select("_id healthId");

      if (!patient) {
        return res.status(404).json({
          message: "Patient not found.",
        });
      }

      const rawBody = req.body || {};
      const visitDate = new Date(rawBody.visitDate);
      const isValidDate = !Number.isNaN(visitDate.getTime());

      if (!isValidDate) {
        return res.status(400).json({
          message: "Please provide a valid visit date.",
        });
      }

      const payload = {
        allergies: normalizeOptionalText(rawBody.allergies, FIELD_LIMITS.allergies),
        existingConditions: normalizeOptionalText(rawBody.existingConditions, FIELD_LIMITS.existingConditions),
        currentMedications: normalizeOptionalText(rawBody.currentMedications, FIELD_LIMITS.currentMedications),
        pastIllnessesOrSurgeries: normalizeOptionalText(
          rawBody.pastIllnessesOrSurgeries,
          FIELD_LIMITS.pastIllnessesOrSurgeries
        ),
        familyMedicalHistory: normalizeOptionalText(rawBody.familyMedicalHistory, FIELD_LIMITS.familyMedicalHistory),
        symptomsOrVisitNotes: normalizeOptionalText(
          rawBody.symptomsOrVisitNotes,
          FIELD_LIMITS.symptomsOrVisitNotes
        ),
        providerNotes: normalizeOptionalText(rawBody.providerNotes, FIELD_LIMITS.providerNotes),
      };

      const entry = await MedicalHistory.create({
        patient: patient._id,
        healthId: patient.healthId,
        visitDate,
        ...payload,
      });

      logAuditAccess(req);

      return res.status(201).json({
        message: "Medical history saved successfully.",
        entry: {
          _id: entry._id,
          patient: patient._id,
          healthId: entry.healthId,
          allergies: entry.allergies,
          existingConditions: entry.existingConditions,
          currentMedications: entry.currentMedications,
          pastIllnessesOrSurgeries: entry.pastIllnessesOrSurgeries,
          familyMedicalHistory: entry.familyMedicalHistory,
          visitDate: entry.visitDate,
          symptomsOrVisitNotes: entry.symptomsOrVisitNotes,
          providerNotes: entry.providerNotes,
          createdAt: entry.createdAt,
        },
      });
    } catch (error) {
      logOperationFailure("Medical history creation", error);

      if (error.message.includes("exceeds the maximum length")) {
        return res.status(400).json({
          message: error.message,
        });
      }

      return res.status(500).json({
        message: "Unable to save medical history.",
      });
    }
  }
);

module.exports = router;
