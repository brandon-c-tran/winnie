// Shared care vocabulary. Read from real logs; never infer a completed task.
export const ROUTINE = [
  ["Brush", "brush"],
  ["Teeth", "tooth"],
  ["Ears", "ear"],
  ["Nails", "nails"],
  ["Bath", "bath"],
  ["Haircut", "scissors"],
];
export function lastRoutine(events, title, now = Date.now()) {
  return (
    events
      .filter(
        (e) =>
          !e.deletedAt &&
          e.type === "grooming" &&
          String(e.careTitle || "")
            .trim()
            .toLowerCase() === title.toLowerCase() &&
          Number.isFinite(e.time) &&
          e.time <= now,
      )
      .sort((a, b) => b.time - a.time)[0] || null
  );
}

export const SUPPLIES = [
  ["wipes", "Wipes"],
  ["bags", "Poop bags"],
  ["heartgard", "Heartgard"],
];
export const STOCK = {
  unknown: "Not checked",
  stocked: "In stock",
  low: "Running low",
  ordered: "Ordered",
};
export function validateSupplies(value) {
  if (!Array.isArray(value) || value.length > SUPPLIES.length)
    throw Error("Choose a valid supply update.");
  const ids = new Set();
  return value.map((item) => {
    if (
      !item ||
      !SUPPLIES.some(([id]) => id === item.id) ||
      ids.has(item.id) ||
      !Object.hasOwn(STOCK, item.status) ||
      !Number.isFinite(item.updatedAt) ||
      item.updatedAt <= 0 ||
      typeof item.link !== "string" ||
      item.link.length > 1000 ||
      (item.link && !/^https:\/\//.test(item.link))
    )
      throw Error("Choose a supply status and a valid https:// reorder link.");
    ids.add(item.id);
    return {
      id: item.id,
      status: item.status,
      updatedAt: item.updatedAt,
      link: item.link,
    };
  });
}
