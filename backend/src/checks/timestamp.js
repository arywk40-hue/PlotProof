const MAX_STALENESS_MS = 5 * 60 * 1000; // 5 minutes — this app captures live, so capture and submission should be near-simultaneous.

/**
 * Compares the app-recorded capture timestamp (set by our own client code
 * at the moment the photo was taken, NOT trusted from file EXIF) against
 * the server's receipt time. A live-capture flow should always show a gap
 * of a few seconds, not hours/days — a large gap suggests the client was
 * tampered with or a stale timestamp was replayed.
 */
export function checkTimestampFreshness(captureTimestampMs, serverReceivedAtMs = Date.now()) {
  if (!captureTimestampMs || typeof captureTimestampMs !== "number") {
    return { pass: false, reason: "No capture timestamp provided by client" };
  }

  const delta = serverReceivedAtMs - captureTimestampMs;

  if (delta < 0) {
    return { pass: false, reason: "Capture timestamp is in the future — clock mismatch or tampering" };
  }

  if (delta > MAX_STALENESS_MS) {
    return {
      pass: false,
      reason: `Capture-to-submission gap too large (${Math.round(delta / 1000)}s) — expected near-instant for live capture`,
    };
  }

  return { pass: true, reason: `Capture-to-submission gap is ${Math.round(delta / 1000)}s, consistent with live capture` };
}
