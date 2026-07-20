# Aria — AI-Powered Travel Lead Assistant

A chat assistant that talks naturally with website visitors about their travel
plans, silently extracts structured trip details as the conversation unfolds,
judges how likely the visitor is to become a paying customer, and — once
there's genuine intent plus a name and phone number — stores a scored lead
for a human travel consultant to follow up on.

Built for the "AI-Powered Travel Lead Assistant" internship assignment.

```
travel-lead-assistant/
├── backend/     Node.js + Express API (LLM orchestration + scoring + storage)
├── frontend/    React (Vite) chat UI with a live "captured fields" ticket panel
└── sample-transcripts/   Example conversations + resulting lead JSON
```

---

## 1. Quick start

### Backend

```bash
cd backend
npm install
cp .env.example .env
# then edit .env and add your ANTHROPIC_API_KEY (or switch to OpenAI, see below)
npm start
```

Runs on `http://localhost:4000`. No database setup is required — by default
it stores conversations/leads in JSON files under `backend/data/`. To use
MongoDB (or a Mongo-compatible Supabase/Atlas connection) instead, just set
`MONGODB_URI` in `.env`; the app switches automatically and falls back to the
JSON store if the connection fails.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` and proxies `/api` calls to the backend
(configured in `vite.config.js`).

### Switching LLM provider

Set `LLM_PROVIDER=anthropic` or `LLM_PROVIDER=openai` in `backend/.env`, along
with the matching API key. Both providers are already implemented in
`backend/src/llmService.js` — swapping in Gemini or another provider just
means adding one more `callXyz()` function following the same pattern
(send the system prompt + conversation, parse the JSON reply).

---

## 2. Overall approach

Every user message runs through one LLM call (`llmService.js`) that returns a
single JSON object containing:

- `reply` — the next natural-language thing Aria says (one short question at
  a time, never a form-like checklist)
- `fields` — the **full, merged** state of every travel + contact field known
  so far in the conversation (destination, dates, travellers, budget,
  duration, trip type, special requirements, name, phone, email)
- `intentLevel` — the model's classification of current buying intent:
  `browsing → curious → interested → planning → ready_to_buy`
- `contactRequested` / `contactDeclined` — flags so Aria never re-asks for
  contact info after it's been requested or explicitly declined

I deliberately **did not** ask the LLM to output the final 0–100 lead score
itself. A model-guessed number is hard to justify to a sales team and drifts
between calls with no explanation. Instead:

- The **LLM** does the part only an LLM can do well: reading free-form text,
  extracting structured fields, and judging buying-intent language.
- **Deterministic code** (`scoringService.js`) does the part that must be
  consistent and explainable: turning `(fields, intentLevel)` into an exact
  score, confidence label, and human-readable reason string.

This means "why is this lead an 82?" always has a precise, reproducible
answer instead of "the model felt like it."

---

## 3. Lead scoring logic

```
leadScore = intentBase(intentLevel) + fieldCompletenessPoints + contactBonus
           (capped at 100)
