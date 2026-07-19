import ScoreBadge from "./ScoreBadge.jsx";

function Field({ label, value }) {
  return (
    <div className="ticket-field">
      <span className="ticket-field__label">{label}</span>
      <span className={`ticket-field__value ${!value ? "ticket-field__value--empty" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function CapturedFieldsPanel({ fields, qualification, leadStatus }) {
  const from = fields.departureCity || "?????";
  const to = fields.destination || "?????";

  return (
    <aside className="ticket">
      <div className="ticket__header">
        <span className="ticket__brand">ARIA TRAVEL</span>
        <span className="ticket__tag">LEAD CAPTURE STUB</span>
      </div>

      <div className="ticket__route">
        <div className="ticket__route-city">
          <span className="ticket__route-code">{from.slice(0, 3).toUpperCase()}</span>
          <span className="ticket__route-name">{from}</span>
        </div>
        <div className="ticket__route-plane" aria-hidden="true">✈</div>
        <div className="ticket__route-city ticket__route-city--right">
          <span className="ticket__route-code">{to.slice(0, 3).toUpperCase()}</span>
          <span className="ticket__route-name">{to}</span>
        </div>
      </div>

      <div className="ticket__perforation" aria-hidden="true" />

      <div className="ticket__grid">
        <Field label="Trip type" value={fields.tripType} />
        <Field label="Travel date" value={fields.travelDate} />
        <Field label="Travellers" value={fields.travellers} />
        <Field label="Duration" value={fields.duration} />
        <Field label="Budget" value={fields.budget} />
        <Field label="Special requirements" value={fields.specialRequirements} />
      </div>

      <div className="ticket__perforation" aria-hidden="true" />

      <div className="ticket__grid">
        <Field label="Passenger name" value={fields.name} />
        <Field label="Phone" value={fields.phone} />
        <Field label="Email" value={fields.email} />
      </div>

      {leadStatus && (
        <div className={`ticket__status ticket__status--${leadStatus}`}>
          {leadStatus === "qualified" && "QUALIFIED LEAD — STORED"}
          {leadStatus === "contact_only" && "CONTACT CAPTURED — NO TRIP INTENT YET"}
          {leadStatus === "interested_no_contact" && "INTERESTED — AWAITING CONTACT"}
          {leadStatus === "exploring" && "STILL EXPLORING"}
        </div>
      )}

      <div className="ticket__perforation" aria-hidden="true" />

      <div className="ticket__scoring">
        <ScoreBadge leadScore={qualification?.leadScore ?? 0} confidence={qualification?.confidence ?? "Low"} />
        {qualification?.summary && <p className="ticket__summary">{qualification.summary}</p>}
        {qualification?.reason && <p className="ticket__reason">{qualification.reason}</p>}
      </div>
    </aside>
  );
}
