import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "./store.mjs";
import { migrate, hash, snapshot, applyCommand } from "../netlify/lib/core.mjs";
import {
  photoAIAction,
  runPhotoAI,
  publicPhotoAI,
  analyzePhoto,
} from "../netlify/lib/photo-ai.mjs";
import {
  photoMatches,
  suggestedPairs,
  suggestedCollections,
  validateObservation,
  validateMemoryLibrary,
} from "../public/photo-discovery.js";
import { createHandler } from "../netlify/lib/api.mjs";

const now = Date.parse("2026-10-14T12:00Z"),
  key = "home/" + "a".repeat(64),
  token = "device." + "b".repeat(64);
const good = {
  description: "A dog resting in a pink bed beside a stuffed puppy.",
  concepts: ["pink bed", "snuggle puppy", "sleeping"],
};
const response = () =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(good) } }],
      usage: { prompt_tokens: 100, completion_tokens: 30 },
    }),
  );
async function fixture(count = 8) {
  const main = new MemoryStore(),
    photos = new MemoryStore();
  const events = Array.from({ length: count }, (_, i) => ({
    id: "event-" + i,
    type: i === 0 ? "poop" : "moment",
    time: now - i * 86400000 * 30,
    note: "Original caption",
    photos: [{ id: "photo-" + i, addedAt: now, keepsake: i === 0 }],
  }));
  const doc = migrate({ events });
  doc.devices.device = {
    id: "device",
    person: "brandon",
    tokenHash: hash("b".repeat(64)),
  };
  await main.setJSON(key, doc);
  for (let i = 0; i < count; i++)
    await photos.set(
      key.slice(5) + "/photo-" + i,
      Buffer.from([255, 216, 255, 0]),
      { metadata: { type: "image/jpeg" } },
    );
  return { main, photos, key, token, apiKey: "test-only", fetcher: response };
}
const action = (f, action, input = {}) =>
  photoAIAction({ ...f, action, input });

