const CONFIDENCE_STYLES = {
  High: { label: "HIGH", className: "score-badge--high" },
  Medium: { label: "MED", className: "score-badge--medium" },
  Low: { label: "LOW", className: "score-badge--low" },
};

export default function ScoreBadge({ leadScore = 0, confidence = "Low" }) {
  const bars = 20;
  const filled = Math.round((leadScore / 100) * bars);
  const conf = CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.Low;

  return (
    <div className="score-badge">
      <div className="score-badge__top">
        <span className="score-badge__number">{leadScore}</span>
        <span className={`score-badge__confidence ${conf.className}`}>{conf.label} CONFIDENCE</span>
      </div>
      <div className="score-badge__meter" aria-hidden="true">
        {Array.from({ length: bars }).map((_, i) => (
          <span key={i} className={`score-badge__bar ${i < filled ? "score-badge__bar--on" : ""}`} />
        ))}
      </div>
      <div className="score-badge__caption">LEAD SCORE / 100</div>
    </div>
  );
}
