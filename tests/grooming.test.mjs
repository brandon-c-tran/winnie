import test from "node:test";
import assert from "node:assert/strict";
import { migrate, applyCommand } from "../netlify/lib/core.mjs";
import { notification } from "../netlify/lib/push.mjs";
import {
  validateCarePlans,
  planState,
  completionId,
} from "../public/care-plans.js";
const brandon = { id: "phone-a", person: "brandon" },
  kim = { id: "phone-b", person: "kim" };
const time = Date.now() - 60000;
const create = (id, payload) => ({
  protocol: 4,
  operationId: id,
  kind: "create",
  eventId: id,
  payload: { type: "grooming", time, who: "us", ...payload },
});
function home() {
  const doc = migrate({ events: [] });
  doc.devices = {
    [brandon.id]: {
      ...brandon,
      subscription: { endpoint: "https://fcm.googleapis.com/x", keys: {} },
    },
    [kim.id]: {
      ...kim,
      subscription: { endpoint: "https://fcm.googleapis.com/y", keys: {} },
    },
  };
  return doc;
}

test("grooming without a care plan requires a short named title", () => {
  const doc = home();
  applyCommand(doc, create("bath", { careTitle: "  Bath " }), kim);
  assert.equal(doc.events[0].type, "grooming");
  assert.equal(doc.events[0].careTitle, "Bath");
  assert.equal(doc.events[0].carePlanId, undefined);
  for (const [id, payload] of [
    ["missing", {}],
    ["blank", { careTitle: "   " }],
    ["long", { careTitle: "x".repeat(61) }],
    ["number", { careTitle: 5 }],
  ])
    assert.throws(
      () => applyCommand(doc, create(id, payload), kim),
      /grooming|Invalid event text/,
    );
  applyCommand(doc, create("max", { careTitle: "x".repeat(60) }), kim);
  const event = doc.events[0];
  assert.throws(
    () =>
      applyCommand(
        doc,
        {
          protocol: 4,
          operationId: "clear",
          kind: "edit",
          eventId: event.id,
          expectedRevision: event.revision,
          payload: { careTitle: "" },
        },
        kim,
      ),
    /grooming/,
  );
  applyCommand(
    doc,
    {
      protocol: 4,
      operationId: "rename",
      kind: "edit",
      eventId: event.id,
      expectedRevision: event.revision,
      payload: { careTitle: "Nails" },
    },
    kim,
  );
  assert.equal(doc.events[0].careTitle, "Nails");
  assert.equal(doc.events.length, 2);
});

test("care plans accept grooming and completions keep the plan title", () => {
  const plan = {
    id: "bath",
    title: "Bath every 3 weeks",
    instructions: "",
    start: "2026-01-01",
    every: 3,
    unit: "week",
    type: "grooming",
    paused: false,
    claim: null,
  };
  assert.equal(validateCarePlans([plan])[0].type, "grooming");
  const doc = home();
  applyCommand(
    doc,
    {
      protocol: 4,
      operationId: "plan",
      kind: "profile",
      eventId: null,
      payload: { carePlans: [plan] },
      expectedRevision: doc.profile.revision,
    },
    brandon,
  );
  const due = planState(plan, doc.events).due;
  applyCommand(
    doc,
    {
      protocol: 4,
      operationId: "done",
      kind: "create",
      eventId: completionId(plan, due),
      payload: {
        type: "grooming",
        time,
        carePlanId: plan.id,
        careDue: due,
        careTitle: plan.title,
        who: "us",
      },
    },
    brandon,
  );
  assert.equal(doc.events[0].careTitle, "Bath every 3 weeks");
  assert.equal(planState(plan, doc.events).done.id, doc.events[0].id);
  // Existing plan invariants still apply to grooming completions.
  assert.throws(
    () =>
      applyCommand(
        doc,
        {
          protocol: 4,
          operationId: "unlink",
          kind: "edit",
          eventId: doc.events[0].id,
          expectedRevision: doc.events[0].revision,
          payload: { carePlanId: "" },
        },
        brandon,
      ),
    /original care link/,
  );
});

test("grooming push reads as what was done", () => {
  const doc = home();
  applyCommand(doc, create("g1", { careTitle: "Bath" }), kim);
  const job = Object.values(doc.jobs)[0];
  assert.equal(job.careTitle, "Bath");
  assert.equal(notification(job).title, "Kim logged a bath");
  const n = (careTitle, extra = {}) =>
    notification({
      kind: "create",
      action: "logged",
      actor: "kim",
      type: "grooming",
      careTitle,
      eventId: "e",
      time,
      ...extra,
    });
  assert.equal(n("Haircut").title, "Kim logged a haircut");
  assert.equal(n("Ear clean").title, "Kim logged an ear clean");
  assert.equal(n("Nails").title, "Kim logged nails");
  assert.equal(n("Teeth").title, "Kim logged teeth");
  assert.equal(n(undefined).title, "Kim logged grooming");
  assert.equal(n("").title, "Kim logged grooming");
  const react = n("Bath", { kind: "react", emoji: "❤️" });
  assert.equal(react.title, "Kim reacted ❤️");
  assert.match(react.body, /^To Winnie's bath · /);
  // Other types are unchanged.
  assert.equal(
    notification({ ...job, type: "pee", careTitle: undefined }).title,
    "Kim logged a pee",
  );
});
