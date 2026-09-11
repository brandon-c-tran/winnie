export const fridgeDay = (time = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(time);
export function fridgeState(profile) {
  if (profile.fridge) return structuredClone(profile.fridge);
  return {
    notes: [
      ["legacy-routine", profile.routine],
      ["legacy-goal", profile.goal],
    ]
      .filter(([, text]) => text?.trim())
      .map(([id, text], i) => ({
        id,
        text,
        by: id === "legacy-routine" ? profile.routineUpdatedBy || "" : "",
        createdAt: id === "legacy-routine" ? profile.routineUpdatedAt || 0 : 0,
        until: null,
        archivedAt: null,
        color: i ? "rose" : "yellow",
      })),
    photo: null,
  };
}
export function onFridge(note, now = Date.now()) {
  return !note.archivedAt && (!note.until || note.until >= fridgeDay(now));
}
export function validateFridge(value) {
  const fail = () => {
    throw Error("This fridge update is invalid. Refresh and try again.");
  };
  if (!value || !Array.isArray(value.notes) || value.notes.length > 200) fail();
  const ids = new Set();
  for (const n of value.notes) {
    if (
      !n ||
      typeof n.id !== "string" ||
      !/^[\w-]{1,100}$/.test(n.id) ||
      ids.has(n.id) ||
      typeof n.text !== "string" ||
      !n.text.trim() ||
      n.text.length > 2000 ||
      !["", "brandon", "kim"].includes(n.by) ||
      !Number.isFinite(n.createdAt) ||
      n.createdAt < 0 ||
      !["yellow", "rose"].includes(n.color) ||
      !(
        n.until === null ||
        (typeof n.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(n.until))
      ) ||
      !(
        n.archivedAt === null ||
        (Number.isFinite(n.archivedAt) && n.archivedAt > 0)
      )
    )
      fail();
    ids.add(n.id);
  }
  if (
    value.photo !== null &&
    (!value.photo ||
      typeof value.photo.eventId !== "string" ||
      !/^[\w-]{1,100}$/.test(value.photo.eventId) ||
      typeof value.photo.photoId !== "string" ||
      !/^[\w-]{1,100}$/.test(value.photo.photoId))
  )
    fail();
  return {
    notes: value.notes.map(
      ({ id, text, by, createdAt, until, archivedAt, color }) => ({
        id,
        text,
        by,
        createdAt,
        until,
        archivedAt,
        color,
      }),
    ),
    photo: value.photo
      ? { eventId: value.photo.eventId, photoId: value.photo.photoId }
      : null,
  };
}
