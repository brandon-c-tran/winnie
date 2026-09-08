import test from "node:test";
import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
import { WinnieSync } from "../public/sync.js";
import { createHandler } from "../netlify/lib/api.mjs";
import { MemoryStore } from "./store.mjs";
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: false },
  configurable: true,
});
const stores = {
  main: new MemoryStore(),
  legacy: new MemoryStore(),
  photos: new MemoryStore(),
  backup: new MemoryStore(),
};
const api = createHandler(() => stores, { runDispatch: async () => {} }),
  time = Date.now() - 50000;
let n = 0;
async function client(person = "brandon", reuse) {
  const code = `offline-test-${++n}`;
  if (!reuse)
    await stores.legacy.setJSON(code, {
      schemaVersion: 3,
      events: [{ id: "old", type: "pee", time, note: "original" }],
    });
  const result =
    reuse?.session ||
    (await (
      await api(
        new Request("http://local/.netlify/functions/api?action=pair", {
          method: "POST",
          body: JSON.stringify({
            code,
            person,
            deviceId: `d${n}`,
            secret: "s".repeat(64),
          }),
        }),
      )
    ).json());
  const s = new WinnieSync();
  s.session = result;
  s.db =
    reuse?.db ||
    (await new Promise((resolve, reject) => {
      const r = indexedDB.open(`test${n}`);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("homes");
        r.result.createObjectStore("photos");
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  s.request = async (
    action,
    { method = "GET", value, raw, extra = "" } = {},
  ) => {
    const res = await api(
      new Request(
        `http://local/.netlify/functions/api?action=${action}${extra}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${s.session.token}`,
            "X-Winnie-Home": s.session.home,
          },
          body: raw || (value ? JSON.stringify(value) : undefined),
        },
      ),
    );
    if (action === "photo" && method === "GET" && res.ok) return res.blob();
    const data = await res.json();
    if (!res.ok)
      throw Object.assign(new Error(data.error), {
        status: res.status,
        current: data.current,
      });
    return data;
  };
  if (reuse) s.data = await s.read();
  else
    await s.change((d) => {
      d.snapshot = result;
    });
  return s;
}
async function settled(s) {
  while (s.busy) await new Promise((r) => setTimeout(r, 5));
}
test("durable offline create, edit, and Undo survive a new client instance", async () => {
  navigator.onLine = false;
  const first = await client();
  await first.enqueue("create", "new", { type: "poop", time });
  await first.enqueue("edit", "new", { note: "offline note" });
  await first.enqueue("delete", "new");
  const reopened = await client("brandon", {
    session: first.session,
    db: first.db,
  });
  assert.equal(reopened.data.queue.length, 3);
  assert.equal(
    reopened.view().events.find((e) => e.id === "new").note,
    "offline note",
  );
  navigator.onLine = true;
  await reopened.flush();
  assert.equal(reopened.data.queue.length, 0);
  assert.ok(
    reopened.data.snapshot.events.find((e) => e.id === "new").deletedAt,
  );
  first.db.close();
});
test("uncertain committed request keeps its original ID and resolves once after reload", async () => {
  navigator.onLine = false;
  const s = await client();
  await s.enqueue("create", "new", { type: "meal", time });
  const op = s.data.queue[0].command.operationId,
    request = s.request;
  s.request = async (action, options) => {
    const value = await request(action, options);
    if (action === "command") throw new Error("response lost");
    return value;
  };
  navigator.onLine = true;
  await s.flush();
  assert.equal(s.data.queue[0].command.operationId, op);
  const restored = await client("brandon", { session: s.session, db: s.db });
  await restored.flush();
  assert.equal(restored.data.queue.length, 0);
  assert.equal(
    restored.data.snapshot.events.filter((e) => e.id === "new").length,
    1,
  );
  s.db.close();
});
test("offline photo survives reload and attaches after the parent entry commits", async () => {
  navigator.onLine = false;
  const s = await client();
  await s.enqueue("create", "new", { type: "poop", time });
  const blob = new Blob(
    [new Uint8Array([255, 216, 255, ...Array(40).fill(5)])],
    { type: "image/jpeg" },
  );
  const photo = await s.addPhoto("new", blob);
  const restored = await client("brandon", { session: s.session, db: s.db });
  assert.equal((await restored.photo(photo)).size, blob.size);
  navigator.onLine = true;
  await restored.flush();
  assert.equal(restored.data.queue.length, 0);
  const event = restored.data.snapshot.events.find((e) => e.id === "new");
  assert.equal(event.photos.length, 1);
  assert.equal(restored.data.snapshot.events.length, 2);
  s.db.close();
});
test("conflicting event does not block an unrelated queued action", async () => {
  navigator.onLine = false;
  const s = await client();
  await s.enqueue("edit", "old", { note: "mine" });
  await s.enqueue("create", "independent", { type: "meal", time });
  await s.request("command", {
    method: "POST",
    value: {
      protocol: 4,
      operationId: "remote-change",
      kind: "edit",
      eventId: "old",
      expectedRevision: 1,
      payload: { note: "remote" },
    },
  });
  navigator.onLine = true;
  await s.flush();
  assert.equal(s.data.queue.length, 1);
  assert.match(s.data.queue[0].error, /another device/);
  assert.equal(
    s.data.snapshot.events.find((e) => e.id === "old").note,
    "remote",
  );
  assert.ok(s.data.snapshot.events.some((e) => e.id === "independent"));
  await s.resolve(s.data.queue[0].command.operationId, true);
  await settled(s);
  assert.equal(s.data.queue.length, 0);
  assert.equal(s.data.snapshot.events.find((e) => e.id === "old").note, "mine");
  s.db.close();
});
test("a form opened before refresh retains its original expected revision", async () => {
  navigator.onLine = false;
  const s = await client(),
    openedRevision = s.view().events[0].revision;
  await s.request("command", {
    method: "POST",
    value: {
      protocol: 4,
      operationId: "changed-while-typing",
      kind: "edit",
      eventId: "old",
      expectedRevision: 1,
      payload: { note: "partner change" },
    },
  });
  await s.refresh();
  await s.enqueue("edit", "old", { note: "my older form" }, openedRevision);
  navigator.onLine = true;
  await s.flush();
  assert.equal(s.data.snapshot.events[0].note, "partner change");
  assert.equal(s.data.queue.length, 1);
  assert.ok(s.data.queue[0].error);
  s.db.close();
});
