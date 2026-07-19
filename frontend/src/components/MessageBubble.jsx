export default function MessageBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`bubble-row ${isUser ? "bubble-row--user" : "bubble-row--assistant"}`}>
      {!isUser && <div className="bubble-avatar">A</div>}
      <div className={`bubble ${isUser ? "bubble--user" : "bubble--assistant"}`}>{content}</div>
    </div>
  );
}
