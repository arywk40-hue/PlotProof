import assert from "node:assert/strict";
import test from "node:test";

import { assertVerifiedEvidence, submitVerifiedEvidence } from "../src/lib/submission.js";

test("FLAGGED evidence is blocked before the contract call", async () => {
  let contractCalls = 0;
  await assert.rejects(
    submitVerifiedEvidence({ verdict: "FLAGGED", ipfsCID: null }, async () => { contractCalls++; }),
    /Only VERIFIED evidence/
  );
  assert.equal(contractCalls, 0);
});

test("only VERIFIED evidence with a CID can proceed to the contract call", async () => {
  let contractCalls = 0;
  const receipt = await submitVerifiedEvidence(
    { verdict: "VERIFIED", ipfsCID: "bafy-test" },
    async () => ({ hash: (++contractCalls, "0xtest") })
  );
  assert.equal(contractCalls, 1);
  assert.equal(receipt.hash, "0xtest");
});
