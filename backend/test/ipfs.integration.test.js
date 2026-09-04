import assert from "node:assert/strict";
import test from "node:test";

import { uploadToIPFS } from "../src/server.js";

const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLq5QAAAABJRU5ErkJggg==", "base64");

test("Pinata returns a resolvable CID for a sample image", { skip: !process.env.PINATA_JWT }, async () => {
  const cid = await uploadToIPFS(onePixelPng, "plotproof-integration.png", "image/png");
  assert.match(cid, /^bafy[a-z0-9]+$/);
  const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
  assert.equal(response.ok, true);
});
