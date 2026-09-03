import sharp from "sharp";

/**
 * PARALLAX CHECK — the strongest anti-screen-replay signal.
 *
 * The capture flow asks the farmer to pan their phone slowly across the
 * field while a burst of frames is recorded. In a real 3D scene, near
 * objects (grass, low plants) shift more between frames than far objects
 * (tree line, horizon) as the camera moves — classic motion parallax.
 * A flat screen/printout being filmed has no depth: every part of the
 * image shifts together by the same amount, because it *is* a flat plane.
 *
 * This computes a simple block-matching motion estimate for a "near" band
 * (bottom third of frame) and a "far" band (top third) between the first
 * and last frames of the burst, then compares the two motion magnitudes.
 * Real scenes: near-band motion should differ noticeably from far-band
 * motion. Screen replay: the two motions will be nearly identical.
 */

const ANALYSIS_WIDTH = 160;
const ANALYSIS_HEIGHT = 160;
const BLOCK_SIZE = 16;
const SEARCH_RANGE = 12;

async function toGrayscaleRaw(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .resize(ANALYSIS_WIDTH, ANALYSIS_HEIGHT, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { pixels: data, width: info.width, height: info.height };
}

function blockDifference(a, aX, aY, b, bX, bY, width) {
  let diff = 0;
  for (let dy = 0; dy < BLOCK_SIZE; dy++) {
    for (let dx = 0; dx < BLOCK_SIZE; dx++) {
      diff += Math.abs(a[(aY + dy) * width + (aX + dx)] - b[(bY + dy) * width + (bX + dx)]);
    }
  }
  return diff;
}

/**
 * Estimates average motion vector magnitude for a horizontal band of the
 * image between two frames using block matching (search only in x, since
 * a horizontal pan is what the capture flow asks for).
 */
function estimateBandMotion(frameA, frameB, width, bandStartY, bandHeight) {
  let totalShift = 0;
  let blockCount = 0;

  for (let by = bandStartY; by + BLOCK_SIZE <= bandStartY + bandHeight; by += BLOCK_SIZE) {
    for (let bx = SEARCH_RANGE; bx + BLOCK_SIZE + SEARCH_RANGE <= width; bx += BLOCK_SIZE) {
      let bestShift = 0;
      let bestDiff = Infinity;
      for (let shift = -SEARCH_RANGE; shift <= SEARCH_RANGE; shift++) {
        const diff = blockDifference(frameA, bx, by, frameB, bx + shift, by, width);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestShift = shift;
        }
      }
      totalShift += Math.abs(bestShift);
      blockCount++;
    }
  }

  return blockCount > 0 ? totalShift / blockCount : 0;
}

/**
 * @param {Buffer[]} frameBuffers - burst of frames captured during the pan,
 *   in chronological order. Needs at least 2; works best with 5-10.
 */
export async function checkParallax(frameBuffers) {
  if (!frameBuffers || frameBuffers.length < 2) {
    return { pass: false, reason: "Not enough burst frames captured to assess parallax (need at least 2)" };
  }

  const first = await toGrayscaleRaw(frameBuffers[0]);
  const last = await toGrayscaleRaw(frameBuffers[frameBuffers.length - 1]);

  const bandHeight = Math.floor(ANALYSIS_HEIGHT / 3);
  const nearBandMotion = estimateBandMotion(first.pixels, last.pixels, ANALYSIS_WIDTH, ANALYSIS_HEIGHT - bandHeight, bandHeight);
  const farBandMotion = estimateBandMotion(first.pixels, last.pixels, ANALYSIS_WIDTH, 0, bandHeight);

  if (nearBandMotion < 0.5 && farBandMotion < 0.5) {
    return {
      pass: false,
      reason: "Almost no motion detected between frames — pan gesture likely not performed",
      nearBandMotion,
      farBandMotion,
    };
  }

  const motionRatio = (nearBandMotion + 0.1) / (farBandMotion + 0.1);
  // A real panned scene: near band moves noticeably faster than far band (ratio well above 1).
  // A flat screen replay: both bands move together (ratio close to 1).
  const hasParallax = motionRatio > 1.4;

  return {
    pass: hasParallax,
    reason: hasParallax
      ? `Parallax detected — near-field motion (${nearBandMotion.toFixed(1)}px) exceeds far-field motion (${farBandMotion.toFixed(1)}px) as expected for a real 3D scene`
      : `No meaningful parallax — near (${nearBandMotion.toFixed(1)}px) and far (${farBandMotion.toFixed(1)}px) motion are nearly equal, consistent with filming a flat screen/printout`,
    nearBandMotion,
    farBandMotion,
    motionRatio,
  };
}
