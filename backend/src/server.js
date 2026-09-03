import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";

import { checkGpsBoundingBox, checkGpsAccuracy } from "./checks/gps.js";
import { computeDHash, checkDuplicate, recordHash } from "./checks/dedupe.js";
import { checkExifConsistency } from "./checks/exif.js";
import { checkTimestampFreshness } from "./checks/timestamp.js";
import { checkGlareUniformity, checkBezelEdges, checkMoirePeriodicity } from "./checks/imageForensics.js";
import { checkParallax } from "./checks/parallax.js";
import { buildVerdict } from "./checks/verdict.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: "2mb" }));
async function uploadToIPFS(buffer, originalName, mimeType) {
  if (!process.env.PINATA_JWT) {
    throw new Error("PINATA_JWT is not configured");
  }

  const file = new File(
    [buffer],
    originalName || "plot-photo.jpg",
    { type: mimeType || "image/jpeg" }
  );

  const formData = new FormData();

  formData.append("file", file);
  formData.append("network", "public");
  formData.append("name", originalName || "plot-photo.jpg");

  const response = await fetch(
    "https://uploads.pinata.cloud/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed: ${errorText}`);
  }

  const result = await response.json();

  return result.data.cid;
}
/**
 * POST /api/check
 * multipart/form-data:
 *   - frames: image files, burst captured during the pan gesture (first..last chronological)
 *   - lat, lon: numbers (string form ok)
 *   - gpsAccuracy: number, meters (optional)
 *   - captureTimestamp: number, ms epoch, set client-side at moment of capture
 *
 * Returns the full verdict + per-check breakdown, plus the photoHash to
 * anchor on-chain if verdict is VERIFIED.
 */
app.post("/api/check", upload.array("frames", 12), async (req, res) => {
  try {
    const frames = req.files;
    if (!frames || frames.length === 0) {
      return res.status(400).json({ error: "No frames provided" });
    }

    const lat = parseFloat(req.body.lat);
    const lon = parseFloat(req.body.lon);
    const gpsAccuracy = req.body.gpsAccuracy ? parseFloat(req.body.gpsAccuracy) : undefined;
    const captureTimestamp = req.body.captureTimestamp ? parseInt(req.body.captureTimestamp, 10) : undefined;

    const primaryFrame = frames[Math.floor(frames.length / 2)].buffer; // middle frame = sharpest, least motion blur

    const [gpsBox, gpsAcc, exif, dHash, glare, bezel, moire, parallax] = await Promise.all([
      Promise.resolve(checkGpsBoundingBox(lat, lon)),
      Promise.resolve(checkGpsAccuracy(gpsAccuracy)),
      checkExifConsistency(primaryFrame),
      computeDHash(primaryFrame),
      checkGlareUniformity(primaryFrame),
      checkBezelEdges(primaryFrame),
      checkMoirePeriodicity(primaryFrame),
      checkParallax(frames.map((f) => f.buffer)),
    ]);

    const duplicate = checkDuplicate(dHash);
    const timestampFreshness = checkTimestampFreshness(captureTimestamp);

    const results = {
      gps: gpsBox,
      gpsAccuracy: gpsAcc,
      duplicate,
      timestampFreshness,
      exif: { pass: exif.pass, reason: exif.flags.join("; ") || "EXIF consistent", flags: exif.flags },
      glare,
      bezel,
      moire,
      parallax,
    };

    const verdict = buildVerdict(results);

    const photoHash = "0x" + crypto.createHash("sha256").update(primaryFrame).digest("hex");
    // Note: for on-chain anchoring, the frontend independently computes a
    // keccak256 hash of the same bytes (Ethereum-native hashing) — this
    // sha256 is just a stable server-side reference id for the demo API.

    let ipfsCID = null;

if (verdict.verdict === "VERIFIED") {
  recordHash(dHash, photoHash);

  const middleFrame = frames[Math.floor(frames.length / 2)];

  ipfsCID = await uploadToIPFS(
    middleFrame.buffer,
    middleFrame.originalname,
    middleFrame.mimetype
  );
}

res.json({
  ...verdict,
  photoHash,
  plotId: photoHash,
  ipfsCID,
});}catch (err) {
    console.error(err);
    res.status(500).json({ error: "Check pipeline failed", detail: err.message });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`PlotProof anti-spoof service listening on :${PORT}`));
