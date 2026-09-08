import test from "node:test";
import assert from "node:assert/strict";
import { getStore } from "@netlify/blobs";
import { MemoryStore } from "./store.mjs";
import {
  migrate,
  applyCommand,
  transact,
  hash,
  stable,
  snapshot,
  authenticate,
} from "../netlify/lib/core.mjs";
import { checkedFetch } from "../netlify/lib/store.mjs";
import { createHandler } from "../netlify/lib/api.mjs";
import { dispatch, notification } from "../netlify/lib/push.mjs";
import { project } from "../public/sync.js";
const now = Date.now() - 10000;
const A = { id: "a", person: "brandon", tokenHash: hash("a".repeat(64)) },
  B = {
    id: "b",
    person: "kim",
    tokenHash: hash("b".repeat(64)),
    subscription: {
      endpoint: "https://fcm.googleapis.com/fcm/send/test",
      keys: { p256dh: "test", auth: "test" },
    },
  };
const original = {
  schemaVersion: 3,
  events: [
    {
      id: "old1",
      type: "pee",
      time: now - 100000,
      who: "us",
      note: "original",
      tags: ["outdoors"],
      coords: { lat: 1, lng: 2 },
      extra: { keep: "all fields" },
    },
    {
      id: "old2",
      type: "nap",
      time: now - 200000,
      end_time: now - 300000,
      source: "notes",
    },
  ],
};
const command = (id, kind, eventId, payload = {}, expectedRevision) => ({
  protocol: 4,
  operationId: id,
  kind,
  eventId,
  payload,
  ...(expectedRevision ? { expectedRevision } : {}),
});
async function fixture() {
  const store = new MemoryStore(),
    doc = migrate(original);
  doc.devices = { a: A, b: B };
  await store.setJSON("home/test", doc);
  return { store, doc };
}
test("migration preserves every legacy field and invalid historical duration", () => {
  const d = migrate(original);
  assert.deepEqual(
    d.events.map(({ revision, ...e }) => e),
    original.events,
  );
  assert.equal(d.migration.sha256, hash(stable(original)));
  assert.equal(d.events[0].loggedBy, undefined);
  assert.throws(() => migrate({ events: [{ id: "x" }, { id: "x" }] }));
});
test("concurrent edit and independent create both survive", async () => {
  const { store } = await fixture();
  await Promise.all([
    transact(store, "home/test", (d) =>
      applyCommand(
        d,
        command("edit", "edit", "old1", { note: "corrected" }, 1),
        A,
      ),
    ),
    transact(store, "home/test", (d) =>
      applyCommand(
        d,
        command("new", "create", "new1", { type: "meal", time: now }),
        B,
      ),
    ),
  ]);
  const d = await store.get("home/test");
  assert.equal(d.events.find((e) => e.id === "old1").note, "corrected");
  assert.equal(d.events.find((e) => e.id === "new1").type, "meal");
});
test("same-event conflict is explicit and preserves first edit", async () => {
  const { store } = await fixture();
  const changes = await Promise.allSettled(
    ["one", "two"].map((note, i) =>
      transact(store, "home/test", (d) =>
        applyCommand(
          d,
          command(`e${i}`, "edit", "old1", { note }, 1),
          i ? B : A,
        ),
      ),
    ),
  );
  assert.equal(changes.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(changes.find((x) => x.status === "rejected").reason.status, 409);
});
test("lost acknowledgment replays receipt and does not duplicate event or push intent", async () => {
  const { store } = await fixture(),
    c = command("retry1", "create", "new1", { type: "poop", time: now });
  const first = await transact(store, "home/test", (d) =>
    applyCommand(d, c, A),
  );
  const replay = await transact(store, "home/test", (d) =>
    applyCommand(d, c, A),
  );
  assert.deepEqual(replay.receipt, first.receipt);
  assert.equal(replay.doc.events.filter((e) => e.id === "new1").length, 1);
  assert.equal(Object.keys(replay.doc.jobs).length, 1);
  await assert.rejects(
    transact(store, "home/test", (d) =>
      applyCommand(d, { ...c, payload: { type: "meal", time: now } }, A),
    ),
    { status: 409 },
  );
});
test("tombstones resist stale edits; explicit restore remains possible", async () => {
  const { store } = await fixture();
  await transact(store, "home/test", (d) =>
    applyCommand(d, command("del", "delete", "old1", {}, 1), A),
  );
  await assert.rejects(
    transact(store, "home/test", (d) =>
      applyCommand(
        d,
        command("stale", "edit", "old1", { note: "resurrect" }, 1),
        B,
      ),
    ),
    { status: 409 },
  );
  const restored = await transact(store, "home/test", (d) =>
    applyCommand(d, command("restore", "restore", "old1", {}, 2), A),
  );
  assert.equal(restored.doc.events[0].deletedAt, undefined);
});
test("simultaneous sleep starts allow only one active sleep", async () => {
  const { store } = await fixture();
  const results = await Promise.allSettled(
    ["s1", "s2"].map((id, i) =>
      transact(store, "home/test", (d) =>
        applyCommand(
          d,
          command(id, "create", id, { type: "nap", time: now }),
          i ? B : A,
        ),
      ),
    ),
  );
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
});
test("new negative duration is rejected without corrupting legacy fields", () => {
  const doc = migrate(original);
  assert.throws(() =>
    applyCommand(
      doc,
      command("bad", "create", "bad", {
        type: "nap",
        time: now,
        end_time: now - 1,
      }),
      A,
    ),
  );
});
test("SDK transport guard rejects 500, 503, 404 writes, and absent acknowledgment", async () => {
  for (const status of [500, 503, 404]) {
    const fetch = checkedFetch(async () => new Response("", { status }));
    await assert.rejects(fetch("https://example.test", { method: "PUT" }));
  }
  await assert.rejects(
    checkedFetch(async () => new Response("", { status: 200 }))(
      "https://example.test",
      { method: "PUT" },
    ),
  );
  const conflict = await checkedFetch(
    async () => new Response("", { status: 412 }),
  )("https://example.test", { method: "PUT" });
  assert.equal(conflict.status, 412);
});
test("actual pinned Blobs SDK cannot turn guarded conditional 400 into success", async () => {
  const store = getStore({
    name: "test",
    siteID: "test",
    token: "test",
    edgeURL: "https://example.test",
    uncachedEdgeURL: "https://example.test",
    fetch: checkedFetch(async () => new Response("", { status: 400 })),
  });
  await assert.rejects(store.setJSON("x", {}, { onlyIfMatch: "old" }));
});
test("actual pinned SDK conditional success and conflict have verified semantics", async () => {
  for (const status of [200, 412]) {
    const store = getStore({
      name: "test",
      siteID: "test",
      token: "test",
      edgeURL: "https://example.test",
      uncachedEdgeURL: "https://example.test",
      fetch: checkedFetch(
        async () =>
          new Response("", {
            status,
            headers: status === 200 ? { etag: "new" } : {},
          }),
      ),
    });
    assert.equal(
      (await store.setJSON("x", {}, { onlyIfMatch: "old" })).modified,
      status === 200,
    );
  }
});
test("failed writes do not change canonical data", async () => {
  const { store } = await fixture();
  store.fail = "503";
  await assert.rejects(
    transact(store, "home/test", (d) =>
      applyCommand(
        d,
        command("fail", "edit", "old1", { note: "unsaved" }, 1),
        A,
      ),
    ),
  );
  assert.equal((await store.get("home/test")).events[0].note, "original");
});
test("offline projection preserves create/edit/undo order and canonical state", () => {
  const data = {
    snapshot: { events: [], profile: { revision: 1 } },
    queue: [
      {
        person: "brandon",
        command: command("1", "create", "x", { type: "poop", time: now }),
      },
      { command: command("2", "edit", "x", { note: "offline" }, 1) },
      { command: command("3", "delete", "x", {}, 2) },
    ],
  };
  const view = project(data);
  assert.equal(view.events[0].note, "offline");
  assert.equal(view.events[0].revision, 3);
  assert.ok(view.events[0].deletedAt);
  assert.equal(data.snapshot.events.length, 0);
});
test("photo attachment retry is one reference and never another care event", () => {
  const doc = migrate(original),
    c = command("photo", "attach", "old1", { photoId: "p1" }, 1);
  applyCommand(doc, c, A);
  applyCommand(doc, c, A);
  assert.equal(doc.events[0].photos.length, 1);
  assert.equal(doc.events.length, 2);
  assert.equal(Object.keys(doc.jobs).length, 0);
});
test("public snapshot excludes credentials, push endpoints, and receipts", async () => {
  const { doc } = await fixture();
  const publicJSON = JSON.stringify(snapshot(doc));
  assert.ok(!publicJSON.includes(A.tokenHash));
  assert.ok(!publicJSON.includes(B.subscription.endpoint));
  assert.ok(!publicJSON.includes("receipts"));
  assert.throws(() => authenticate(doc, "a.wrong"), { status: 401 });
  doc.devices.a.revoked = now;
  assert.throws(() => authenticate(doc, `a.${"a".repeat(64)}`), {
    status: 401,
  });
});
test("partner pushes exclude all devices of the actor and describe original occurrence time", async () => {
  const { doc } = await fixture();
  doc.devices.laptop = { ...A, id: "laptop", subscription: B.subscription };
  applyCommand(
    doc,
    command("care", "create", "new", { type: "poop", time: now }),
    A,
  );
  assert.deepEqual(
    Object.values(doc.jobs).map((j) => j.recipient),
    ["b"],
  );
  const n = notification(Object.values(doc.jobs)[0]);
  assert.match(n.title, /Brandon logged a poop/);
  assert.ok(n.url.includes("new"));
  assert.ok(!n.body.includes("just now"));
});
test("notification transient failures remain durable and recover on retry", async () => {
  const { store } = await fixture();
  await transact(store, "home/test", (d) =>
    applyCommand(
      d,
      command("care", "create", "new", { type: "pee", time: now }),
      A,
    ),
  );
  let time = Date.now();
  await dispatch(store, "home/test", {
    send: async () => {
      throw new Error("offline");
    },
    now: () => time,
    limit: 1,
  });
  let job = Object.values((await store.get("home/test")).jobs)[0];
  assert.equal(job.status, "pending");
  time = job.nextAt + 1;
  let sent = 0;
  await dispatch(store, "home/test", {
    send: async () => {
      sent++;
    },
    now: () => time,
    limit: 1,
  });
  assert.equal(sent, 1);
  assert.equal(
    Object.values((await store.get("home/test")).jobs)[0].status,
    "sent",
  );
});
test("expired subscription is retired, preserving the care event", async () => {
  const { store } = await fixture();
  await transact(store, "home/test", (d) =>
    applyCommand(
      d,
      command("care", "create", "new", { type: "pee", time: now }),
      A,
    ),
  );
  await dispatch(store, "home/test", {
    send: async () => {
      throw Object.assign(new Error("gone"), { statusCode: 410 });
    },
    limit: 1,
  });
  const d = await store.get("home/test");
  assert.equal(d.devices.b.subscription, undefined);
  assert.ok(d.events.some((e) => e.id === "new"));
});
test("API pairing verifies backup, is replay-safe, and never guesses a person for old history", async () => {
  const stores = {
    main: new MemoryStore(),
    legacy: new MemoryStore(),
    photos: new MemoryStore(),
    backup: new MemoryStore(),
  };
  await stores.legacy.setJSON("test-household", original);
  const api = createHandler(() => stores, { runDispatch: async () => {} });
  const make = () =>
    new Request(
      "https://winniecavapoo.netlify.app/.netlify/functions/api?action=pair",
      {
        method: "POST",
        body: JSON.stringify({
          code: "test-household",
          person: "brandon",
          deviceId: "phone1",
          secret: "a".repeat(64),
          name: "Phone",
        }),
      },
    );
  const first = await (await api(make())).json(),
    second = await (await api(make())).json();
  assert.equal(first.events.length, original.events.length);
  assert.equal(second.devices.length, 1);
  assert.equal(first.events[0].loggedBy, undefined);
  assert.equal((await stores.backup.list()).blobs.length, 1);
});
test("explicit recovery preserves unknown fields without sending historical pushes", () => {
  const d = migrate(original);
  d.devices = { a: A, b: B };
  const event = {
    id: "local-old",
    type: "slumber",
    time: now,
    end_time: now - 1,
    coords: { lat: 1 },
    custom: "preserve",
  };
  applyCommand(d, command("recover", "recover", event.id, event), A);
  assert.equal(d.events.at(-1).custom, "preserve");
  assert.equal(d.events.at(-1).end_time, now - 1);
  assert.equal(Object.keys(d.jobs).length, 0);
});
