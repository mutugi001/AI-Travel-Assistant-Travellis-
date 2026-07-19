import express from "express";
import cors from "cors";
import { config } from "./src/config.js";
import { initStorage } from "./src/storage/index.js";
import { chatRouter } from "./src/routes/chat.js";
import { leadsRouter } from "./src/routes/leads.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/chat", chatRouter);
app.use("/api/leads", leadsRouter);

async function start() {
  await initStorage();
  app.listen(config.port, () => {
    console.log(`Travel Lead Assistant backend running on http://localhost:${config.port}`);
    console.log(`LLM provider: ${config.llmProvider}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