test("scan requires consent and provider configuration; excludes care by default", async () => {
  const f = await fixture();
  await assert.rejects(action(f, "sample"), /Confirm/);
  await assert.rejects(
    action({ ...f, apiKey: "" }, "sample", { consent: true }),
    /OPENAI_API_KEY/,
  );
  const result = await action(f, "sample", { consent: true });
  assert.equal(result.pending, 5);
  assert.equal(result.eligible, 7);
  const doc = await f.main.get(key);
  assert.ok(!doc.photoAI.jobs.some((j) => j.id === "photo-0"));
  await assert.rejects(
    action(f, "sample", { consent: true }),
    /Finish or pause/,
  );
});
test("care inclusion only allows explicitly kept care photos", async () => {
  const f = await fixture(2);
  const doc = await f.main.get(key);
  doc.events.push({
    id: "unselected",
    type: "poop",
    time: now,
    photos: [{ id: "unselected-photo" }],
  });
  await f.main.setJSON(key, doc);
  const r = await action(f, "sample", { consent: true, includeCare: true });
  assert.equal(r.eligible, 2);
  assert.equal(r.pending, 2);
});
test("concurrent workers claim each photo once and preserve originals", async () => {
  const f = await fixture(2);
  await action(f, "sample", { consent: true });
  let calls = 0;
  f.fetcher = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 20));
    return response();
  };
  await Promise.all([
    runPhotoAI(f.main, f.photos, key, f),
    runPhotoAI(f.main, f.photos, key, f),
  ]);
  assert.equal(calls, 1);
  const doc = await f.main.get(key);
  assert.equal(doc.events[1].note, "Original caption");
  assert.deepEqual(doc.photoAI.results["photo-1"].concepts, good.concepts);
  assert.equal(doc.photoAI.jobs.length, 0);
  assert.equal(publicPhotoAI(doc).usage.inputTokens, 100);
  assert.equal(snapshot(doc).photoAI.results["photo-1"].source, "ai");
});
test("pause during an external request prevents a late result from being saved", async () => {
  const f = await fixture(2);
  await action(f, "sample", { consent: true });
  f.fetcher = async () => {
    await action(f, "disable");
    return response();
  };
  await runPhotoAI(f.main, f.photos, key, f);
  const doc = await f.main.get(key);
  assert.deepEqual(doc.photoAI.results, {});
  assert.equal(doc.photoAI.enabled, false);
});
test("deleted or deselected photos cannot be sent or remain in the public index", async () => {
  const f = await fixture(2);
  await action(f, "sample", { consent: true, includeCare: true });
  const doc = await f.main.get(key);
  doc.events[0].photos[0].keepsake = false;
  doc.events[1].deletedAt = now;
  await f.main.setJSON(key, doc);
  let calls = 0;
  await runPhotoAI(f.main, f.photos, key, {
    ...f,
    fetcher: async () => {
      calls++;
      return response();
    },
  });
  assert.equal(calls, 0);
  assert.equal(publicPhotoAI(await f.main.get(key)).pending, 0);
});
test("retries use backoff, stop after three failures, and count toward daily cap", async () => {
  const f = await fixture(2);
  await action(f, "sample", { consent: true });
  f.fetcher = async () => new Response("unavailable", { status: 429 });
  await runPhotoAI(f.main, f.photos, key, { ...f, now });
  await runPhotoAI(f.main, f.photos, key, { ...f, now });
  assert.equal((await f.main.get(key)).photoAI.usage.calls, 1);
  await runPhotoAI(f.main, f.photos, key, { ...f, now: now + 600000 });
  await runPhotoAI(f.main, f.photos, key, { ...f, now: now + 1200000 });
  assert.equal(publicPhotoAI(await f.main.get(key)).failed, 1);
  const retried = await action(f, "retry");
  assert.equal(retried.pending, 1);
  assert.equal(retried.failed, 0);
  assert.equal(Object.keys(retried.results).length, 0);
});
test("daily budget blocks further requests and resumes next UTC day", async () => {
  const f = await fixture(2);
  await action(f, "sample", { consent: true });
  let doc = await f.main.get(key);
  doc.photoAI.usage = {
    day: "2026-10-14",
    calls: 50,
    inputTokens: 0,
    outputTokens: 0,
  };
  await f.main.setJSON(key, doc);
  assert.equal(await runPhotoAI(f.main, f.photos, key, { ...f, now }), false);
  assert.equal(
    await runPhotoAI(f.main, f.photos, key, { ...f, now: now + 86400000 }),
    true,
  );
});
test("corrections remain separate, are searchable and survive repeated scan requests", async () => {
  const f = await fixture(2);
  await action(f, "sample", { consent: true });
  await runPhotoAI(f.main, f.photos, key, f);
  await action(f, "correct", {
    photoId: "photo-1",
    observation: { description: "On the couch.", concepts: ["couch"] },
  });
  await action(f, "more", { reviewed: true });
  assert.equal((await f.main.get(key)).photoAI.jobs.length, 0);
  assert.equal(
    (await f.main.get(key)).photoAI.results["photo-1"].source,
    "user",
  );
  const usage = (await f.main.get(key)).photoAI.usage;
  await action(f, "forget");
  assert.deepEqual((await f.main.get(key)).photoAI.usage, usage);
  assert.deepEqual(publicPhotoAI(await f.main.get(key)).results, {});
  assert.equal((await f.main.get(key)).events[1].note, "Original caption");
});

