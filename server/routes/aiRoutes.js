const express = require("express");
const rateLimit = require("express-rate-limit");
const { GoogleGenAI } = require("@google/genai");
const authMiddleware = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many AI summary requests. Please try again in one minute.",
  },
});

const supportedModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function isValidText(value, minLength, maxLength) {
  return (
    typeof value === "string" &&
    value.trim().length >= minLength &&
    value.trim().length <= maxLength
  );
}

function isValidAge(value) {
  return Number.isInteger(value) && value >= 0 && value <= 130;
}

function validateSummaryRequest(body) {
  if (!body || typeof body !== "object") {
    return "Request body is required.";
  }

  const { patientName, age, gender, village, visitSummary, notes, fictionalSample } = body;

  if (!isValidText(patientName, 2, 100)) {
    return "Patient name must be a string between 2 and 100 characters.";
  }

  if (!isValidAge(age)) {
    return "Age must be a whole number between 0 and 130.";
  }

  if (!["Male", "Female", "Other"].includes(gender)) {
    return "Gender must be one of Male, Female, or Other.";
  }

  if (!isValidText(village, 2, 100)) {
    return "Village must be a string between 2 and 100 characters.";
  }

  if (!isValidText(visitSummary, 10, 2000)) {
    return "Visit summary must be between 10 and 2000 characters.";
  }

  if (notes !== undefined && !isValidText(notes, 0, 2000)) {
    return "Notes must be a string up to 2000 characters.";
  }

  if (fictionalSample !== true) {
    return "This endpoint only accepts fictional sample data for safe demo use.";
  }

  return null;
}

function buildPrompt(data) {
  const safeNotes = data.notes ? `Additional notes: ${data.notes.trim()}` : "Additional notes: None.";

  return `
You are a clinical documentation assistant. Use only the fictional sample patient data below.
Create a concise, non-diagnostic summary suitable for a health worker dashboard.
Return JSON only with this exact structure:
{
  "summary": "string",
  "riskLevel": "low|moderate|high",
  "followUpPlan": "string"
}

Patient information:
- Name: ${data.patientName.trim()}
- Age: ${data.age}
- Gender: ${data.gender}
- Village: ${data.village.trim()}
- Visit summary: ${data.visitSummary.trim()}
- ${safeNotes}

Important rules:
- This is fictional sample data only.
- Do not include any real patient identifiers.
- Do not provide medical diagnoses.
- Keep the response brief and operational.
- Use only safe, general public-health wording.
`;
}

function extractJson(text) {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/({[\s\S]*})/);

  if (jsonMatch) {
    const candidate = jsonMatch[1] || jsonMatch[0];

    try {
      return JSON.parse(candidate);
    } catch (error) {
      return null;
    }
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return null;
  }
}

router.post(
  "/patient-summary",
  authMiddleware,
  allowRoles("health_worker", "admin"),
  aiLimiter,
  async (req, res) => {
    const validationError = validateSummaryRequest(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        message: "AI configuration is not available on this server.",
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: supportedModel,
        contents: [{
          role: "user",
          parts: [{ text: buildPrompt(req.body) }],
        }],
        config: {
          temperature: 0.2,
          maxOutputTokens: 300,
        },
      });

      const generatedText = response?.text || "";
      const parsedResponse = extractJson(generatedText);

      if (!parsedResponse || !parsedResponse.summary || !parsedResponse.followUpPlan) {
        return res.status(502).json({
          message: "The AI model did not return a valid summary payload.",
        });
      }

      return res.json({
        model: supportedModel,
        generatedAt: new Date().toISOString(),
        summary: parsedResponse,
      });
    } catch (error) {
      console.error("Gemini summary generation failed:", error.name || "Error");
      return res.status(502).json({
        message: "Unable to generate the patient summary right now.",
      });
    }
  }
);

module.exports = router;
