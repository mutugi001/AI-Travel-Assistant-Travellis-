const BASE_URL = ""; // proxied to backend via vite.config.js in dev

export async function sendMessage(conversationId, message) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed with ${res.status}`);
  }
  return res.json();
}

export async function fetchLeads() {
  const res = await fetch(`${BASE_URL}/api/leads`);
  if (!res.ok) throw new Error("Failed to load leads");
  return res.json();
}
