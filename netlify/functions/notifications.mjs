import { stores } from "../lib/store.mjs";
import { dispatch } from "../lib/push.mjs";
export default async () => {
  const { main } = stores();
  for (const blob of (await main.list({ prefix: "home/" })).blobs)
    await dispatch(main, blob.key, { limit: 20 });
  return new Response("OK");
};
export const config = { schedule: "* * * * *" };
