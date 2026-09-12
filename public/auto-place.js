import { canCaptureHere, capturePlace, validPin } from "./care-state.js?v=3.10";

// One request per new entry. Never wait for GPS before saving care.
export function createAutoPlace({
  getEvent,
  save,
  enabled,
  capture = capturePlace,
  report = () => {},
}) {
  const pending = new Map();
  const cancel = (id) => pending.delete(id);
  async function attach(id) {
    const original = getEvent(id);
    if (
      !enabled() ||
      !original ||
      original.deletedAt ||
      !canCaptureHere(original) ||
      original.location ||
      validPin(original.placePin) ||
      pending.has(id)
    )
      return;
    const startedFor = original.time;
    const token = {};
    pending.set(id, token);
    report(id, "Finding location…");
    try {
      const pin = await capture();
      const current = getEvent(id);
      if (
        pending.get(id) !== token ||
        !enabled() ||
        !current ||
        current.deletedAt ||
        current.time !== startedFor ||
        !canCaptureHere(current) ||
        current.location ||
        validPin(current.placePin)
      )
        return;
      await save(id, pin, current.revision);
      report(id, "Location saved with this entry.");
    } catch {
      if (pending.get(id) === token)
        report(id, "Entry saved. Location unavailable this time.");
    } finally {
      if (pending.get(id) === token) pending.delete(id);
    }
  }
  return { attach, cancel, cancelAll: () => pending.clear() };
}
