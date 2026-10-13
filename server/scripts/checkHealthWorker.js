const path = require("path");
const readline = require("readline");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const HealthWorker = require("../models/HealthWorker");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

async function checkHealthWorker() {
  try {
    const email = (await askQuestion("Health worker email to check: ")).toLowerCase();

    if (!isValidEmail(email)) {
      throw new Error("A valid email address is required.");
    }

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not configured in server/.env.");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const worker = await HealthWorker.findOne({ email }).select("+password").lean();

    if (!worker) {
      console.log("Account exists: no");
      return;
    }

    const passwordConfigured = typeof worker.password === "string" && worker.password.length > 0;
    console.log("Account exists: yes");
    console.log(`Role: ${worker.role}`);
    console.log(`Password field configured: ${passwordConfigured ? "yes" : "no"}`);
    console.log(`Password uses a valid bcrypt hash format: ${isBcryptHash(worker.password) ? "yes" : "no"}`);
    console.log(`Role permits health-worker login: ${worker.role === "health_worker" ? "yes" : "no"}`);
  } catch (error) {
    if (
      error.message === "A valid email address is required." ||
      error.message === "MONGODB_URI is not configured in server/.env."
    ) {
      console.error(error.message);
    } else {
      console.error("Unable to check the account. Verify server/.env and MongoDB connectivity.");
    }

    process.exitCode = 1;
  } finally {
    rl.close();

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

checkHealthWorker();
