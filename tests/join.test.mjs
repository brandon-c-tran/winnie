import test from "node:test";
import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
import { createHandler } from "../netlify/lib/api.mjs";
import { hash } from "../netlify/lib/core.mjs";
import { WinnieSync } from "../public/sync.js";
import { MemoryStore } from "./store.mjs";
const JOIN_FAILED =
  "That code didn't work. Codes last 15 minutes and work once.";
const stores = {
  main: new MemoryStore(),
  legacy: new MemoryStore(),
  photos: new MemoryStore(),
  backup: new MemoryStore(),
};
const api = createHandler(() => stores, { runDispatch: async () => {} });
const call = async (action, { method = "POST", value, session } = {}) => {
  const res = await api(
    new Request(`http://local/.netlify/functions/api?action=${action}`, {
      method,
      headers: session
        ? {
            Authorization: `Bearer ${session.token}`,
            "X-Winnie-Home": session.home,
          }
        : {},
      body: value === undefined ? undefined : JSON.stringify(value),
    }),
  );
  return { status: res.status, data: await res.json() };
};
const secret = (c) => c.repeat(64);
let n = 0;
async function paired() {
  const code = `join-test-home-${++n}`;
  await stores.legacy.setJSON(code, {
    schemaVersion: 3,
    events: [{ id: "old", type: "pee", time: Date.now() - 50000 }],
  });
  const { status, data } = await call("pair", {
    value: {
      code,
      person: "brandon",
      deviceId: `first${n}`,
      secret: secret("a"),
    },
  });
  assert.equal(status, 200);
  assert.equal(data.events.length, 1);
  return data;
}
const joinBody = (code, deviceId, s = secret("k"), person = "kim") => ({
  code,
  person,
  deviceId,
  secret: s,
  name: "Kim's phone",
});

test("invite requires an authenticated device", async () => {
  const session = await paired();
  assert.equal((await call("invite", { value: {} })).status, 401);
  assert.equal(
    (
      await call("invite", {
        value: {},
        session: { ...session, token: `${session.token.split(".")[0]}.bad` },
      })
    ).status,
    401,
  );
  const bad = await api(
    new Request("http://local/.netlify/functions/api?action=invite", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }),
  );
  assert.equal(bad.status, 403);
});

