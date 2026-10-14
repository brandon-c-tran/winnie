// Read originals before resizing. EXIF wall time is not the phone's current time.
import { parse } from './vendor/exifr.mjs';
import tzlookup from './vendor/tz-lookup.mjs';

export function wallTime(time, timezone = 'America/Los_Angeles') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(time).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
// Return every matching instant: fall-back hours are ambiguous; spring gaps invalid.
export function wallInstants(wall, zone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall)) return [];
  const naive = Date.parse(wall + ':00Z');
  if (!Number.isFinite(naive)) return [];
  try {
    const offsets = new Set([-36, -12, 0, 12, 36].map(h => {
      const t = naive + h * 3600000;
      return Date.parse(wallTime(t, zone) + ':00Z') - t;
    }));
    return [...offsets].map(offset => naive - offset)
      .filter(t => wallTime(t, zone) === wall).sort((a,b) => a-b);
  } catch { return []; }
}
export function metadataFromTags(tags = {}) {
  const result = { wall: '', timezone: '', capturedAt: null, origin: 'missing', pin: null };
  if (Number.isFinite(tags.latitude) && Math.abs(tags.latitude) <= 90 &&
      Number.isFinite(tags.longitude) && Math.abs(tags.longitude) <= 180) {
    result.pin = {lat: tags.latitude, lng: tags.longitude};
    result.timezone = tzlookup(tags.latitude, tags.longitude);
  }
  const raw = tags.DateTimeOriginal || tags.CreateDate;
  const match = typeof raw === 'string' && raw.match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return result;
  result.wall = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
  const offset = tags.OffsetTimeOriginal || tags.OffsetTimeDigitized;
  if (typeof offset === 'string' && /^[+-](0\d|1[0-4]):[0-5]\d$/.test(offset)) {
    const time = Date.parse(result.wall + ':00' + offset);
    if (Number.isFinite(time) && new Date(time + (offset[0] === '-' ? -1 : 1) *
      (Number(offset.slice(1,3))*60 + Number(offset.slice(4))) * 60000).toISOString().slice(0,16) === result.wall) {
      result.capturedAt = time;
      result.offset = offset;
      result.origin = 'exif-offset';
      // Keep the camera clock even if its offset disagrees with a nearby timezone.
      if (result.timezone && wallTime(time, result.timezone) !== result.wall) result.timezone = '';
    }
  } else if (result.timezone) {
    const candidates = wallInstants(result.wall, result.timezone);
    if (candidates.length === 1) {
      result.capturedAt = candidates[0];
      result.origin = 'exif-gps-zone';
    } else result.origin = 'ambiguous';
  } else result.origin = 'exif-wall';
  return result;
}
export async function readPhotoMetadata(file) {
  let tags;
  try { tags = await parse(file, {reviveValues: false}); } catch { /* stripped or unsupported EXIF */ }
  const metadata = metadataFromTags(tags);
  const bytes = await file.arrayBuffer();
  metadata.fingerprint = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(x => x.toString(16).padStart(2, '0')).join('');
  return metadata;
}
