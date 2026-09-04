import sharp from "sharp";

/**
 * Computes a difference hash (dHash): a resilient, 64-bit perceptual image
 * fingerprint. Small edits such as recompression or a minor crop still stay
 * close enough to identify reuse.
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
  return hash;
}

export function hammingDistance(hashA, hashB) {
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) distance++;
  }
  return distance;
}
