import sharp from "sharp";

/**
 * SCREEN-REPLAY DETECTION SUITE
 * ------------------------------
 * These three heuristics together try to catch "camera pointed at another
 * screen/phone/printout" rather than a real outdoor field. None is
 * individually bulletproof — that's why they're combined, and why
 * borderline results get flagged for manual cooperative-level review
 * rather than an automatic hard reject. This is standard practice in
 * production liveness-detection systems: multiple weak signals, human
 * in the loop for the ambiguous middle.
 */

const ANALYSIS_SIZE = 256; // downsample for speed; heuristics are scale-tolerant

async function toGrayscaleRaw(imageBuffer, size = ANALYSIS_SIZE) {
  const { data, info } = await sharp(imageBuffer)
    .resize(size, size, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { pixels: data, width: info.width, height: info.height };
}

/**
 * 1) GLARE / UNIFORM BRIGHTNESS CHECK
 * Screens emit light evenly; a photographed screen typically produces a
 * large, unusually uniform bright region. Outdoor sunlight on natural
 * terrain produces speckled, non-uniform brightness instead.
 */
export async function checkGlareUniformity(imageBuffer) {
  const { pixels, width, height } = await toGrayscaleRaw(imageBuffer);
  const BRIGHT_THRESHOLD = 235;

  let minX = width, maxX = 0, minY = height, maxY = 0, brightCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = pixels[y * width + x];
      if (v >= BRIGHT_THRESHOLD) {
        brightCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const totalPixels = width * height;
  const brightFraction = brightCount / totalPixels;

  if (brightFraction < 0.02) {
    return { pass: true, reason: "No significant bright region detected", brightFraction };
  }

  const bboxArea = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
  const density = brightCount / bboxArea; // how "filled in" the bright bounding box is

  // A dense, large, rectangular-ish bright patch is glare-screen-like.
  const suspicious = density > 0.55 && bboxArea / totalPixels > 0.05;

  return {
    pass: !suspicious,
    reason: suspicious
      ? `Large, unusually uniform bright region detected (${(brightFraction * 100).toFixed(1)}% of frame, ${(density * 100).toFixed(0)}% dense) — consistent with screen glare`
      : `Bright regions present but not screen-glare-like (${(brightFraction * 100).toFixed(1)}% of frame)`,
    brightFraction,
    density,
  };
}

/**
 * 2) BEZEL / FRAME EDGE CHECK
 * A photographed phone/tablet/monitor usually shows a straight, high-contrast
 * rectangular edge (the device bezel or case) somewhere inside the frame,
 * roughly parallel to the image borders. Natural outdoor scenes rarely
 * contain long, perfectly straight, axis-aligned high-contrast lines.
 */
export async function checkBezelEdges(imageBuffer) {
  const { pixels, width, height } = await toGrayscaleRaw(imageBuffer);

  // Simple horizontal + vertical gradient (Sobel-lite) via finite differences.
  const gradMag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx = pixels[y * width + (x + 1)] - pixels[y * width + (x - 1)];
      const gy = pixels[(y + 1) * width + x] - pixels[(y - 1) * width + x];
      gradMag[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  const EDGE_THRESHOLD = 60;
  const ROW_COVERAGE_THRESHOLD = 0.7; // fraction of a row/col that must be "edge" to count as a bezel line

  let longStraightLines = 0;

  // Check rows for near-full-width high-gradient horizontal lines.
  for (let y = 1; y < height - 1; y++) {
    let edgeCount = 0;
    for (let x = 1; x < width - 1; x++) {
      if (gradMag[y * width + x] > EDGE_THRESHOLD) edgeCount++;
    }
    if (edgeCount / width > ROW_COVERAGE_THRESHOLD) longStraightLines++;
  }

  // Check columns for near-full-height high-gradient vertical lines.
  for (let x = 1; x < width - 1; x++) {
    let edgeCount = 0;
    for (let y = 1; y < height - 1; y++) {
      if (gradMag[y * width + x] > EDGE_THRESHOLD) edgeCount++;
    }
    if (edgeCount / height > ROW_COVERAGE_THRESHOLD) longStraightLines++;
  }

  const suspicious = longStraightLines >= 2; // e.g. a top edge + a side edge of a bezel

  return {
    pass: !suspicious,
    reason: suspicious
      ? `Detected ${longStraightLines} long straight axis-aligned edge(s) — consistent with a device bezel/screen frame in shot`
      : "No long straight axis-aligned edges detected",
    longStraightLines,
  };
}

/**
 * 3) MOIRE-LIKE PERIODICITY CHECK
 * Photographing a screen's pixel grid against the camera sensor's grid
 * produces regular repeating patterns. This is a simplified approximation:
 * it looks for abnormally strong short-lag periodicity in row-wise pixel
 * intensity via autocorrelation, on a center patch (avoids leafy/organic
 * texture at the edges skewing the result). It's a coarse stand-in for a
 * full 2D FFT frequency-domain analysis — good enough to flag obvious
 * cases for the demo; a real deployment should use an FFT-based detector.
 */
export async function checkMoirePeriodicity(imageBuffer) {
  const size = 128;
  const { pixels, width, height } = await toGrayscaleRaw(imageBuffer, size);

  // Sample center patch to avoid edge/foliage texture noise.
  const patchSize = 64;
  const startX = Math.floor((width - patchSize) / 2);
  const startY = Math.floor((height - patchSize) / 2);

  // Uniform sky, walls, fog, or dark scenes have very high autocorrelation at
  // every lag, but that is not a repeating screen grid. Moire requires both
  // periodicity and enough local contrast to reveal a pattern.
  let sum = 0;
  let sumSquares = 0;
  const pixelCount = patchSize * patchSize;
  for (let y = startY; y < startY + patchSize; y++) {
    for (let x = startX; x < startX + patchSize; x++) {
      const value = pixels[y * width + x];
      sum += value;
      sumSquares += value * value;
    }
  }
  const mean = sum / pixelCount;
  const localContrast = Math.sqrt(Math.max(0, sumSquares / pixelCount - mean * mean));
  if (localContrast < 12) {
    return {
      pass: true,
      reason: "Frame has too little local texture to infer a screen-replay pattern",
      localContrast,
      maxAutocorr: null,
      peakLag: null,
    };
  }

  let maxAutocorr = 0;
  let peakLag = 0;

  for (let lag = 2; lag <= 12; lag++) {
    let sum = 0;
    let count = 0;
    for (let y = startY; y < startY + patchSize; y++) {
      for (let x = startX; x < startX + patchSize - lag; x++) {
        const a = pixels[y * width + x];
        const b = pixels[y * width + (x + lag)];
        sum += 255 - Math.abs(a - b); // higher = more similar at this lag
        count++;
      }
    }
    const avg = sum / count / 255; // normalize 0..1
    if (avg > maxAutocorr) {
      maxAutocorr = avg;
      peakLag = lag;
    }
  }

  // Natural organic textures decay smoothly with lag; a strong sharp peak
  // at a small, consistent lag suggests an artificial repeating grid.
  const suspicious = maxAutocorr > 0.93;

  return {
    pass: !suspicious,
    reason: suspicious
      ? `Strong short-range periodicity detected (peak similarity ${(maxAutocorr * 100).toFixed(1)}% at lag ${peakLag}px) — possible moire pattern from screen replay`
      : `No strong periodic pattern detected (peak similarity ${(maxAutocorr * 100).toFixed(1)}%)`,
    maxAutocorr,
    peakLag,
    localContrast,
  };
}
