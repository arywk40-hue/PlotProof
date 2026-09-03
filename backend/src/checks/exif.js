import exifr from "exifr";

// Software strings commonly left behind by editing tools — a real,
// unedited phone photo normally won't carry one of these.
const EDITOR_SIGNATURES = [
  "photoshop",
  "gimp",
  "exiftool",
  "snapseed",
  "lightroom",
  "pixelmator",
];

/**
 * Reads EXIF metadata and scores how consistent it is with "genuine,
 * unedited phone camera photo taken just now". This is a soft signal —
 * a determined attacker can forge EXIF, which is exactly why the live
 * in-app capture flow (not file upload) is the primary defense; this
 * check is a secondary backstop and useful if file upload is ever
 * re-enabled for testing/offline submission.
 */
export async function checkExifConsistency(imageBuffer) {
  const flags = [];
  let exif;
  try {
    exif = await exifr.parse(imageBuffer, { gps: true, ifd0: true, exif: true });
  } catch {
    exif = null;
  }

  if (!exif) {
    flags.push("No EXIF metadata found at all (uploaded files, screenshots, and many editors strip it)");
    return { pass: false, flags, exif: null };
  }

  if (!exif.Make || !exif.Model) {
    flags.push("Missing camera make/model — real phone photos almost always include this");
  }

  const software = (exif.Software || "").toLowerCase();
  if (EDITOR_SIGNATURES.some((sig) => software.includes(sig))) {
    flags.push(`Software field indicates image was processed by an editing tool (${exif.Software})`);
  }

  if (exif.GPSHPositioningError === undefined && exif.GPSDOP === undefined) {
    flags.push("No GPS accuracy/DOP field present — often absent from manually-injected GPS tags");
  }

  if (!exif.DateTimeOriginal) {
    flags.push("Missing DateTimeOriginal — cannot verify capture time");
  }

  return {
    pass: flags.length === 0,
    flags,
    exif: {
      make: exif.Make,
      model: exif.Model,
      dateTimeOriginal: exif.DateTimeOriginal,
      software: exif.Software,
      gpsLatitude: exif.latitude,
      gpsLongitude: exif.longitude,
    },
  };
}
