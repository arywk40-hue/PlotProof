// Rough bounding boxes for Indonesia's main oil-palm growing provinces.
// This is intentionally coarse for the hackathon build — swap for a proper
// polygon/shapefile lookup (e.g. against BPS/ATR-BPN administrative
// boundaries) post-hackathon for real precision.
const OIL_PALM_REGIONS = [
  // India pilot region. This allows the local deployment and field-testing
  // workflow to operate in India while the production region dataset is
  // replaced with plot-level boundaries.
  { name: "India pilot", minLat: 6.0, maxLat: 37.5, minLon: 68.0, maxLon: 98.0 },
  // Sumatra (Riau, North Sumatra, Jambi, South Sumatra, etc.)
  { name: "Sumatra", minLat: -6.0, maxLat: 6.0, minLon: 95.0, maxLon: 106.0 },
  // Kalimantan (Indonesian Borneo)
  { name: "Kalimantan", minLat: -4.5, maxLat: 4.5, minLon: 108.5, maxLon: 119.0 },
  // Sulawesi (smaller but growing oil palm areas)
  { name: "Sulawesi", minLat: -6.0, maxLat: 2.0, minLon: 118.5, maxLon: 125.5 },
  // Papua / West Papua (expanding oil palm frontier)
  { name: "Papua", minLat: -9.5, maxLat: 0.5, minLon: 130.0, maxLon: 141.5 },
];

/**
 * Checks whether a lat/lon pair falls inside any known Indonesian
 * oil-palm growing region bounding box.
 * @param {number} lat
 * @param {number} lon
 * @returns {{ pass: boolean, region: string|null, reason: string }}
 */
export function checkGpsBoundingBox(lat, lon) {
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    Number.isNaN(lat) ||
    Number.isNaN(lon)
  ) {
    return { pass: false, region: null, reason: "GPS coordinates missing or invalid" };
  }

  if (lat < -11 || lat > 37.5 || lon < 68 || lon > 142) {
    return { pass: false, region: null, reason: "Coordinates fall outside supported pilot regions" };
  }

  for (const region of OIL_PALM_REGIONS) {
    if (lat >= region.minLat && lat <= region.maxLat && lon >= region.minLon && lon <= region.maxLon) {
      return { pass: true, region: region.name, reason: `Within ${region.name} oil-palm growing region` };
    }
  }

  return { pass: false, region: null, reason: "Coordinates inside a supported country but outside configured pilot regions" };
}

/**
 * Optional secondary signal: real phone GPS reports a horizontal accuracy
 * radius (metres). Spoofed/manually-set coordinates are often either
 * missing this value or report a suspiciously "too clean" number.
 */
export function checkGpsAccuracy(accuracyMeters) {
  if (accuracyMeters === undefined || accuracyMeters === null) {
    return { pass: false, reason: "No GPS accuracy reading provided (real device GPS always reports one)" };
  }
  if (accuracyMeters > 100) {
    return { pass: false, reason: `GPS accuracy too poor (±${accuracyMeters}m) to trust plot-level location` };
  }
  if ([0, 1, 5, 10, 50, 100].includes(Math.round(accuracyMeters))) {
    // Not disqualifying on its own, just a soft flag combined with other signals.
    return { pass: true, reason: `Accuracy value is a suspiciously round number (±${accuracyMeters}m)`, softFlag: true };
  }
  return { pass: true, reason: `GPS accuracy acceptable (±${accuracyMeters}m)` };
}
