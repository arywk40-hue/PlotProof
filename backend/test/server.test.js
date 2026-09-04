import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createApp, MAX_FILE_SIZE } from "../src/server.js";
import { DuplicateHashStore } from "../src/storage/sqlite.js";
import { buildVerdict } from "../src/checks/verdict.js";
import { checkExifConsistency } from "../src/checks/exif.js";

const image = new Blob([
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLq5QAAAABJRU5ErkJggg==", "base64"),
], { type: "image/png" });

function passingResults(duplicate = { pass: true, reason: "new image" }) {
  const pass = { pass: true, reason: "pass" };
  return { gps: pass, gpsAccuracy: pass, duplicate, timestampFreshness: pass, exif: pass, glare: pass, bezel: pass, moire: pass, parallax: pass };
}

async function withServer(options, run) {
  const server = createApp(options).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    options.hashStore?.close();
  }
}

function submission(fields = {}, files = 1) {
  const form = new FormData();
  for (let i = 0; i < files; i++) form.append("frames", image, `frame-${i}.png`);
  form.append("lat", "-1.2");
  form.append("lon", "101.4");
  form.append("gpsAccuracy", "12");
  form.append("captureTimestamp", String(Date.now()));
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

test("GET /api/health reports service readiness", async () => {
  const hashStore = new DuplicateHashStore(":memory:");
  await withServer({ hashStore }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("POST /api/check rejects an empty submission", async () => {
  const hashStore = new DuplicateHashStore(":memory:");
  await withServer({ hashStore }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/check`, { method: "POST", body: new FormData() });
    assert.equal(response.status, 400);
  });
});

test("POST /api/check rejects missing or blank numeric form fields", async () => {
  const hashStore = new DuplicateHashStore(":memory:");
  const evaluate = async () => {
    throw new Error("numeric validation should run before evidence evaluation");
  };
  await withServer({ hashStore, evaluate }, async (baseUrl) => {
    for (const [field, value] of [["lat", ""], ["lon", "   "], ["captureTimestamp", ""]]) {
      const response = await fetch(`${baseUrl}/api/check`, {
        method: "POST",
        body: submission({ [field]: value }),
      });
      assert.equal(response.status, 400, `${field} should reject ${JSON.stringify(value)}`);
    }
  });
});

test("POST /api/check rejects non-image files, oversized files, and excessive frame counts", async () => {
  const hashStore = new DuplicateHashStore(":memory:");
  await withServer({ hashStore }, async (baseUrl) => {
    const invalid = new FormData();
    invalid.append("frames", new Blob(["not an image"], { type: "text/plain" }), "notes.txt");
    const invalidResponse = await fetch(`${baseUrl}/api/check`, { method: "POST", body: invalid });
    assert.equal(invalidResponse.status, 415);

    const spoofedMime = new FormData();
    spoofedMime.append("frames", new Blob(["not an image"], { type: "image/jpeg" }), "spoofed.jpg");
    const spoofedMimeResponse = await fetch(`${baseUrl}/api/check`, { method: "POST", body: spoofedMime });
    assert.equal(spoofedMimeResponse.status, 415);

    const oversized = submission();
    oversized.set("frames", new Blob([Buffer.alloc(MAX_FILE_SIZE + 1)], { type: "image/jpeg" }), "too-large.jpg");
    const oversizedResponse = await fetch(`${baseUrl}/api/check`, { method: "POST", body: oversized });
    assert.equal(oversizedResponse.status, 413);

    const tooManyResponse = await fetch(`${baseUrl}/api/check`, { method: "POST", body: submission({}, 13) });
    assert.equal(tooManyResponse.status, 413);
  });
});

test("duplicate history survives a SQLite store restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "plotproof-db-"));
  const databasePath = join(directory, "history.sqlite");
  try {
    const firstStore = new DuplicateHashStore(databasePath);
    firstStore.recordHash("0".repeat(64), "plot-1");
    firstStore.close();

    const restartedStore = new DuplicateHashStore(databasePath);
    assert.equal(restartedStore.checkDuplicate("0".repeat(64)).pass, false);
    restartedStore.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("duplicate image history is persisted and blocks a subsequent verified submission", async () => {
  const hashStore = new DuplicateHashStore(":memory:");
  let uploads = 0;
  const evaluate = async ({ hashStore: store }) => {
    const duplicate = store.checkDuplicate("1".repeat(64));
    return { ...buildVerdict(passingResults(duplicate)), dHash: "1".repeat(64) };
  };
  await withServer({ hashStore, evaluate, ipfsUploader: async () => { uploads++; return "bafy-test"; } }, async (baseUrl) => {
    const first = await fetch(`${baseUrl}/api/check`, { method: "POST", body: submission() });
    assert.equal((await first.json()).verdict, "VERIFIED");
    const second = await fetch(`${baseUrl}/api/check`, { method: "POST", body: submission() });
    const body = await second.json();
    assert.equal(body.verdict, "REJECTED");
    assert.equal(body.ipfsCID, null);
    assert.equal(uploads, 1);
  });
});

test("FLAGGED evidence is not pinned and has no on-chain CID", async () => {
  const hashStore = new DuplicateHashStore(":memory:");
  let uploads = 0;
  const evaluate = async () => ({
    ...buildVerdict({ ...passingResults(), parallax: { pass: false, reason: "needs manual review" } }),
    dHash: "0".repeat(64),
  });
  await withServer({ hashStore, evaluate, ipfsUploader: async () => { uploads++; return "must-not-upload"; } }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/check`, { method: "POST", body: submission() });
    const body = await response.json();
    assert.equal(body.verdict, "FLAGGED");
    assert.equal(body.ipfsCID, null);
    assert.equal(uploads, 0);
  });
});

test("canvas-captured images without EXIF are not treated as tampered evidence", async () => {
  const result = await checkExifConsistency(Buffer.from(await image.arrayBuffer()));
  assert.equal(result.pass, true);
  assert.equal(result.metadataUnavailable, true);
});
