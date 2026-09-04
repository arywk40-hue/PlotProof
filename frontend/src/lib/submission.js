/** Only a fully VERIFIED server verdict is eligible for the irreversible contract transaction. */
export function assertVerifiedEvidence(verdict) {
  if (verdict?.verdict !== "VERIFIED" || !verdict?.ipfsCID) {
    throw new Error("Only VERIFIED evidence with an IPFS CID can be recorded on-chain. FLAGGED evidence is routed to manual review.");
  }
}

export async function submitVerifiedEvidence(verdict, submit) {
  assertVerifiedEvidence(verdict);
  return submit();
}
