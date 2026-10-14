import { stores } from "../lib/store.mjs";
import { refreshCalendar } from "../lib/calendar.mjs";

export default async () => {
  const { main } = stores();
  const homes = [];
  for await (const page of main.list({ prefix: "home/", paginate: true })) {
    homes.push(...page.blobs);
  }
  const results = await Promise.allSettled(
    homes.map(async ({ key }) => {
      await refreshCalendar(main, key);
    }),
  );
  const failures = results.filter((r) => r.status === "rejected").length;
  // Never log a calendar URL: the private address grants read access.
  if (failures)
    console.error(`${failures} calendar connection(s) could not refresh.`);
  return new Response("OK");
};
export const config = { schedule: "15 * * * *" };
