import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createHandler } from "../netlify/lib/api.mjs";
import { MemoryStore } from "../tests/store.mjs";
import { smallLog, largeLog } from "./dev-seed.mjs";
const port = Number(process.env.WINNIE_DEV_PORT || 4173);
const root = path.resolve("public"),
  stores = {
    main: new MemoryStore(),
    legacy: new MemoryStore(),
    photos: new MemoryStore(),
    backup: new MemoryStore(),
  };
// WINNIE_DEV_SEED=large gives winnie-local-demo a log about the size of the real one.
await stores.legacy.setJSON(
  "winnie-local-demo",
  process.env.WINNIE_DEV_SEED === "large" ? largeLog() : smallLog(),
);
// Browser tests get a fresh, isolated log for any code that starts with winnie-e2e-.
const legacyGet = stores.legacy.get.bind(stores.legacy);
stores.legacy.get = async (key, options) =>
  (await legacyGet(key, options)) ??
  (String(key).startsWith("winnie-e2e-")
    ? key.endsWith("-large")
      ? largeLog()
      : smallLog()
    : null);
const api = createHandler(() => stores, { runDispatch: async () => {} });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname === "/.netlify/functions/api") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const response = await api(
          new Request(url, {
            method: req.method,
            headers: req.headers,
            body: ["GET", "HEAD"].includes(req.method)
              ? undefined
              : Buffer.concat(chunks),
          }),
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const resource =
        url.pathname === "/.netlify/images"
          ? url.searchParams.get("url")
          : url.pathname === "/"
            ? "/index.html"
            : url.pathname;
      const file = path.resolve(root, "." + decodeURIComponent(resource));
      if (!file.startsWith(root + path.sep))
        throw new Error("Outside public directory");
      const data = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(
      `Winnie local preview: http://localhost:${port} · shared code: winnie-local-demo · isolated memory store`,
    ),
  );
