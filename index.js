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

  const prompt = `Generate 5 multiple choice questions on ${topic}. Return only a JSON array like:
[{"question":"...","options":["A","B","C","D"],"correctAnswerIndex":0}]`;

  try {
    const resp = await axios.post(
      "https://api.cohere.com/v1/chat",
      { message: prompt },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );


    // ✅ Get the raw text
   const generatedText = resp.data.text.trim();
    // ✅ Parse the JSON part
    const questions = JSON.parse(generatedText);
    res.status(200).json({ success: true, questions })

    if (!questions) {
      return res.status(500).json({ error: "Failed to parse questions" });
    }

    // ✅ Save to Firebase
    const ref = db.ref("quizzes").child(topic.replace(/\s/g, "_"));
    await ref.set(questions);

    res.status(200).json({ success: true, questions }); // <- matches your app's format
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
})

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
