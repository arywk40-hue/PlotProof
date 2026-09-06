import test from "node:test";
import assert from "node:assert/strict";
import { retryRpc, waitForConfirmation } from "../src/lib/rpcRetry.js";

test("rate limits back off and show retry progress before succeeding", async () => {
  let calls = 0;
  const delays = [], statuses = [];
  const result = await retryRpc(async () => {
    if (++calls < 3) throw { info: { response: { statusCode: 429 } } };
    return "record";
  }, { sleep: async (ms) => delays.push(ms), onStatus: (s) => statuses.push(s) });
  assert.equal(result, "record");
  assert.deepEqual(delays, [1000, 2000]);
  assert.equal(statuses.length, 2);
});

test("timeouts exhaust bounded retries; reverts and wallet rejection are not retried", async () => {
  for (const code of ["TIMEOUT", "CALL_EXCEPTION", "ACTION_REJECTED"]) {
    let calls = 0;
    await assert.rejects(retryRpc(async () => { calls++; throw Object.assign(new Error(code), { code }); },
      { sleep: async () => {} }));
    assert.equal(calls, code === "TIMEOUT" ? 4 : 1);
  }
});

test("confirmation uses three-minute wait and preserves hash when confirmation fails", async () => {
  const tx = { hash: "0xsubmitted", wait: async (confirms, timeout) => {
    assert.equal(confirms, 1);
    assert.equal(timeout, 180000);
    throw new Error("disconnected");
  } };
  await assert.rejects(waitForConfirmation(tx), (error) => error.transactionHash === tx.hash);
});
