import { useState } from "react";
import LiveCapture from "../components/LiveCapture.jsx";
import VerdictCard from "../components/VerdictCard.jsx";
import { BACKEND_URL } from "../lib/config.js";
import { connectWallet, submitPlotOnChain, keccak256OfImage } from "../lib/chain.js";

const STEP = {
  INTRO: "intro",
  CAPTURE: "capture",
  CHECKING: "checking",
  RESULT: "result",
  SUBMITTING: "submitting",
  DONE: "done",
};

export default function CapturePage() {
  const [step, setStep] = useState(STEP.INTRO);
  const [error, setError] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [capturedData, setCapturedData] = useState(null);
  const [txReceipt, setTxReceipt] = useState(null);

  async function handleCaptured({ frames, lat, lon, gpsAccuracy, captureTimestamp }) {
    setCapturedData({ frames, lat, lon });
    setStep(STEP.CHECKING);
    setError(null);

    try {
      const formData = new FormData();
      frames.forEach((blob, i) => formData.append("frames", blob, `frame${i}.jpg`));
      formData.append("lat", String(lat));
      formData.append("lon", String(lon));
      formData.append("gpsAccuracy", String(gpsAccuracy));
      formData.append("captureTimestamp", String(captureTimestamp));

      const res = await fetch(`${BACKEND_URL}/api/check`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Check service returned ${res.status}`);
      const data = await res.json();
      setVerdict(data);
      setStep(STEP.RESULT);
    } catch (err) {
      setError(err.message);
      setStep(STEP.RESULT);
    }
  }

  async function handleSubmitOnChain() {
    setStep(STEP.SUBMITTING);
    setError(null);
    try {
      const { signer } = await connectWallet();
      // Use the middle frame — same selection logic the backend uses as
      // the sharpest, least-motion-blurred frame — for the anchored hash.
      const middleFrame = capturedData.frames[Math.floor(capturedData.frames.length / 2)];
      const photoHash = await keccak256OfImage(middleFrame);
      const receipt = await submitPlotOnChain(signer, photoHash, capturedData.lat, capturedData.lon,verdict.ipfsCID);
      setTxReceipt(receipt);
      setStep(STEP.DONE);
    } catch (err) {
      setError(err.message);
      setStep(STEP.RESULT);
    }
  }

  function reset() {
    setStep(STEP.INTRO);
    setVerdict(null);
    setCapturedData(null);
    setTxReceipt(null);
    setError(null);
  }

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      {step === STEP.INTRO && (
        <>
          <h1 style={{ fontSize: 28 }}>Submit your plot</h1>
          <p>
            You'll use your camera directly — no photo uploads. Pan slowly across your field for a few seconds so we
            can confirm it's a real, current view of your land.
          </p>
          <button className="btn btn-primary" onClick={() => setStep(STEP.CAPTURE)}>
            Open camera
          </button>
        </>
      )}

      {step === STEP.CAPTURE && (
        <LiveCapture onCaptured={handleCaptured} onError={(msg) => setError(msg)} />
      )}

      {step === STEP.CHECKING && (
        <div className="ledger-card" style={{ textAlign: "center" }}>
          <p>Checking your submission…</p>
        </div>
      )}

      {step === STEP.RESULT && verdict && (
        <>
          <VerdictCard verdict={verdict} />
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            {(verdict.verdict === "VERIFIED" || verdict.verdict === "FLAGGED") && (
              <button className="btn btn-primary" onClick={handleSubmitOnChain}>
                {verdict.verdict === "FLAGGED" ? "Submit for review anyway" : "Record on-chain"}
              </button>
            )}
            <button className="btn btn-secondary" onClick={reset}>
              Try again
            </button>
          </div>
        </>
      )}

      {step === STEP.SUBMITTING && (
        <div className="ledger-card" style={{ textAlign: "center" }}>
          <p>Confirm the transaction in your wallet…</p>
        </div>
      )}

      {step === STEP.DONE && txReceipt && (
        <div className="ledger-card">
          <h3 style={{ color: "var(--canopy-700)" }}>Recorded on-chain</h3>
          <p>Your plot record is now permanent and your reward has been credited.</p>
          <span className="field-label">Transaction</span>
          <span className="mono">{txReceipt.hash}</span>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={reset}>
              Submit another plot
            </button>
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: "var(--stamp-600)", marginTop: 16 }}>
          {error}
        </p>
      )}
    </div>
  );
}
