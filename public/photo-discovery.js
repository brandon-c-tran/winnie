// Observations are a separate, editable index. They never supply dates or places.
export const PHOTO_CONCEPTS = [
  "pink bed",
  "snuggle puppy",
  "striped shirt",
  "harness",
  "bandanna",
  "couch",
  "crate",
  "toy",
  "beach",
  "waterfront",
  "park",
  "snow",
  "sleeping",
  "playing",
  "walking",
  "indoors",
  "outdoors",
];
export function validateObservation(value) {
  if (
    !value ||
    typeof value.description !== "string" ||
    value.description.length > 400 ||
    !Array.isArray(value.concepts) ||
    value.concepts.length > 12 ||
    value.concepts.some((c) => !PHOTO_CONCEPTS.includes(c))
  )
    throw Error(
      "Choose supported photo labels and a description under 400 characters.",
    );
  return {
    description: value.description.trim(),
    concepts: [...new Set(value.concepts)],
  };
}
const words = (text) =>
  String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
const ignore = new Set([
  "show",
  "me",
  "photos",
  "photo",
  "pictures",
  "picture",
  "of",
  "winnie",
  "his",
  "him",
  "with",
  "in",
  "the",
  "a",
  "an",
  "on",
  "at",
  "and",
]);
const synonyms = {
  sofa: "couch",
  asleep: "sleeping",
  sleep: "sleeping",
  sleeps: "sleeping",
  stripe: "striped",
  stripes: "striped",
  tshirt: "shirt",
  puppy: "puppy",
  toys: "toy",
  outside: "outdoors",
  inside: "indoors",
  walk: "walking",
  walks: "walking",
  play: "playing",
};
export function photoMatches(query, text, observation) {
  if (!query.trim()) return true;
  const tokens = words(query)
    .filter((w) => !ignore.has(w))
    .map((w) => synonyms[w] || w);
  const hay = words(
    [text, observation?.description, ...(observation?.concepts || [])].join(
      " ",
    ),
  )
    .map((w) => synonyms[w] || w)
    .join(" ");
  return tokens.length
    ? tokens.every((t) => hay.includes(t))
    : String(text).toLowerCase().includes(query.toLowerCase());
}
export const pairKey = (a, b) => [a, b].sort().join("~");
const specific = new Set(
  PHOTO_CONCEPTS.filter(
    (c) => !["indoors", "outdoors", "toy", "walking", "playing"].includes(c),
  ),
);
export function suggestedPairs(
  photos,
  observations,
  decisions = {},
  limit = 3,
) {
  const groups = new Map();
  for (const p of photos)
    for (const c of observations[p.photo.id]?.concepts || []) {
      if (!specific.has(c)) continue;
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(p);
    }
  const found = [];
  for (const [concept, items] of groups) {
    items.sort((a, b) => a.day.localeCompare(b.day));
    const first = items[0];
    for (let i = items.length - 1; i > 0; i--) {
      const last = items[i],
        gap = Math.round(
          (Date.parse(last.day) - Date.parse(first.day)) / 86400000,
        );
      const id = pairKey(first.photo.id, last.photo.id);
      if (gap < 60 || decisions[id] || found.some((p) => p.id === id)) continue;
      found.push({ id, first, last, concept, gap });
      break;
    }
  }
  return found.sort((a, b) => b.gap - a.gap).slice(0, limit);
}
export function suggestedCollections(photos, observations) {
  return [...specific]
    .map((concept) => ({
      concept,
      photoIds: photos
        .filter((p) => observations[p.photo.id]?.concepts.includes(concept))
        .map((p) => p.photo.id),
    }))
    .filter((c) => c.photoIds.length >= 2)
    .sort((a, b) => b.photoIds.length - a.photoIds.length);
}
export function validateMemoryLibrary(value, validIds) {
  if (
    !value ||
    !Array.isArray(value.collections) ||
    value.collections.length > 50 ||
    !value.pairs ||
    typeof value.pairs !== "object" ||
    Array.isArray(value.pairs) ||
    Object.keys(value.pairs).length > 1000
  )
    throw Error("This memory library is too large.");
  const ids = new Set();
  const collections = value.collections.map((c) => {
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^[\w-]{1,100}$/.test(c.id) ||
      ids.has(c.id) ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      c.name.length > 80 ||
      !Array.isArray(c.photoIds) ||
      c.photoIds.length > 1000 ||
      c.photoIds.some((id) => !validIds.has(id))
    )
      throw Error(
        "Choose a name and available Winnie photos for each collection.",
      );
    ids.add(c.id);
    return {
      id: c.id,
      name: c.name.trim(),
      photoIds: [...new Set(c.photoIds)],
    };
  });
  const pairs = {};
  for (const [key, state] of Object.entries(value.pairs)) {
    const parts = key.split("~");
    if (
      parts.length !== 2 ||
      parts[0] === parts[1] ||
      parts.some((id) => !validIds.has(id)) ||
      !["kept", "dismissed"].includes(state)
    )
      throw Error("Choose two available photos.");
    pairs[pairKey(...parts)] = state;
  }
  return { collections, pairs };
}
