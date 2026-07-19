import { Router } from "express";
import { getStore } from "../storage/index.js";

export const leadsRouter = Router();

leadsRouter.get("/", async (_req, res) => {
  try {
    const store = getStore();
    const leads = await store.getAllLeads();
    res.json({ leads });
  } catch (err) {
    console.error("[GET /api/leads] error:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
});

leadsRouter.get("/:conversationId", async (req, res) => {
  try {
    const store = getStore();
    const lead = await store.getLead(req.params.conversationId);
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    res.json({ lead });
  } catch (err) {
    console.error("[GET /api/leads/:id] error:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
});
