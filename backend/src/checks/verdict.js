/**
 * Combines individual check results into one verdict.
 *
 * Philosophy (matches the proposal's honesty about limits): hard,
 * high-confidence checks (GPS, duplicate, timestamp) can reject outright.
 * Soft forensic signals (glare, bezel, moire, parallax) are individually
 * fallible, so instead of any single one causing an automatic reject,
 * they accumulate into a suspicion score. Above a threshold -> REJECT.
 * A middling score -> FLAGGED for manual cooperative-level review, never
 * silently auto-approved.
 */

const HARD_CHECK_NAMES = ["gps", "duplicate", "timestampFreshness"];
const SOFT_CHECK_NAMES = ["glare", "bezel", "moire", "parallax", "exif"];

export function buildVerdict(results) {
  const failedHard = HARD_CHECK_NAMES.filter((name) => results[name] && results[name].pass === false);

  if (failedHard.length > 0) {
    return {
      verdict: "REJECTED",
      reasons: failedHard.map((name) => `[${name}] ${results[name].reason}`),
      results,
    };
  }

  const failedSoft = SOFT_CHECK_NAMES.filter((name) => results[name] && results[name].pass === false);

  if (failedSoft.length === 0) {
    return { verdict: "VERIFIED", reasons: ["All checks passed"], results };
  }

  if (failedSoft.length === 1) {
    return {
      verdict: "FLAGGED",
      reasons: failedSoft.map((name) => `[${name}] ${results[name].reason}`),
      results,
      note: "One soft signal tripped — routed to manual cooperative review rather than auto-rejected.",
    };
  }

  return {
    verdict: "REJECTED",
    reasons: failedSoft.map((name) => `[${name}] ${results[name].reason}`),
    results,
    note: "Multiple independent screen-replay signals tripped together — high-confidence reject.",
  };
}
