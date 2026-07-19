import { useEffect, useRef, useState } from "react";
import MessageBubble from "./components/MessageBubble.jsx";
import CapturedFieldsPanel from "./components/CapturedFieldsPanel.jsx";
import { sendMessage, fetchLeads } from "./api.js";

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

const GREETING = {
  role: "assistant",
  content: "Hi, I'm Aria ✈️ Where are you dreaming of travelling to?",
};

export default function App() {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [qualification, setQualification] = useState({ leadScore: 0, confidence: "Low" });
  const [leadStatus, setLeadStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showLeads, setShowLeads] = useState(false);
  const [leads, setLeads] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const data = await sendMessage(conversationId, trimmed);
      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setFields(data.fields);
      setQualification(data.qualification);
      setLeadStatus(data.leadStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenLeads() {
    setShowLeads(true);
    try {
      const data = await fetchLeads();
      setLeads(data.leads || []);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleReset() {
    setConversationId(null);
    setMessages([GREETING]);
    setFields(EMPTY_FIELDS);
    setQualification({ leadScore: 0, confidence: "Low" });
    setLeadStatus(null);
    setError(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="app-title">Aria — Travel Lead Assistant</h1>
          <p className="app-subtitle">AI concierge chat with live lead capture</p>
        </div>
        <div className="app-header__actions">
          <button className="btn btn--ghost" onClick={handleOpenLeads}>
            View stored leads
          </button>
          <button className="btn btn--ghost" onClick={handleReset}>
            New conversation
          </button>
        </div>
      </header>

      <main className="app-main">
        <section className="chat-panel">
          <div className="chat-scroll" ref={scrollRef}>
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
            {loading && (
              <div className="bubble-row bubble-row--assistant">
                <div className="bubble-avatar">A</div>
                <div className="bubble bubble--assistant bubble--typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
          </div>

          {error && <div className="chat-error">{error}</div>}

          <form className="chat-input-row" onSubmit={handleSend}>
            <input
              className="chat-input"
              placeholder="Tell Aria about your trip..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button className="btn btn--primary" type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </section>

        <CapturedFieldsPanel fields={fields} qualification={qualification} leadStatus={leadStatus} />
      </main>

      {showLeads && (
        <div className="modal-backdrop" onClick={() => setShowLeads(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>Stored leads ({leads.length})</h2>
              <button className="btn btn--ghost" onClick={() => setShowLeads(false)}>
                Close
              </button>
            </div>
            <div className="modal__body">
              {leads.length === 0 && <p>No leads captured yet.</p>}
              {leads.map((lead) => (
                <div key={lead.conversationId} className="lead-row">
                  <div className="lead-row__top">
                    <strong>{lead.customer?.name || "Unnamed"}</strong>
                    <span className={`lead-pill lead-pill--${lead.qualification?.confidence?.toLowerCase()}`}>
                      {lead.qualification?.leadScore} · {lead.qualification?.confidence}
                    </span>
                  </div>
                  <div className="lead-row__meta">
                    {lead.customer?.phone || "no phone"} · {lead.travel?.destination || "no destination"} ·{" "}
                    {lead.status}
                  </div>
                  <div className="lead-row__summary">{lead.qualification?.summary}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