test("empty samples do not enable scanning or persist a broken setup", async () => {
  const f = await fixture(0);
  await assert.rejects(
    action(f, "sample", { consent: true }),
    /unscanned memory photos/,
  );
  assert.equal(publicPhotoAI(await f.main.get(key)).enabled, false);
});
test("larger and automatic scans require reviewed results; auto only picks newly attached photos", async () => {
  const f = await fixture(2);
  await action(f, "sample", { consent: true });
  await assert.rejects(
    action(f, "more", { reviewed: true }),
    /Review the sample/,
  );
  await runPhotoAI(f.main, f.photos, key, f);
  await assert.rejects(
    action(f, "auto", { enabled: true }),
    /Review the sample/,
  );
  await action(f, "auto", { reviewed: true, enabled: true });
  const doc = await f.main.get(key);
  doc.events.push({
    id: "new-event",
    type: "moment",
    time: now,
    photos: [{ id: "new-photo", addedAt: Date.now() + 1000 }],
  });
  await f.main.setJSON(key, doc);
  await f.photos.set(
    key.slice(5) + "/new-photo",
    Buffer.from([255, 216, 255]),
    { metadata: { type: "image/jpeg" } },
  );
  await runPhotoAI(f.main, f.photos, key, f);
  assert.ok((await f.main.get(key)).photoAI.results["new-photo"]);
});
test("vision sends image bytes only, with strict schema and no storage, and rejects malformed output", async () => {
  let sent;
  await analyzePhoto(Buffer.from("test"), "image/jpeg", {
    apiKey: "test",
    fetcher: async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/chat/completions");
      sent = JSON.parse(options.body);
      return response();
    },
  });
  assert.equal(sent.store, false);
  assert.equal(sent.response_format.json_schema.strict, true);
  assert.equal(sent.messages[1].content[0].image_url.detail, "low");
  assert.ok(!JSON.stringify(sent).includes("Original caption"));
  await assert.rejects(
    analyzePhoto(Buffer.from("test"), "image/jpeg", {
      apiKey: "test",
      fetcher: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: '{"description":"dog","concepts":["healthy"]}',
                },
              },
            ],
          }),
        ),
    }),
    /supported photo labels/,
  );
});
test("authenticated API exposes configuration but never keys; reads do not start scans", async () => {
  const f = await fixture();
  const handler = createHandler(
    () => ({ ...f, legacy: new MemoryStore(), backup: new MemoryStore() }),
    { photoAIKey: "test-secret", photoAIFetch: response },
  );
  const url =
    "https://winniecavapoo.netlify.app/.netlify/functions/api?action=photo-ai";
  assert.equal((await handler(new Request(url))).status, 401);
  const res = await handler(
    new Request(url, {
      headers: {
        "X-Winnie-Home": key.slice(5),
        Authorization: "Bearer " + token,
      },
    }),
  );
  const body = await res.text();
  assert.ok(body.includes('"configured":true'));
  assert.ok(!body.includes("test-secret"));
  assert.equal(JSON.parse(body).enabled, false);
});
test("search uses corrected concepts and synonyms while keeping caption search", () => {
  assert.ok(
    photoMatches("show me Winnie on the sofa", "", {
      description: "",
      concepts: ["couch"],
    }),
  );
  assert.ok(
    photoMatches("striped shirt", "", {
      description: "",
      concepts: ["striped shirt"],
    }),
  );
  assert.ok(photoMatches("Garland", "Christmas in Garland", null));
  assert.ok(
    !photoMatches("snow", "", { description: "", concepts: ["pink bed"] }),
  );
  assert.throws(() =>
    validateObservation({ description: "x", concepts: ["favorite"] }),
  );
});
test("pairs use saved dates, require sixty days, and respect Keep / Wrong match", () => {
  const photos = [
      { photo: { id: "a" }, day: "2025-10-06" },
      { photo: { id: "b" }, day: "2025-10-08" },
      { photo: { id: "c" }, day: "2026-03-01" },
    ],
    obs = { a: good, b: good, c: good };
  const pairs = suggestedPairs(photos, obs);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].id, "a~c");
  assert.equal(suggestedPairs(photos, obs, { "a~c": "dismissed" }).length, 0);
  assert.ok(
    suggestedCollections(photos, obs).some(
      (c) => c.concept === "pink bed" && c.photoIds.length === 3,
    ),
  );
});
test("collections validate references and share via versioned profile commands", async () => {
  const f = await fixture();
  const doc = await f.main.get(key),
    value = {
      collections: [{ id: "bed", name: "Bed days", photoIds: ["photo-1"] }],
      pairs: { "photo-1~photo-2": "kept" },
    };
  const command = {
    protocol: 4,
    operationId: "library-command",
    kind: "profile",
    expectedRevision: doc.profile.revision,
    payload: { memoryLibrary: value },
  };
  applyCommand(doc, command, doc.devices.device);
  assert.deepEqual(doc.profile.memoryLibrary, value);
  assert.throws(
    () =>
      validateMemoryLibrary(
        {
          ...value,
          collections: [{ id: "bed", name: "Bed", photoIds: ["missing"] }],
        },
        new Set(["photo-1"]),
      ),
    /available/,
  );
});