```

**1. Intent base** — points purely from the LLM's classified intent. This is
what separates "tell me about Bali" (browsing) from "planning a honeymoon in
Bali" (interested), even though both mention a destination:

| intentLevel   | points |
|---------------|--------|
| browsing      | 5      |
| curious       | 15     |
| interested    | 35     |
| planning      | 50     |
| ready_to_buy  | 65     |

**2. Field completeness** — small extra points per concrete travel detail
captured, so a more specific conversation scores higher than a vague one at
the same intent level (max ≈35 pts):

| field               | points |
|---------------------|--------|
| destination         | 8      |
| budget              | 8      |
| tripType            | 5      |
| travellers          | 5      |
| travelDate          | 5      |
| duration            | 2      |
| departureCity       | 2      |
| specialRequirements | 2      |

**3. Contact bonus** — only meaningful on top of real travel signal:

- `name` present → +6
- `phone` present → +12 (weighted highest since it's the field that actually
  enables follow-up)
- **Guardrail:** if contact info is given but there is *zero* travel signal
  at all (pure browsing intent, no fields filled), the contact bonus is
  halved — a stray phone number with no stated need is a *captured contact*,
  not yet a *qualified lead*.

**Confidence** is derived from the score **and** whether we can actually act
on it:

- `High` — score ≥ 70 **and** a phone number is present
- `Medium` — score ≥ 40, or score ≥ 70 but no phone yet (a hot prospect we
  still can't call)
- `Low` — everything else

**When is a lead persisted to storage?**

- **Qualified** (`status: "qualified"`): name + phone present and
  `leadScore ≥ LEAD_QUALIFY_THRESHOLD` (default 50, configurable via env)
- Also stored, but flagged differently, so nothing valuable is silently
  dropped:
  - `contact_only` — phone given but no real travel intent yet
  - `interested_no_contact` — clear interest but the user declined to share
    contact info
  - `exploring` — early browsing, kept live in the UI but not treated as a
    sales-ready lead

This mirrors how a real inbox should behave: only "qualified" leads should
interrupt a consultant's day, but nothing is thrown away.

---

## 4. Edge cases

| Edge case | How it's handled |
|---|---|
| **User shares contact info unprompted, very early** | Accepted and stored immediately (nothing is ever refused), but `contactBonus` is halved when there's no accompanying travel signal, so a bare "here's my number" doesn't fake a hot lead. Aria continues the conversation normally to learn what they actually want. |
| **User shows interest but declines contact** | The LLM sets `contactDeclined: true` and is instructed never to ask again in that conversation. The lead is still persisted as `interested_no_contact` (confidence capped at Medium, since we have no way to follow up) so the interest isn't lost — a consultant could still reach out through the channel the chat came from. |
| **Interest drops mid-conversation** | Every turn is re-scored from scratch using the *whole* conversation history (not an only-increasing running total), so a shift to "just looking", short replies, or changing the subject naturally lowers `intentLevel` and therefore the score on the next turn. |
| **Vague dates ("sometime next year")** | The LLM is explicitly instructed to store vague values as-is rather than pestering for precision. `travelDate` still counts toward field-completeness scoring since it *is* a real signal, just an imprecise one. |
| **User corrects earlier info** ("actually, 3 travellers") | The LLM re-emits the full field set each turn and is instructed to overwrite on correction; the backend's merge step (`mergeFields` in `chat.js`) is append-only *per field* so a stray `null` from the model can never silently erase previously known data — only an explicit new value overwrites. |
| **Ambiguous / one-off questions with no personal trip signal** | Classified as `browsing`/`curious`, scoring low (5–25 range) even if a place name is mentioned, matching the assignment's own examples ("Tell me about Bali" ≈ low score). |

---

## 5. Lead data shape

```json
{
  "conversationId": "conv_18422",
  "customer": { "name": "Rahul Verma", "phone": "+91 999999999", "email": null },
  "travel": {
    "destination": "Bali",
    "departureCity": null,
    "travelDate": "December",
    "travellers": 2,
    "budget": "Rs 2,00,000",
    "duration": null,
    "tripType": "Honeymoon",
    "specialRequirements": null
  },
  "qualification": {
    "leadScore": 95,
    "confidence": "High",
    "reason": "intent classified as \"ready_to_buy\" (+65); 4 travel detail(s) captured (destination, tripType, travellers, budget) (+26); contact info provided (name + phone) (+18) — capped at 100",
    "summary": "2 traveller(s), honeymoon trip, to Bali, around December, with a budget of Rs 2,00,000."
  },
  "status": "qualified",
  "createdAt": "2026-07-18T10:32:00Z",
  "updatedAt": "2026-07-18T10:34:11Z"
}
```

See `sample-transcripts/` for 3 full example conversations with their
resulting lead JSON (also summarized below).

---

## 6. Sample conversations (see `sample-transcripts/` for the full versions)

### Transcript A — qualifies as a hot lead
A user planning a Bali honeymoon shares destination, trip type, traveller
count and budget, then gives name + phone → ends around **leadScore 90+,
High confidence, status: qualified**.

### Transcript B — interested but declines contact
A user researching a Europe family trip shares several details but says
"I'd rather not share my number right now" → ends around **leadScore ~45,
Medium confidence, status: interested_no_contact** — captured for a
consultant to potentially re-engage, but not pushed further in-chat.

### Transcript C — pure browsing, no real intent
A user asks generic questions ("what's the best time to visit Japan?") with
no personal trip signal → stays around **leadScore 5–15, Low confidence**,
and is not stored as a lead at all (below the 30-point "worth storing" floor).

---

## 7. Architecture notes / assumptions

- **UI requirement**: the right-hand "boarding pass" ticket panel shows every
  captured field live, plus the current lead score, confidence, and status,
  updated after every message — no need to scroll back through the chat to
  see what's been gathered.
- **Storage**: JSON-file storage is the zero-config default so the project
  runs immediately; `MONGODB_URI` switches to MongoDB (also
  compatible with a Mongo-flavored connection string from most hosted
  providers) with no code changes needed elsewhere.
- **Conversation identity**: a `conversationId` is generated on the first
  message and reused for the rest of the session; the frontend keeps it in
  React state (a real product would persist it e.g. in a cookie).
- **Single LLM call per turn**: extraction, intent classification, and reply
  generation happen in one call for latency/cost efficiency, since a travel
  chat widget needs to feel snappy. Scoring is split out into deterministic
  code as explained in section 3.
- Where the assignment left something unspecified, I made the most
  product-reasonable assumption and documented it above rather than blocking
  on it (per the assignment's own guidance).
