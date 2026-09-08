import { stores } from "../lib/store.mjs";
import { hash } from "../lib/core.mjs";
import { json } from "../lib/api.mjs";
// Old clients may read/export, but may never replace the shared log.
export default async (req) => {
  if (req.method !== "GET")
    return json(
      {
        error:
          "Winnie has been upgraded. Close and reopen the app. Your saved phone history will be preserved.",
        upgradeRequired: true,
      },
      426,
    );
  const key = new URL(req.url).searchParams.get("key") || "";
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(key))
    return json({ error: "Missing shared code." }, 400);
  try {
    const { main, legacy } = stores(req);
    const current = await main.get(`home/${hash(key)}`, { type: "json" });
    if (current)
      return json({
        schemaVersion: 3,
        events: current.events
          .filter((e) => !e.deletedAt)
          .map(({ revision, photos, loggedBy, deviceId, editedBy, ...e }) => e),
        upgradeRequired: true,
      });
    return json(
      (await legacy.get(key, { type: "json" })) || {
        schemaVersion: 3,
        events: [],
      },
    );
  } catch {
    return json({ error: "Please retry shortly." }, 503);
  }
};
