const path = require("path");
const readline = require("readline");
const bcrypt = require("bcryptjs");
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

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
      reject(new Error("Password entry requires an interactive terminal."));
      return;
    }

    let password = "";
    const finish = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.removeListener("keypress", onKeypress);
      process.stdout.write("\n");

      if (error) {
        reject(error);
      } else {
        resolve(password);
      }
    };

    const onKeypress = (character, key) => {
      if (key?.ctrl && key.name === "c") {
        finish(new Error("Password entry cancelled."));
        return;
      }

      if (key?.name === "return") {
        finish();
        return;
      }

      if (key?.name === "backspace") {
        password = password.slice(0, -1);
        return;
      }

      if (character && !key?.ctrl && !key?.meta) {
        password += character;
      }
    };

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on("keypress", onKeypress);
    process.stdout.write(prompt);
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeFailure(message) {
  const error = new Error(message);
  error.safeToDisplay = true;
  return error;
}

async function resetHealthWorkerPassword() {
  try {
    const email = (await askQuestion("Health worker email: ")).toLowerCase();

    if (!isValidEmail(email)) {
      throw safeFailure("A valid email address is required.");
    }

    const password = await askHidden("New password (12 or more characters): ");
    const confirmation = await askHidden("Confirm new password: ");

    if (password !== confirmation) {
      throw safeFailure("The passwords do not match. No changes were made.");
    }

    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      throw safeFailure("Password must be at least 12 characters and no more than 72 UTF-8 bytes.");
    }

    if (!process.env.MONGODB_URI) {
      throw safeFailure("MONGODB_URI is not configured in server/.env.");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const worker = await HealthWorker.findOne({ email }).select("_id role").lean();

    if (!worker) {
      throw safeFailure("No account exists for that email. No account was created or changed.");
    }

    if (worker.role !== "health_worker") {
      throw safeFailure("That account is not assigned the health_worker role. No changes were made.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await HealthWorker.updateOne(
      { _id: worker._id, role: "health_worker" },
      { $set: { password: passwordHash } }
    );

    if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
      throw safeFailure("The worker account changed before it could be updated. No password was reset.");
    }

    console.log("Health-worker password reset successfully.");
  } catch (error) {
    if (error.safeToDisplay) {
      console.error(error.message);
    } else {
      console.error("Unable to reset the health-worker password. Check server/.env and MongoDB connectivity.");
    }

    process.exitCode = 1;
  } finally {
    rl.close();

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

resetHealthWorkerPassword();
