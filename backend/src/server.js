import "dotenv/config";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";

import { checkGpsBoundingBox, checkGpsAccuracy } from "./checks/gps.js";
import { computeDHash } from "./checks/dedupe.js";
import { checkExifConsistency } from "./checks/exif.js";
import { checkTimestampFreshness } from "./checks/timestamp.js";
import { checkGlareUniformity, checkBezelEdges, checkMoirePeriodicity } from "./checks/imageForensics.js";
import { checkParallax } from "./checks/parallax.js";
import { buildVerdict } from "./checks/verdict.js";
import { DuplicateHashStore } from "./storage/sqlite.js";

const MAX_FILES = 12;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MIME_FORMATS = {
  "image/jpeg": ["jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heif"],
  "image/heif": ["heif"],
};

export async function uploadToIPFS(buffer, originalName, mimeType) {
  if (!process.env.PINATA_JWT) throw new Error("PINATA_JWT is not configured");

  const file = new File([buffer], originalName || "plot-photo.jpg", { type: mimeType || "image/jpeg" });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("network", "public");
  formData.append("name", originalName || "plot-photo.jpg");

  const response = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: formData,
  });
  if (!response.ok) throw new Error(`Pinata upload failed: ${await response.text()}`);

  const result = await response.json();
  if (!result?.data?.cid) throw new Error("Pinata upload returned no CID");
  return result.data.cid;
}

async function runChecks({ frames, lat, lon, gpsAccuracy, captureTimestamp, hashStore }) {
  const primaryFrame = frames[Math.floor(frames.length / 2)].buffer;
  const [gps, gpsAccuracyResult, exif, dHash, glare, bezel, moire, parallax] = await Promise.all([
    Promise.resolve(checkGpsBoundingBox(lat, lon)),
    Promise.resolve(checkGpsAccuracy(gpsAccuracy)),
    checkExifConsistency(primaryFrame),
    computeDHash(primaryFrame),
    checkGlareUniformity(primaryFrame),
    checkBezelEdges(primaryFrame),
    checkMoirePeriodicity(primaryFrame),
    checkParallax(frames.map((frame) => frame.buffer)),
  ]);

  const results = {
    gps,
    gpsAccuracy: gpsAccuracyResult,
    duplicate: hashStore.checkDuplicate(dHash),
    timestampFreshness: checkTimestampFreshness(captureTimestamp),
    exif: { pass: exif.pass, reason: exif.flags.join("; ") || "EXIF consistent", flags: exif.flags },
    glare,
    bezel,
    moire,
    parallax,
  };
  return { ...buildVerdict(results), dHash };
}

function parseRequiredNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw Object.assign(new Error(`${label} is required and must be a number`), { statusCode: 400 });
  }
  return number;
}

async function validateImageFiles(frames) {
  await Promise.all(frames.map(async (frame) => {
    try {
      const metadata = await sharp(frame.buffer, { failOn: "error" }).metadata();
      if (!metadata.width || !metadata.height || !MIME_FORMATS[frame.mimetype]?.includes(metadata.format)) {
        throw new Error("image content does not match its declared MIME type");
      }
    } catch (error) {
      throw Object.assign(new Error(`Invalid image frame (${error.message})`), { statusCode: 415 });
    }
  }));
}

/** Build the HTTP app separately from listening so API tests and hosts can inject dependencies. */
export function createApp({ hashStore = new DuplicateHashStore(), evaluate = runChecks, ipfsUploader = uploadToIPFS } = {}) {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
    fileFilter: (_req, file, callback) => {
      if (!ACCEPTED_IMAGE_TYPES.has(file.mimetype)) {
        callback(Object.assign(new Error(`Unsupported media type: ${file.mimetype || "unknown"}`), { statusCode: 415 }));
        return;
      }
      callback(null, true);
    },
  });

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.post("/api/check", upload.array("frames", MAX_FILES), async (req, res, next) => {
    try {
      const frames = req.files;
      if (!frames?.length) return res.status(400).json({ error: "No frames provided" });
      await validateImageFiles(frames);

      const lat = parseRequiredNumber(req.body.lat, "lat");
      const lon = parseRequiredNumber(req.body.lon, "lon");
      const gpsAccuracy = req.body.gpsAccuracy === undefined ? undefined : parseRequiredNumber(req.body.gpsAccuracy, "gpsAccuracy");
      const captureTimestamp = req.body.captureTimestamp === undefined
        ? undefined
        : parseRequiredNumber(req.body.captureTimestamp, "captureTimestamp");
      const verdict = await evaluate({ frames, lat, lon, gpsAccuracy, captureTimestamp, hashStore });
      const primaryFrame = frames[Math.floor(frames.length / 2)];
      const photoHash = `0x${crypto.createHash("sha256").update(primaryFrame.buffer).digest("hex")}`;

      // FLAGGED and REJECTED evidence are deliberately never pinned or eligible
      // for the wallet/contract flow. Only verified evidence gets a CID.
      let ipfsCID = null;
      if (verdict.verdict === "VERIFIED") {
        ipfsCID = await ipfsUploader(primaryFrame.buffer, primaryFrame.originalname, primaryFrame.mimetype);
        hashStore.recordHash(verdict.dHash, photoHash);
      }

      return res.json({ ...verdict, photoHash, plotId: photoHash, ipfsCID });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT" ? 413 : 400;
      return res.status(status).json({ error: error.message });
    }
    const status = error.statusCode || 500;
    if (status >= 500) console.error(error);
    return res.status(status).json({ error: status >= 500 ? "Check pipeline failed" : error.message, ...(status >= 500 && { detail: error.message }) });
  });
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || 4000;
  createApp().listen(port, () => console.log(`PlotProof anti-spoof service listening on :${port}`));
}

export { ACCEPTED_IMAGE_TYPES, MAX_FILES, MAX_FILE_SIZE };
