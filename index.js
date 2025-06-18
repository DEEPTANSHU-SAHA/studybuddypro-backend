const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
require("dotenv").config();
const fs = require("fs");

// Firebase Admin Setup
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync("serviceAccountKey.json"))),
  databaseURL: process.env.FIREBASE_DB_URL
});

const db = admin.database();
const app = express();
app.use(express.json());

app.post("/generate-quiz", async (req, res) => {
  const { topic } = req.body;

  const prompt = `Generate 5 multiple choice questions (MCQs) for the topic "${topic}". Format:
[
  {
    "question": "...",
    "options": ["", "", "", ""],
    "correctAnswerIndex": 0
  }
]`;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    const questions = JSON.parse(response.data.choices[0].message.content);
    const ref = db.ref("quizzes").child(topic.replace(/\s/g, "_"));
    await ref.set(questions);

    res.status(200).json({ success: true, topic });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI quiz generator running on port ${PORT}`));
