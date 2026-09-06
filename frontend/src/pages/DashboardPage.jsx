import { useState } from "react";
import { fetchPlot } from "../lib/chain.js";

export default function DashboardPage() {
  const [plotId, setPlotId] = useState("");
  const [plot, setPlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("");

  async function handleLookup(e) {
    e.preventDefault();
    setLoading(true);
    setStatus("Looking up…");
    setError(null);
    setPlot(null);
    try {
      const result = await fetchPlot(plotId.trim(), setStatus);
      if (!result.exists) {
        setError("No record found for that hash.");
      } else {
        setPlot(result);
      }
    } catch (err) {
      setError(err.message || "Lookup failed — check the hash and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: 28 }}>Look up a plot record</h1>
      <p>Enter a plot's record hash (from a QR code or receipt) to view its verified, on-chain history.</p>

      <form onSubmit={handleLookup} style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "24px 0" }}>
        <input
          type="text"
          value={plotId}
          onChange={(e) => setPlotId(e.target.value)}
          placeholder="0x…"
          className="mono"
          style={{
            flex: 1,
            padding: "12px 14px",
            border: "1px solid var(--paper-line)",
            borderRadius: 6,
            background: "var(--paper-100)",
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={loading || !plotId.trim()}>
          {loading ? "Looking up…" : "Look up"}
        </button>
      </form>
      {loading && <p role="status">{status}</p>}

      {error && <p style={{ color: "var(--stamp-600)" }}>{error}</p>}

      {plot && (
        <div className="ledger-card">
          <h3 style={{ color: "var(--canopy-700)", fontSize: 18 }}>Verified plot record</h3>
          <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", margin: 0, fontSize: 14 }}>
            <dt style={{ color: "var(--ink-soft)" }}>Submitted by</dt>
            <dd className="mono" style={{ margin: 0 }}>
              {plot.submitter}
            </dd>
            <dt style={{ color: "var(--ink-soft)" }}>Location</dt>
            <dd style={{ margin: 0 }}>
              {plot.lat.toFixed(6)}, {plot.lon.toFixed(6)}
            </dd>
            <dt style={{ color: "var(--ink-soft)" }}>Recorded at</dt>
            <dd style={{ margin: 0 }}>{new Date(plot.timestamp * 1000).toLocaleString()}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
