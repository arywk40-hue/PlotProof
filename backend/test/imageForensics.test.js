import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { checkMoirePeriodicity } from "../src/checks/imageForensics.js";

test("does not label a low-texture scene as a screen-replay pattern", async () => {
  const image = await sharp({
    create: { width: 128, height: 128, channels: 3, background: { r: 140, g: 140, b: 140 } },
  }).png().toBuffer();
  const result = await checkMoirePeriodicity(image);
  assert.equal(result.pass, true);
  assert.match(result.reason, /too little local texture/);
});
