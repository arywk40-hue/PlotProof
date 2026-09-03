const VERDICT_STYLE = {
  VERIFIED: { color: "var(--canopy-700)", label: "Verified" },
  FLAGGED: { color: "var(--soil-600)", label: "Flagged for review" },
  REJECTED: { color: "var(--stamp-600)", label: "Rejected" },
};

const CHECK_LABELS = {
  gps: "Location in known growing region",
  gpsAccuracy: "GPS accuracy",
  duplicate: "Not a reused image",
  timestampFreshness: "Captured live, just now",
  exif: "Metadata consistency",
  glare: "No screen glare detected",
  bezel: "No device bezel detected",
  moire: "No screen-replay pattern",
  parallax: "Real depth (parallax) detected",
};

export default function VerdictCard({ verdict }) {
  const style = VERDICT_STYLE[verdict.verdict] || VERDICT_STYLE.REJECTED;

  return (
    <div className="ledger-card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: style.color,
          }}
        />
        <h3 style={{ margin: 0, color: style.color, fontSize: 20 }}>{style.label}</h3>
      </div>

      {verdict.note && <p style={{ fontSize: 14 }}>{verdict.note}</p>}

      <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {Object.entries(verdict.results || {}).map(([key, result]) => (
          <div
            key={key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              padding: "8px 0",
              borderBottom: "1px solid var(--paper-line)",
              fontSize: 14,
            }}
          >
            <span style={{ color: "var(--ink)", fontWeight: 500 }}>{CHECK_LABELS[key] || key}</span>
            <span style={{ color: result.pass ? "var(--canopy-700)" : "var(--stamp-600)", textAlign: "right" }}>
              {result.pass ? "Pass" : "Flagged"}
            </span>
          </div>
        ))}
      </div>

      {verdict.photoHash && (
        <div style={{ marginTop: 16 }}>
          <span className="field-label">Record hash</span>
          <span className="mono">{verdict.photoHash}</span>
        </div>
      )}
    </div>
  );
}
