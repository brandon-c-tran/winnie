// Shared boundary for photo metadata in the offline queue and API.
export function validatePhotoMetadata(value) {
  if (value == null) return null;
  const fail = () => { throw Error('Invalid photo metadata.'); };
  if (typeof value !== 'object' || Array.isArray(value)) fail();
  const result = {};
  for (const key of ['wall', 'timezone', 'origin', 'offset', 'fingerprint', 'location']) {
    if (value[key] == null) continue;
    if (typeof value[key] !== 'string' || value[key].length > 200) fail();
    result[key] = value[key];
  }
  if (value.capturedAt != null) {
    if (!Number.isFinite(value.capturedAt) || value.capturedAt <= 0 || value.capturedAt > Date.now() + 60000) fail();
    result.capturedAt = value.capturedAt;
  }
  if (value.pin != null) {
    const {lat, lng} = value.pin;
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) fail();
    result.pin = {lat, lng};
  }
  return result;
}
