// ---------------------------------------------------------------------------
// Deterministic lead scoring.
//
// Why deterministic (not just "ask the LLM for a number 0-100")?
// A raw LLM-guessed score is hard to justify to a sales team and drifts
// between calls. Instead we let the LLM do the part only an LLM can do well
// (reading natural language and classifying buying intent + extracting
// fields), and we compute the actual 0-100 score with fixed, auditable
// weights in code. That way "why is this an 82?" always has an exact answer.
//
// Score = intentBase + fieldCompletenessPoints + contactBonus, capped at 100.
//
//   1. intentBase - points purely for the LLM's classified intent level.
//      This is what separates "tell me about Bali" (browsing) from
//      "planning a honeymoon in Bali" (interested) even though both might
//      mention the same destination field.
//        browsing      -> 5
//        curious        -> 15
//        interested     -> 35
//        planning       -> 50
//        ready_to_buy   -> 65
//
//   2. fieldCompletenessPoints - small additional points per concrete travel
//      detail captured, so a conversation with more specifics scores higher
//      than a vague one at the same intent level. Max ~35 pts.
//        destination        +8
//        tripType            +5
//        travellers          +5
//        budget              +8
//        travelDate          +5
//        duration            +2
//        departureCity       +2
//        specialRequirements +2 (bonus, shows deeper engagement)
//
//   3. contactBonus - only awarded on top of existing travel signal, so a
//      contact-only message (no travel intent at all) cannot alone produce a
//      "hot" lead:
//        name present  -> +6
//        phone present -> +12 (phone is the field that actually enables
//                              follow-up, so it is weighted highest)
//      If contact info is present but there is truly zero travel signal
//      (intentBase <= 5 and no fields filled at all), the contact bonus is
//      halved - a stray phone number with no stated need is not yet a
//      qualified lead, just a captured contact.
// ---------------------------------------------------------------------------

const INTENT_BASE = {
  browsing: 5,
  curious: 15,
  interested: 35,
  planning: 50,
  ready_to_buy: 65,
};

const FIELD_WEIGHTS = {
  destination: 8,
  tripType: 5,
  travellers: 5,
  budget: 8,
  travelDate: 5,
  duration: 2,
  departureCity: 2,
  specialRequirements: 2,
};

export function scoreLead(fields, intentLevel) {
  const intentBase = INTENT_BASE[intentLevel] ?? INTENT_BASE.browsing;

  let fieldPoints = 0;
  let filledTravelFieldCount = 0;
  for (const [key, weight] of Object.entries(FIELD_WEIGHTS)) {
    if (fields[key] !== null && fields[key] !== undefined && fields[key] !== "") {
      fieldPoints += weight;
      filledTravelFieldCount += 1;
    }
  }

  let contactBonus = 0;
  const hasName = !!fields.name;
  const hasPhone = !!fields.phone;
  if (hasName) contactBonus += 6;
  if (hasPhone) contactBonus += 12;

  const noRealTravelSignal = intentBase <= INTENT_BASE.browsing && filledTravelFieldCount === 0;
  if (noRealTravelSignal && contactBonus > 0) {
    contactBonus = Math.round(contactBonus / 2);
  }

  const rawScore = intentBase + fieldPoints + contactBonus;
  const leadScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Confidence reflects not just the score but whether we actually have a
  // usable way to follow up (phone number). A high score without a phone
  // number is a hot prospect we still can't call, so confidence is capped.
  let confidence;
  if (leadScore >= 70 && hasPhone) {
    confidence = "High";
  } else if (leadScore >= 40 || (leadScore >= 70 && !hasPhone)) {
    confidence = "Medium";
  } else {
    confidence = "Low";
  }

  const reasonParts = [];
  reasonParts.push(`intent classified as "${intentLevel}" (+${intentBase})`);
  if (filledTravelFieldCount > 0) {
    const filledNames = Object.keys(FIELD_WEIGHTS).filter(
      (k) => fields[k] !== null && fields[k] !== undefined && fields[k] !== ""
    );
    reasonParts.push(`${filledTravelFieldCount} travel detail(s) captured (${filledNames.join(", ")}) (+${fieldPoints})`);
  } else {
    reasonParts.push("no concrete travel details captured yet");
  }
  if (contactBonus > 0) {
    reasonParts.push(
      `contact info provided (${[hasName && "name", hasPhone && "phone"].filter(Boolean).join(" + ")}) (+${contactBonus})`
    );
  } else {
    reasonParts.push("no contact info yet");
  }
  const reason = reasonParts.join("; ");

  const summary = buildSummary(fields);

  return { leadScore, confidence, reason, summary, intentBase, fieldPoints, contactBonus };
}

function buildSummary(fields) {
  const parts = [];
  if (fields.travellers) parts.push(`${fields.travellers} traveller(s)`);
  if (fields.tripType) parts.push(`${fields.tripType.toLowerCase()} trip`);
  if (fields.destination) parts.push(`to ${fields.destination}`);
  if (fields.departureCity) parts.push(`from ${fields.departureCity}`);
  if (fields.travelDate) parts.push(`around ${fields.travelDate}`);
  if (fields.duration) parts.push(`for ${fields.duration}`);
  if (fields.budget) parts.push(`with a budget of ${fields.budget}`);
  if (fields.specialRequirements) parts.push(`(note: ${fields.specialRequirements})`);

  if (parts.length === 0) return "No concrete travel requirements captured yet.";
  const sentence = parts.join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

/**
 * Decide whether the current state should be persisted as a "qualified" lead.
 * Rules (see README for edge-case rationale):
 *  - name + phone + score >= threshold  -> fully qualified lead
 *  - phone present (even without name) + score >= threshold - 15 -> qualified,
 *    slightly relaxed since phone alone is enough to follow up
 *  - otherwise -> not yet stored as a qualified lead (still visible live in UI,
 *    but not persisted to the leads table until it clears the bar)
 */
export function isQualified(fields, leadScore, threshold) {
  if (fields.name && fields.phone && leadScore >= threshold) return true;
  if (fields.phone && leadScore >= Math.max(0, threshold - 15)) return true;
  return false;
}
