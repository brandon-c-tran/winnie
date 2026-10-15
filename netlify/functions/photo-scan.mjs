import { stores } from "../lib/store.mjs";
import { runPhotoAI } from "../lib/photo-ai.mjs";

export default async () => {
  if (!process.env.OPENAI_API_KEY) return new Response("Not configured");
  const { main, photos } = stores();
  const started = Date.now();
  // Bounded sequential work; unprocessed jobs survive for the next scheduled run.
  for await (const page of main.list({ prefix: "home/", paginate: true })) {
    for (const { key } of page.blobs) {
      if (Date.now() - started > 5000)
        return new Response("Continues next run");
      try {
        if (await runPhotoAI(main, photos, key))
          return new Response("Processed one saved photo");
      } catch {
        console.error(
          "A photo scan could not finish; its saved job can retry.",
        );
      }
    }
  }
  return new Response("OK");
};
export const config = { schedule: "*/5 * * * *" };
