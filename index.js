const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(express.json());

// ✅ Firebase init
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync("serviceAccountKey.json"))
  ),
  databaseURL: process.env.FIREBASE_DB_URL,
});

const db = admin.database();

// ✅ POST /generate-quiz
app.post("/generate-quiz", async (req, res) => {
  const { topic } = req.body;

  const prompt = `Generate 5 multiple choice questions (MCQs) for the topic "${topic}". Format as JSON:
[{"question":"...","options":["opt1","opt2","opt3","opt4"],"correctAnswerIndex":0}]`;

  try {
    const hfResponse = await axios.post(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // ✅ Get the raw text
    const rawText = hfResponse.data[0]?.generated_text || "";
    console.log("Raw response:", rawText);

    // ✅ Parse the JSON part
    const questions = extractJson(rawText); // Helper function below

    if (!questions) {
      return res.status(500).json({ error: "Failed to parse questions" });
    }

    // ✅ Save to Firebase
    const ref = db.ref("quizzes").child(topic.replace(/\s/g, "_"));
    await ref.set(questions);

    res.status(200).json({ success: true, questions }); // <- matches your app's format
  } catch (error) {
    console.error("Error generating quiz:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Helper: extract JSON array from raw response
function extractJson(text) {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/); // regex to catch JSON array
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    return null;
  }
}

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI quiz generator running on port ${PORT}`));
