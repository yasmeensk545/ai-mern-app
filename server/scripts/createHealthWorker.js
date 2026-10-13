const path = require("path");
const readline = require("readline");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const HealthWorker = require("../models/HealthWorker");

const envPath = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: envPath });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error("This script must be run in an interactive terminal."));
      return;
    }

    let password = "";

    const finish = () => {
      process.stdin.setRawMode?.(false);
      process.stdin.removeListener("keypress", onKeypress);
      process.stdout.write("\n");
      resolve(password);
    };

    const onKeypress = (str, key) => {
      if (key && key.ctrl && key.name === "c") {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener("keypress", onKeypress);
        process.stdout.write("\n");
        reject(new Error("Password entry cancelled."));
        return;
      }

      if (key && key.name === "return") {
        finish();
        return;
      }

      if (key && key.name === "backspace") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }

      if (key && key.name === "tab") {
        return;
      }

      if (str && !key?.ctrl && !key?.meta) {
        password += str;
        process.stdout.write("*");
      }
    };

    process.stdin.setRawMode?.(true);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", onKeypress);
    process.stdout.write(prompt);
  });
}

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function createHealthWorker() {
  try {
    const name = await askQuestion("Health worker name: ");
    const email = await askQuestion("Health worker email: ");
    const password = await askHidden("Password (12 or more characters): ");

    if (!name || name.length > 100) {
      throw new Error("Name is required and must not exceed 100 characters.");
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      throw new Error("A valid email address is required.");
    }

    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      throw new Error("Password must be at least 12 characters and no more than 72 UTF-8 bytes.");
    }

    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is not configured in the server environment.");
    }

    await mongoose.connect(mongoUri);

    const existingWorker = await HealthWorker.findOne({ email: normalizedEmail }).lean();

    if (existingWorker) {
      throw new Error("A health worker with that email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await HealthWorker.create({
      name: name.trim(),
      email: normalizedEmail,
      password: passwordHash,
      role: "health_worker",
    });

    console.log("Health worker account created successfully.");
  } catch (error) {
    if (error.code === 11000) {
      console.error("A health worker with that email already exists. Use the password-reset utility.");
    } else if (
      error.message === "A health worker with that email already exists." ||
      error.message === "Name is required and must not exceed 100 characters." ||
      error.message === "A valid email address is required." ||
      error.message === "Password must be at least 12 characters and no more than 72 UTF-8 bytes." ||
      error.message === "MONGODB_URI is not configured in the server environment."
    ) {
      if (error.message === "A health worker with that email already exists.") {
        console.error("A health worker with that email already exists. Use the password-reset utility.");
      } else {
        console.error("Unable to create health worker:", error.message);
      }
    } else {
      console.error("Unable to create health worker. Check the server environment and MongoDB connection.");
    }

    process.exitCode = 1;
  } finally {
    rl.close();

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

createHealthWorker();
