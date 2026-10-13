
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const HealthWorker = require("../models/HealthWorker");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
});

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

// Public registration is disabled by default. Use an admin-controlled provisioning workflow.
router.post("/register", authLimiter, async (req, res) => {
  const publicRegistrationEnabled = process.env.ALLOW_PUBLIC_REGISTRATION === "true";
  const adminRegistrationSecret = process.env.ADMIN_REGISTRATION_SECRET;
  const providedSecret = req.headers["x-admin-registration-secret"];

  if (!publicRegistrationEnabled) {
    if (!adminRegistrationSecret || providedSecret !== adminRegistrationSecret) {
      return res.status(403).json({
        message:
          "Public health-worker registration is disabled. Contact the system administrator to provision an account.",
      });
    }
  }

  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      !isValidEmail(email) ||
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message: "Enter a valid name and email address, and a password of at least 8 characters and no more than 72 UTF-8 bytes.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingWorker = await HealthWorker.findOne({
      email: normalizedEmail,
    });

    if (existingWorker) {
      return res.status(409).json({
        message: "This email is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await HealthWorker.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "health_worker",
    });

    return res.status(201).json({
      message: "Health worker registered successfully.",
    });
  } catch (error) {
    console.error("Health worker registration failed:", error.name || "Error");
    return res.status(500).json({
      message: "Registration failed.",
    });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email) || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const worker = await HealthWorker.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (
      !worker ||
      worker.role !== "health_worker" ||
      !isBcryptHash(worker.password) ||
      !(await bcrypt.compare(password, worker.password))
    ) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Authentication configuration error.",
      });
    }

    const token = jwt.sign(
      {
        id: worker._id.toString(),
        role: worker.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      message: "Login successful.",
      token,
      worker: {
        id: worker._id,
        name: worker.name,
        email: worker.email,
        role: worker.role,
      },
    });
  } catch (error) {
    console.error("Login failed:", error.name || "Error");
    return res.status(500).json({
      message: "Unable to sign in right now.",
    });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const worker = await HealthWorker.findById(req.worker.id).select("name email role");

    if (!worker || worker.role !== "health_worker") {
      return res.status(401).json({
        message: "Your health-worker account is no longer available. Please sign in again.",
      });
    }

    return res.json({
      worker: {
        id: worker._id,
        name: worker.name,
        email: worker.email,
        role: worker.role,
      },
    });
  } catch (error) {
    console.error("Session verification failed:", error.name || "Error");
    return res.status(500).json({
      message: "Unable to verify the health-worker session.",
    });
  }
});

module.exports = router;
