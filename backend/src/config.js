import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,

  llmProvider: (process.env.LLM_PROVIDER || "anthropic").toLowerCase(),

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-1.5",
  },

  mongodbUri: process.env.MONGODB_URI || "",

  leadQualifyThreshold: Number(process.env.LEAD_QUALIFY_THRESHOLD || 50),
};
