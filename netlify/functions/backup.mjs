import { stores } from "../lib/store.mjs";
import { hash } from "../lib/core.mjs";
export default async () => {
  const { main, backup } = stores();
  for (const { key } of (await main.list({ prefix: "home/" })).blobs) {
    const doc = await main.get(key, { type: "json" });
    await backup.setJSON(
      `daily/${key.slice(5)}/${new Date().toISOString().slice(0, 10)}/${hash(doc)}`,
      doc,
      { onlyIfNew: true },
    );
  }
  return new Response("OK");
};
export const config = { schedule: "0 8 * * *" };
