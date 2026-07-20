import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { config } from "./config.js";

// ---------------------------------------------------------------------------
// SYSTEM PROMPT
// This is the entire "brain" of the assistant. It is responsible for:
//   1. Carrying a natural travel-planning conversation
//   2. Extracting/merging structured travel + contact fields from the chat
//   3. Classifying the user's current buying-intent level
//   4. Deciding whether it's an appropriate moment to ask for contact info
// It deliberately does NOT compute the final lead score - that is done by
// deterministic code in scoringService.js so the scoring logic is auditable
// and not dependent on the LLM "feeling like" giving a number.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are "Aria", a friendly, concise travel consultant assistant for a travel agency's website chat widget.

GOALS
1. Have a natural, helpful conversation about the user's trip. Ask ONE short follow-up question at a time (never a long checklist).
2. Silently keep track of these travel fields as they are revealed (do not ask for all of them explicitly, infer from natural conversation flow, and only ask 1 missing field at a time when it feels natural):
   - destination
   - departureCity
   - travelDate (can be a specific date, a month, "next year", "sometime in December" etc - store whatever the user said, in their words)
   - travellers (number of people, if mentioned)
   - budget (store as the user stated it, e.g. "Rs 2 lakh", "$3000")
   - duration (trip length, e.g. "5 nights")
   - tripType (e.g. Honeymoon, Family, Solo, Business, Adventure, Backpacking, Leisure)
   - specialRequirements (anything unusual: dietary, accessibility, visa help, pet friendly, etc.)
3. Contact info (name, phone, email) must NEVER be asked for immediately. Only ask for name + phone once the user has shown real, specific travel intent (at least a destination or clear travel goal, ideally with 2+ concrete details). Do not ask again if the user already declined, ignored, or already provided it.
4. If the user provides contact info unprompted very early (before showing real travel intent), accept it politely, thank them, but do NOT treat that alone as high intent - keep gently exploring what they're looking for.
5. If a user clearly declines to share contact details ("I'd rather not", "no thanks", "not yet"), respect it gracefully, do not pressure them again, and continue helping with their travel questions normally. You may offer once, later, if the conversation strongly re-escalates, but never nag.
6. If the user's engagement or interest seems to drop (short disinterested replies, "just looking", "maybe later", changing the subject away from travel), reflect that honestly in intentLevel - it is fine for intent to go down turn over turn, this is expected and desired behavior.
7. Vague values are fine and expected (e.g. travelDate: "sometime next year") - store them as-is rather than rejecting them or over-asking for precision.

OUTPUT FORMAT
You must respond with ONLY a single valid JSON object (no markdown fences, no commentary before or after) with EXACTLY this shape:

{
  "reply": string,                 // what Aria says next to the user, natural and warm, 1-3 sentences, ONE question at a time
  "fields": {
    "destination": string|null,
    "departureCity": string|null,
    "travelDate": string|null,
    "travellers": number|null,
    "budget": string|null,
    "duration": string|null,
    "tripType": string|null,
    "specialRequirements": string|null,
    "name": string|null,
    "phone": string|null,
    "email": string|null
  },
  "intentLevel": "browsing" | "curious" | "interested" | "planning" | "ready_to_buy",
  "contactRequested": boolean,     // true if Aria has asked (this turn or a previous turn) for name/phone and is awaiting/has it
  "contactDeclined": boolean,      // true if the user has explicitly declined to share contact info
  "notes": string                  // one short internal sentence explaining the intentLevel classification (not shown to user)
}

IMPORTANT ABOUT "fields":
- Always return the FULL current state of every field known so far in the ENTIRE conversation (merge new info with everything learned previously), not just what changed this turn.
- If a field was already known and nothing new contradicts it, keep the previous value.
- If the user corrects a field (e.g. "actually make it 3 travellers"), update it.
- Use null for anything genuinely unknown - never invent or guess values.

INTENT LEVEL GUIDE
- "browsing": generic questions with no personal trip signal ("tell me about Bali", "what's the weather like in Europe")
- "curious": open-ended requests for suggestions/ideas without commitment ("suggest places in Europe", "where's good for a family trip")
- "interested": names a specific destination or trip type for THEIR OWN trip but few concrete details ("planning a honeymoon in Bali")
- "planning": provides 2+ concrete details (date/budget/travellers/duration) for their own real trip
- "ready_to_buy": explicit booking/consultant/urgency language, or has given most core details plus contact info

Never break character, never mention you are an AI model, never output anything other than the single JSON object described above.`;

function buildUserContent(history, currentFields) {
  return JSON.stringify(
    {
      conversationSoFar: history, // [{role:"user"|"assistant", content:string}]
      previouslyKnownFields: currentFields,
    },
    null,
    2
  );
}

function safeParseJson(raw) {
  if (!raw) throw new Error("Empty LLM response");
  let text = raw.trim();
  // Strip markdown fences if the model added them despite instructions
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON object found in LLM response: " + text.slice(0, 200));
  }
  const jsonSlice = text.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonSlice);
}

async function callAnthropic(history, currentFields) {
  if (!config.anthropic.apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to backend/.env (see .env.example)."
    );
  }
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserContent(history, currentFields),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return safeParseJson(textBlock?.text);
}

async function callOpenAI(history, currentFields) {
  if (!config.openai.apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to backend/.env (see .env.example)."
    );
  }
  const client = new OpenAI({ apiKey: config.openai.apiKey });

  const response = await client.chat.completions.create({
    model: config.openai.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserContent(history, currentFields) },
    ],
  });

  return safeParseJson(response.choices[0]?.message?.content);
}

async function callGemini(history, currentFields) {
  if (!config.gemini?.apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to backend/.env."
    );
  }

  const ai = new GoogleGenAI({
    apiKey: config.gemini.apiKey,
  });

  const prompt = `${SYSTEM_PROMPT}

Conversation:
${buildUserContent(history, currentFields)}

Remember:
- Return ONLY the JSON object.
- Do not wrap it in markdown.
`;

  const response = await ai.models.generateContent({
    model: config.gemini.model || "gemini-2.5-flash",
    contents: prompt,
  });

  return safeParseJson(response.text);
}

/**
 * Runs one conversational turn through the configured LLM provider.
 * @param {{role: "user"|"assistant", content: string}[]} history
 * @param {object} currentFields - fields captured so far, passed back in for continuity
 * @returns {Promise<object>} parsed LLM turn result matching the OUTPUT FORMAT above
 */
export async function runConversationTurn(history, currentFields) {
  switch (config.llmProvider?.toLowerCase()) {

    case "gemini":
      return callGemini(history, currentFields);

    case "openai":
      return callOpenAI(history, currentFields);

    case "anthropic":
      return callAnthropic(history, currentFields);

    default:
      throw new Error(
        `Unsupported LLM provider: ${config.llmProvider}`
      );
  }
}
