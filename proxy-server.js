// proxy-server.js - With Environment Variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3001;

// Load environment variables
const IBM_API_KEY = process.env.IBM_API_KEY;
const WATSON_ML_URL = process.env.WATSON_ML_URL;
const IAM_TOKEN_URL = process.env.IAM_TOKEN_URL;

// Validate environment variables
if (!IBM_API_KEY || !WATSON_ML_URL || !IAM_TOKEN_URL) {
  console.error("❌ Missing required environment variables!");
  console.error("Please check your .env file");
  process.exit(1);
}

// Enable CORS
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://localhost:3000",
    ],
  })
);

app.use(express.json());

console.log("🚀 AI Detector Proxy Server Starting...");
console.log(`🔑 API Key loaded: ${IBM_API_KEY.substring(0, 10)}...`);

// Token generation endpoint
app.post("/api/token", async (req, res) => {
  console.log("📝 Token request received");

  try {
    // Use API key from request or environment variable
    const apikey = req.body.apikey || IBM_API_KEY;

    const response = await axios.post(
      IAM_TOKEN_URL,
      `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${apikey}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      }
    );

    console.log("✅ Token generated successfully");
    res.json(response.data);
  } catch (error) {
    console.error(
      "❌ Token generation failed:",
      error.response?.data || error.message
    );
    res.status(500).json({
      error: "Token generation failed",
      details: error.response?.data?.error || "Invalid API key",
    });
  }
});

// Prediction endpoint
app.post("/api/predict", async (req, res) => {
  console.log("🔍 Prediction request received");

  try {
    const { token, text } = req.body;

    if (!token || !text) {
      return res.status(400).json({ error: "Token and text are required" });
    }

    console.log("📝 Text length:", text.length);
    console.log("📊 Analyzing full paragraph...");

    const payload = {
      input_data: [
        {
          fields: ["sr.no", "text", "source", "label_name"],
          values: [[1, text, "user", "unknown"]],
        },
      ],
    };

    const response = await axios.post(WATSON_ML_URL, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000,
    });

    const prediction = response.data.predictions[0].values[0][0];
    const probabilities = response.data.predictions[0].values[0][1];
    const aiProbability = probabilities[0];
    const humanProbability = probabilities[1];

    const isAI = prediction === 0;
    const confidence = Math.abs(aiProbability - 0.5) * 2;

    const result = {
      overall: {
        isAI: isAI,
        aiProbability: aiProbability,
        humanProbability: humanProbability,
        confidence: confidence,
        classification: isAI ? "AI Generated" : "Human Written",
      },
      statistics: {
        totalSentences: text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
          .length,
        analyzedSentences: 1,
        aiSentences: isAI ? 1 : 0,
        humanSentences: isAI ? 0 : 1,
      },
      textInfo: {
        originalLength: text.length,
        wordCount: text.split(/\s+/).filter((w) => w.length > 0).length,
        sentenceCount: text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
          .length,
      },
    };

    console.log("✅ Analysis complete");
    console.log(
      `📊 Result: ${result.overall.classification} (${(
        aiProbability * 100
      ).toFixed(1)}% AI)`
    );

    res.json(result);
  } catch (error) {
    console.error("❌ Prediction failed:");
    console.error("Status:", error.response?.status);
    console.error("Message:", error.message);

    res.status(500).json({
      error: "Prediction failed",
      details: error.response?.data || error.message,
      status: error.response?.status || "Network Error",
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "AI Detector Proxy",
    mode: "Full paragraph analysis",
    apiConfigured: !!IBM_API_KEY,
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Proxy server running on http://localhost:${PORT}`);
  console.log(`🔑 Token endpoint: http://localhost:${PORT}/api/token`);
  console.log(`🤖 Predict endpoint: http://localhost:${PORT}/api/predict`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
});
