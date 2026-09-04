import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="container">
      <h1 style={{ fontSize: 42, maxWidth: "16ch" }}>Proof of an unburned field, from the farmer who stands on it.</h1>
      <p style={{ fontSize: 18 }}>
        Satellites lose track of small, mixed-crop plots. PlotProof lets a smallholder verify their own land with a
        phone — a live-captured photo, checked for tampering, permanently recorded on-chain, rewarded on the spot.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 32 }}>
        <Link to="/capture" className="btn btn-primary">
          Submit a plot
        </Link>
        <Link to="/dashboard" className="btn btn-secondary">
          Look up a record
        </Link>
      </div>

      <div className="ledger-card" style={{ marginTop: 56 }}>
        <h3 style={{ fontSize: 18 }}>How a submission is verified</h3>
        <ol style={{ color: "var(--ink-soft)", paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Open the camera in-app and move sideways while panning across the plot — no file uploads accepted.</li>
          <li>Location, time, and a burst of frames are captured automatically.</li>
          <li>Automated checks screen for reused images, spoofed GPS, and screen-replay attempts.</li>
          <li>A passing record is hashed and written to the Farmer smart contract on Sepolia.</li>
          <li>A reward is credited to the submitting wallet immediately.</li>
        </ol>
      </div>
    </div>
  );
}
