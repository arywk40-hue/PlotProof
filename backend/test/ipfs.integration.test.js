import assert from "node:assert/strict";
import test from "node:test";

import { uploadToIPFS } from "../src/server.js";

const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLq5QAAAABJRU5ErkJggg==", "base64");

test("Pinata returns a resolvable CID for a sample image", { skip: !process.env.PINATA_JWT }, async () => {
  const cid = await uploadToIPFS(onePixelPng, "plotproof-integration.png", "image/png");
  // CIDv1 raw blocks commonly begin with bafk, while UnixFS CIDs often begin
  // with bafy; both are valid base32 CIDv1 values returned by Pinata.
  assert.match(cid, /^baf[a-z0-9]+$/);
  const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
  assert.equal(response.ok, true);
});
