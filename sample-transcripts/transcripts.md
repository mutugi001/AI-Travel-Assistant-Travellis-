# Sample Conversation Transcripts

These are representative transcripts showing how the assistant behaves
across the score range, matching the scoring logic in the main README.
(Generated as illustrative examples of expected behavior — running the live
app against a real LLM will produce natural variations in wording.)

---

## Transcript A — Qualifies as a hot lead

```
User: I'm planning a honeymoon in Bali this December.
Aria: That's exciting! Congratulations 🎉 How many people will be travelling?

User: Two adults.
Aria: Lovely. Do you already have a budget in mind for the trip?

User: Around Rs 2 lakh.
Aria: Great, that's helpful. If you'd like a travel consultant to put
      together personalized packages for you, could I get your name and
      phone number?

User: Rahul Verma, +91 9999999999
Aria: Thank you, Rahul! I've passed your Bali honeymoon plans along — a
      consultant will reach out shortly with some options.
```

**Resulting lead JSON:**

```json
{
  "conversationId": "conv_A1001",
  "customer": { "name": "Rahul Verma", "phone": "+91 9999999999", "email": null },
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
    "leadScore": 91,
    "confidence": "High",
    "reason": "intent classified as \"ready_to_buy\" (+65); 4 travel detail(s) captured (destination, tripType, travellers, budget) (+26); contact info provided (name + phone) (+18); capped at 100",
    "summary": "2 traveller(s), honeymoon trip, to Bali, around December, with a budget of Rs 2,00,000."
  },
  "status": "qualified",
  "createdAt": "2026-07-18T10:32:00Z",
  "updatedAt": "2026-07-18T10:34:11Z"
}
```

---

## Transcript B — Interested, but declines to share contact

```
User: We're thinking of a family trip to Europe next summer, maybe 4 of us.
Aria: Sounds wonderful! Do you have a rough budget or particular countries
      in mind?

User: Not sure on countries yet, budget maybe $6000 total.
Aria: Good to know. Since it sounds like you're actively planning, would
      you like a consultant to reach out with some family-friendly Europe
      itineraries? If so, could I get your name and number?

User: I'd rather not share my number right now, just exploring options.
Aria: No problem at all! I'll keep helping here — want some suggestions
      for family-friendly Europe destinations to narrow things down?
```

**Resulting lead JSON:**

```json
{
  "conversationId": "conv_B1002",
  "customer": { "name": null, "phone": null, "email": null },
  "travel": {
    "destination": null,
    "departureCity": null,
    "travelDate": "next summer",
    "travellers": 4,
    "budget": "$6000",
    "duration": null,
    "tripType": "Family",
    "specialRequirements": null
  },
  "qualification": {
    "leadScore": 45,
    "confidence": "Medium",
    "reason": "intent classified as \"planning\" (+50); 3 travel detail(s) captured (travellers, budget, travelDate) (+18) [tripType +5 also captured]; no contact info yet",
    "summary": "4 traveller(s), family trip, around next summer, with a budget of $6000."
  },
  "status": "interested_no_contact",
  "createdAt": "2026-07-18T11:02:40Z",
  "updatedAt": "2026-07-18T11:04:02Z"
}
```

---

## Transcript C — Pure browsing, no personal trip signal

```
User: What's the best time of year to visit Japan?
Aria: Spring (March–May) for cherry blossoms or autumn (Oct–Nov) for foliage
      are usually the most popular — both have great weather too. Are you
      thinking about a trip there yourself?

User: Just curious for now, no plans yet.
Aria: Totally understandable — happy to help whenever you're ready. Anything
      else about Japan I can tell you about?
```

**Resulting lead JSON:** *(not stored — below the "worth storing" floor)*

```json
{
  "conversationId": "conv_C1003",
  "customer": { "name": null, "phone": null, "email": null },
  "travel": {
    "destination": "Japan",
    "departureCity": null,
    "travelDate": null,
    "travellers": null,
    "budget": null,
    "duration": null,
    "tripType": null,
    "specialRequirements": null
  },
  "qualification": {
    "leadScore": 13,
    "confidence": "Low",
    "reason": "intent classified as \"browsing\" (+5); 1 travel detail(s) captured (destination) (+8); no contact info yet",
    "summary": "To Japan."
  },
  "status": null
}
```
