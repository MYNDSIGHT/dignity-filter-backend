const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// ✅ Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Health check routes
app.get("/", (req, res) => {
  res.json({ status: "✅ Dignity Filter backend is running" });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ✅ Direct evaluation route
app.post("/evaluate", async (req, res) => {
  const content = req.body.content;
  if (!content || content.trim() === "") {
    return res.status(400).json({ error: "No content provided" });
  }

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

Think step by step and output valid JSON.
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
    } catch {
      parsed = { raw: resultText };
    }

    res.json(parsed);
  } catch (error) {
    console.error("Error in /evaluate:", error);
    res.status(500).send("Failed to evaluate.");
  }
});

// ✅ Webhook route for Tally/Make.com
app.post("/tally-webhook", async (req, res) => {
  try {
    const submittedText =
      req.body.message || req.body.content || req.body.Submission || "";

    if (!submittedText || submittedText.trim() === "") {
      console.error("❌ No valid text field in payload:", req.body);
      return res.status(400).json({ error: "No valid text provided." });
    }

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

Think step by step and output valid JSON.
`;

    const responseAI = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: submittedText },
      ],
    });

    const resultText = responseAI.choices[0].message.content.trim();
    let parsed;
    try {
      parsed = JSON.parse(resultText);
    } catch {
      parsed = { raw: resultText };
    }

    console.log("✅ Webhook scorecard:", parsed);

    res.status(200).json({
      status: "ok",
      scorecard: parsed,
      original: req.body,
    });
  } catch (error) {
    console.error("Error in /tally-webhook:", error);
    res.status(500).send("Failed to process submission.");
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
