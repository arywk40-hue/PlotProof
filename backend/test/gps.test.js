import assert from "node:assert/strict";
import test from "node:test";

import { checkGpsBoundingBox } from "../src/checks/gps.js";

test("accepts a Kolkata-area location for the India pilot", () => {
  const result = checkGpsBoundingBox(22.5726, 88.3639);
  assert.equal(result.pass, true);
  assert.equal(result.region, "India pilot");
});

test("rejects coordinates outside supported pilot regions", () => {
  assert.equal(checkGpsBoundingBox(51.5072, -0.1276).pass, false);
});
