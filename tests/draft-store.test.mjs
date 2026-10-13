import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { createDraftStore } from "../public/draft-store.js";

test("drafts preserve photo bytes, belong to one household, and are removed after completion", async () => {
  const storage = new IDBFactory();
  const first = createDraftStore(storage);
  await first.put({
    key: "photos:one",
    home: "one",
    data: {
      note: "Park",
      photos: [new Blob(["photo bytes"], { type: "image/jpeg" })],
    },
  });
  await first.put({
    key: "entry:two",
    home: "two",
    data: { note: "Separate household" },
  });
  const reopened = createDraftStore(storage);
  const [saved] = await reopened.list("one");
  assert.equal(saved.data.note, "Park");
  assert.equal(await saved.data.photos[0].text(), "photo bytes");
  assert.equal((await reopened.list("one")).length, 1);
  await reopened.remove(saved.key);
  assert.equal((await first.list("one")).length, 0);
  assert.equal((await first.list("two")).length, 1);
});