test("a join code registers a device once, survives a same-device retry, and pair still works", async () => {
  const session = await paired();
  const { status, data: invite } = await call("invite", {
    value: {},
    session,
  });
  assert.equal(status, 200);
  assert.match(invite.code, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  assert(invite.expires > Date.now() + 14 * 60000);
  assert(invite.expires <= Date.now() + 15 * 60000);
  // Only a hash of the normalized code is stored.
  const normalized = invite.code.replace("-", "");
  const stored = await stores.main.get(`invite/${hash(normalized)}`);
  assert.equal(stored.home, session.home);
  assert.equal(stored.createdBy, session.token.split(".")[0]);
  assert(!JSON.stringify([...stores.main.rows.keys()]).includes(normalized));

  // Lowercase with spaces is accepted.
  const typed = ` ${normalized.slice(0, 4).toLowerCase()} ${normalized.slice(4).toLowerCase()} `;
  const joined = await call("join", { value: joinBody(typed, "kimphone") });
  assert.equal(joined.status, 200);
  assert.equal(joined.data.home, session.home);
  assert.equal(joined.data.person, "kim");
  assert.equal(joined.data.token, `kimphone.${secret("k")}`);
  assert.equal(joined.data.code, undefined);
  assert.equal(joined.data.events.length, 1);
  assert(joined.data.devices.some((d) => d.id === "kimphone"));

  const snap = await call("snapshot", { method: "GET", session: joined.data });
  assert.equal(snap.status, 200);
  assert.equal(snap.data.events[0].id, "old");

  // The same device retrying (lost response) gets the same session back.
  const retry = await call("join", {
    value: joinBody(invite.code, "kimphone"),
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.token, joined.data.token);
  const revision = retry.data.revision;
  assert.equal(revision, joined.data.revision);

  // A different device cannot reuse the code.
  const other = await call("join", {
    value: joinBody(invite.code, "intruder"),
  });
  assert.equal(other.status, 404);
  assert.equal(other.data.error, JOIN_FAILED);
  // Nor can someone reuse the deviceId with a different secret.
  const stolen = await call("join", {
    value: joinBody(invite.code, "kimphone", secret("z")),
  });
  assert.equal(stolen.status, 401);
  const after = await call("snapshot", { method: "GET", session });
  assert(!after.data.devices.some((d) => d.id === "intruder"));

  // The long shared code still pairs existing installs unchanged.
  const again = await call("pair", {
    value: {
      code: `join-test-home-${n}`,
      person: "brandon",
      deviceId: `first${n}`,
      secret: secret("a"),
    },
  });
  assert.equal(again.status, 200);
  assert.equal(again.data.home, session.home);
});

test("expired, unknown and malformed codes fail with plain copy", async () => {
  const session = await paired();
  const { data: invite } = await call("invite", { value: {}, session });
  const key = `invite/${hash(invite.code.replace("-", ""))}`;
  const row = await stores.main.get(key);
  await stores.main.setJSON(key, { ...row, expires: Date.now() - 1 });
  const expired = await call("join", { value: joinBody(invite.code, "late") });
  assert.equal(expired.status, 404);
  assert.equal(expired.data.error, JOIN_FAILED);
  const unknown = await call("join", { value: joinBody("ABCD-EFGH", "x") });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.data.error, JOIN_FAILED);
  for (const code of ["ABCD-EFG0", "short", 12345678, null])
    assert.equal(
      (await call("join", { value: joinBody(code, "x") })).status,
      400,
    );
  const { data: fresh } = await call("invite", { value: {}, session });
  assert.equal(
    (await call("join", { value: joinBody(fresh.code, "x", "short") })).data
      .error,
    "Choose who is using this device.",
  );
  // A rejected request does not use up the code.
  assert.equal(
    (await call("join", { value: joinBody(fresh.code, "kim2") })).status,
    200,
  );
});

test("client join reuses its pending identity after a lost response and never stores the code", async () => {
  const session = await paired();
  const { data: invite } = await call("invite", { value: {}, session });
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: false },
    configurable: true,
  });
  const s = new WinnieSync();
  s.db = await new Promise((resolve, reject) => {
    const r = indexedDB.open("join-client");
    r.onupgradeneeded = () => {
      r.result.createObjectStore("homes");
      r.result.createObjectStore("photos");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const sent = [];
  let loseResponse = true;
  s.request = async (action, { method, value } = {}) => {
    sent.push(value);
    const result = await call(action, { method, value });
    if (loseResponse) {
      loseResponse = false;
      throw new Error("Network failed");
    }
    if (result.status !== 200) throw new Error(result.data.error);
    return result.data;
  };
  await assert.rejects(s.join(invite.code, "kim", "Kim's phone"), /Network/);
  assert.equal(s.session, null);
  await s.join(invite.code, "kim", "Kim's phone");
  assert.equal(sent[0].deviceId, sent[1].deviceId);
  assert.equal(sent[0].secret, sent[1].secret);
  assert.deepEqual(Object.keys(s.session).sort(), ["home", "person", "token"]);
  assert.equal(s.session.home, session.home);
  assert(![...storage.values()].some((v) => v.includes(invite.code)));
  assert.equal(storage.get("winnie:v4:join"), undefined);
  assert.deepEqual(JSON.parse(storage.get("winnie:v4:session")), s.session);
  assert.equal(s.view().events[0].id, "old");
  assert.equal(s.data.legacy, null);
  s.request = async (action, { method, value } = {}) =>
    (await call(action, { method, value, session: s.session })).data;
  const next = await s.createJoinCode();
  assert.deepEqual(Object.keys(next).sort(), ["code", "expires"]);
  assert.match(next.code, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  delete globalThis.localStorage;
});
