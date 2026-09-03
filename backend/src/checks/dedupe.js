import sharp from "sharp";

// In-memory store for the hackathon demo. Swap for a real DB (or read
// straight from the on-chain PlotVerified event log) for production —
// the important part is the hashing + Hamming-distance comparison logic,
// which stays the same regardless of storage backend.
const submittedHashes = new Map(); // dHash string -> { plotId, submittedAt }

/**
 * Computes a difference hash (dHash) of an image: a fast, resilient
 * perceptual fingerprint. Small edits (recompression, minor crop, filter)
 * still produce a hash within a few bits of the original, so near-duplicate
 * reuse is caught, not just byte-identical reuse.
 */
export async function computeDHash(imageBuffer) {
  // Shrink to 9x8 grayscale — dHash compares each pixel to its right
  // neighbour across an 8x8 grid, giving a 64-bit fingerprint.
  const { data } = await sharp(imageBuffer)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      hash += left > right ? "1" : "0";
    }
  }
  return hash; // 64-character binary string
}

function hammingDistance(hashA, hashB) {
  let dist = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) dist++;
  }
  return dist;
}

/**
 * Checks a new image's dHash against every previously submitted hash.
 * A Hamming distance <= threshold means "same or near-identical image" —
 * catches straight reuse plus light edits (resave, small crop, filter).
 */
export function checkDuplicate(newHash, threshold = 8) {
  for (const [existingHash, meta] of submittedHashes.entries()) {
    const distance = hammingDistance(newHash, existingHash);
    if (distance <= threshold) {
      return {
        pass: false,
        reason: `Image matches a previous submission (plot ${meta.plotId}, distance ${distance}/64)`,
      };
    }
  }
  return { pass: true, reason: "No matching prior submission found" };
}

export function recordHash(hash, plotId) {
  submittedHashes.set(hash, { plotId, submittedAt: Date.now() });
}
