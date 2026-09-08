import { getStore } from "@netlify/blobs";

// Blobs 11.0.3 can report conditional 5xx writes as modified:true.
// Guard the transport before the SDK interprets the response (also tested through the actual SDK).
export function checkedFetch(fetcher = globalThis.fetch) {
  return async (url, options) => {
    const res = await fetcher(url, options);
    const write = (options?.method || "").toUpperCase() === "PUT";
    if (
      res.status >= 400 &&
      !(res.status === 412 || (res.status === 404 && !write))
    )
      throw new Error(`Storage request failed (${res.status}).`);
    if (
      (options?.method || "").toUpperCase() === "PUT" &&
      res.ok &&
      !res.headers.get("etag")
    )
      throw new Error("Storage write did not return an ETag.");
    return res;
  };
}
export function stores(req) {
  const context = process.env.CONTEXT;
  // A branch/preview must never use the production household namespace.
  const preview = req
    ? new URL(req.url).hostname !== "winniecavapoo.netlify.app"
    : context && context !== "production";
  const suffix = preview ? `-${process.env.DEPLOY_ID || "local"}` : "";
  const open = (name) =>
    getStore({
      name: name + suffix,
      consistency: "strong",
      fetch: checkedFetch(),
    });
  return {
    main: open("winnie-v4"),
    legacy: open("winnie"),
    photos: open("winnie-photos"),
    backup: open("winnie-backups"),
  };
}
