import { Router } from "express";
import { nanoid } from "nanoid";
import { getStore } from "../storage/index.js";
import { runConversationTurn } from "../llmService.js";
import { scoreLead, isQualified } from "../scoringService.js";
import { config } from "../config.js";

export const chatRouter = Router();

const EMPTY_FIELDS = {
  destination: null,
  departureCity: null,
  travelDate: null,
  travellers: null,
  budget: null,
  duration: null,
  tripType: null,
  specialRequirements: null,
  name: null,
  phone: null,
  email: null,
};

// Merge helper: prefer the LLM's newly returned value, but never let a real
// previously-known value get silently wiped out by a stray null (LLM
// hiccups happen - this keeps captured data sticky/append-only per field).
function mergeFields(previous, incoming) {
  const merged = { ...EMPTY_FIELDS, ...previous };
  for (const key of Object.keys(EMPTY_FIELDS)) {
    const newVal = incoming?.[key];
    if (newVal !== null && newVal !== undefined && newVal !== "") {
      merged[key] = newVal;
    }
  }
  return merged;
}

chatRouter.post("/", async (req, res) => {
  try {
    const { conversationId: incomingId, message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message (string) is required" });
    }

    const conversationId = incomingId || `conv_${nanoid(10)}`;
    const store = getStore();

    const existing = (await store.getConversation(conversationId)) || {
      conversationId,
      messages: [],
      fields: { ...EMPTY_FIELDS },
      intentLevel: "browsing",
      contactRequested: false,
      contactDeclined: false,
    };

    const messages = [...existing.messages, { role: "user", content: message }];

    const llmResult = await runConversationTurn(messages, existing.fields);

    const mergedFields = mergeFields(existing.fields, llmResult.fields || {});
    const intentLevel = llmResult.intentLevel || existing.intentLevel || "browsing";
    const contactRequested = !!llmResult.contactRequested || existing.contactRequested;
    const contactDeclined = !!llmResult.contactDeclined || existing.contactDeclined;

    const fullMessages = [...messages, { role: "assistant", content: llmResult.reply }];

    const updatedConversation = await store.saveConversation(conversationId, {
      conversationId,
      messages: fullMessages,
      fields: mergedFields,
      intentLevel,
      contactRequested,
      contactDeclined,
    });

    const { leadScore, confidence, reason, summary } = scoreLead(mergedFields, intentLevel);

    let leadRecord = null;
    const qualified = isQualified(mergedFields, leadScore, config.leadQualifyThreshold);

    // Persist a lead record once there's *any* meaningful signal worth a
    // salesperson glancing at (qualified, or contact given even if the score
    // is still building) - see README "edge cases" section for rationale.
    const worthStoring =
      qualified || mergedFields.phone || mergedFields.name || leadScore >= 30;

    if (worthStoring) {
      let status = "exploring";
      if (qualified) status = "qualified";
      else if (mergedFields.phone && !mergedFields.name) status = "contact_only";
      else if (contactDeclined && leadScore >= 40) status = "interested_no_contact";

      leadRecord = await store.upsertLead(conversationId, {
        customer: {
          name: mergedFields.name,
          phone: mergedFields.phone,
          email: mergedFields.email,
        },
        travel: {
          destination: mergedFields.destination,
          departureCity: mergedFields.departureCity,
          travelDate: mergedFields.travelDate,
          travellers: mergedFields.travellers,
          budget: mergedFields.budget,
          duration: mergedFields.duration,
          tripType: mergedFields.tripType,
          specialRequirements: mergedFields.specialRequirements,
        },
        qualification: { leadScore, confidence, reason, summary },
        status,
      });
    }

    res.json({
      conversationId,
      reply: llmResult.reply,
      fields: mergedFields,
      intentLevel,
      contactRequested,
      contactDeclined,
      qualification: { leadScore, confidence, reason, summary },
      leadStatus: leadRecord?.status || null,
      leadStored: !!leadRecord,
    });
  } catch (err) {
    console.error("[POST /api/chat] error:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
});
