const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// ✅ Initialize OpenAI client using new SDK syntax
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Health check route (root)
app.get("/", (req, res) => {
  res.json({ status: "✅ Dignity Filter backend is running" });
});

// ✅ Additional health endpoint
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ✅ Webhook to receive Tally or Make.com submissions
app.post("/tally-webhook", (req, res) => {
  console.log("📥 Received Tally submission:", req.body);

  // Echo back what we received
  res.status(200).json({
    status: "ok",
    received: req.body,
  });
});

// ✅ POST endpoint for evaluation
app.post("/evaluate", async (req, res) => {
  const content = req.body.content;

  const systemPrompt = `
  You are an AI applying the Dignity Filter to evaluate text. 
  For each input, return a JSON with:
  {
    "overall_score": (average of the below),
    "scores": {
      "dignity": -2 to +2,
      "inclusion": -2 to +2,
      "autonomy": -2 to +2,
      "unity": -2 to +2,
      "empathy": -2 to +2
    },
    "flags": [list specific dignity violations],
    "recommendations": [specific actions to improve]
  }

  Scoring rules:
  -2 = strongly violates
  -1 = somewhat violates
  0 = neutral/unclear
  +1 = somewhat supports
  +2 = strongly supports

  Think step by step:
  1. Analyze the text for each dimension.
  2. Justify your score internally.
  3. Output the JSON consistently.

  If the text claims positive ideals but contains harm, bias, or exclusion, reflect that in the scores and flags.

  Be strict, consistent, and never leave flags or recommendations blank if a violation is detected.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content },
      ],
    });

    const resultText = response.choices[0].message.content.trim();
    let parsed;
    try {
      parsed = JSON.parse(resultText);
    } catch (err) {
      // If parsing fails, return raw text
      parsed = { raw: resultText };
    }

    res.json(parsed);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Failed to evaluate.");
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
