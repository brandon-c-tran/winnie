import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

export const hash = (value) =>
  createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(value),
    )
    .digest("hex");
export const TYPES = [
  "pee",
  "poop",
  "meal",
  "enrichment",
  "medication",
  "vomit",
  "nap",
  "slumber",
  "walk",
  "outing",
  "episode",
  "appointment",
  "travel",
  "covered_gap",
  "note",
  "moment",
];
const SLEEP = ["nap", "slumber"];
export class Fault extends Error {
  constructor(status, message, detail = {}) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}
export function assert(ok, message, status = 400, detail) {
  if (!ok) throw new Fault(status, message, detail);
}
export function validId(id) {
  return (
    typeof id === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(id) &&
    !["__proto__", "constructor", "prototype"].includes(id)
  );
}
export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable(value[k])]),
    );
  return value;
}
export function migrate(raw, now = Date.now()) {
  assert(
    raw && Array.isArray(raw.events),
    "The existing log could not be read.",
    503,
  );
  const ids = new Set();
  for (const e of raw.events) {
    assert(
      validId(e.id) && !ids.has(e.id),
      "History needs review before upgrading: invalid or duplicate IDs.",
      409,
    );
    ids.add(e.id);
  }
  // Every legacy field stays intact. New provenance is separate from old who/source fields.
  return {
    schemaVersion: 4,
    revision: 1,
    events: raw.events.map((e) => ({ ...e, revision: 1 })),
    devices: {},
    receipts: {},
    jobs: {},
    profile: { revision: 1, routine: "", goal: "", withPerson: "" },
    migratedAt: now,
    migration: {
      count: raw.events.length,
      sha256: hash(stable(raw)),
      version: 1,
    },
  };
}
export function snapshot(doc) {
  return {
    schemaVersion: 4,
    revision: doc.revision,
    events: doc.events,
    profile: doc.profile,
    migration: doc.migration,
    devices: Object.values(doc.devices).map(
      ({ id, person, name, created, revoked, subscription }) => ({
        id,
        person,
        name,
        created,
        revoked,
        notifications: !!subscription,
      }),
    ),
    usage: Object.fromEntries(
      ["brandon", "kim"].map((p) => [
        p,
        doc.events.filter((e) => !e.deletedAt && e.loggedBy === p).length,
      ]),
    ),
  };
}
export function authenticate(doc, token) {
  const [id, secret] = (token || "").split(".");
  const device = doc.devices[id];
  const digest = hash(secret || "");
  assert(
    device &&
      !device.revoked &&
      device.tokenHash?.length === digest.length &&
      timingSafeEqual(Buffer.from(device.tokenHash), Buffer.from(digest)),
    "Please reconnect this device.",
    401,
  );
  return device;
}
function eventFields(input, old = {}) {
  assert(
    input && typeof input === "object" && !Array.isArray(input),
    "Invalid event details.",
  );
  const allowed = [
    "type",
    "time",
    "end_time",
    "time_precision",
    "timezone",
    "tags",
    "who",
    "location",
    "note",
    "retroactive",
    "subkind",
    "kind",
    "enrichment_kind",
    "episode_kind",
    "appointment_kind",
    "signal",
  ];
  const fields = Object.fromEntries(
    allowed.filter((k) => Object.hasOwn(input, k)).map((k) => [k, input[k]]),
  );
  const event = { ...old, ...fields };
  for (const key of [
    "type",
    "time_precision",
    "timezone",
    "who",
    "location",
    "note",
    "subkind",
    "kind",
    "enrichment_kind",
    "episode_kind",
    "appointment_kind",
    "signal",
  ])
    if (Object.hasOwn(fields, key))
      assert(typeof fields[key] === "string", "Invalid event text.");
  assert(TYPES.includes(event.type), "Choose an event type.");
  assert(
    Number.isFinite(event.time) &&
      event.time > 0 &&
      event.time <= Date.now() + 86400000,
    "Choose a valid event time.",
  );
  if (event.end_time != null)
    assert(
      Number.isFinite(event.end_time) &&
        event.end_time >= event.time &&
        event.end_time <= Date.now() + 86400000,
      "The end must be after the start.",
    );
  assert(
    !event.tags ||
      (Array.isArray(event.tags) &&
        event.tags.length <= 30 &&
        event.tags.every((t) => typeof t === "string" && t.length < 100)),
    "Invalid tags.",
  );
  for (const [key, value] of Object.entries(fields))
    if (typeof value === "string")
      assert(
        value.length <= (key === "note" ? 10000 : 500),
        "This text is too long.",
      );
  assert(
    ["us", "trainer", "sitter", "unknown"].includes(event.who || "us"),
    "Choose who provided care.",
  );
  return fields;
}
function ensureActivity(doc, event) {
  if (
    !event.deletedAt &&
    event.end_time == null &&
    (SLEEP.includes(event.type) || event.type === "walk")
  ) {
    const other = doc.events.find(
      (e) =>
        e.id !== event.id &&
        !e.deletedAt &&
        e.end_time == null &&
        (SLEEP.includes(event.type)
          ? SLEEP.includes(e.type)
          : e.type === "walk"),
    );
    assert(
      !other,
      SLEEP.includes(event.type)
        ? "A sleep is already started. Review it before starting another."
        : "A walk is already started.",
      409,
      { current: other },
    );
  }
}
export function applyCommand(doc, command, device, now = Date.now()) {
  assert(
    command.protocol === 4 && validId(command.operationId),
    "Update Winnie to continue.",
    426,
  );
  const digest = hash(stable(command));
  const prior = doc.receipts[command.operationId];
  if (prior) {
    assert(
      prior.digest === digest && prior.deviceId === device.id,
      "This action ID was already used.",
      409,
    );
    return { duplicate: true, receipt: prior };
  }
  const { kind, eventId, payload = {}, expectedRevision } = command;
  let event = doc.events.find((e) => e.id === eventId);
  let notify = false;
  if (kind === "profile") {
    assert(
      expectedRevision === doc.profile.revision,
      "Your shared plan changed. Review the latest version.",
      409,
      { current: doc.profile },
    );
    for (const field of ["routine", "goal", "withPerson"])
      if (Object.hasOwn(payload, field)) {
        assert(
          typeof payload[field] === "string" && payload[field].length <= 2000,
          "Keep your shared plan under 2,000 characters.",
        );
        if (field === "withPerson")
          assert(
            ["", "brandon", "kim"].includes(payload[field]),
            "Choose a person.",
          );
        doc.profile[field] = payload[field];
      }
    doc.profile.revision++;
    doc.profile.updatedBy = device.person;
    doc.profile.updatedAt = now;
  } else {
    assert(validId(eventId), "Invalid event ID.");
    if (kind === "create" || kind === "recover") {
      assert(
        !event,
        "This entry already exists. Review it before adding it again.",
        409,
        { current: event },
      );
      if (kind === "recover") {
        assert(
          payload.id === eventId &&
            typeof payload.type === "string" &&
            Number.isFinite(payload.time),
          "This saved entry needs review.",
        );
        assert(JSON.stringify(payload).length <= 30000, "Entry too large.");
        // Explicit recovery preserves historical fields, including unusual durations. Never sends a new-care push.
        event = {
          ...payload,
          id: eventId,
          revision: 1,
          recoveredAt: now,
          recoveredBy: device.person,
        };
        delete event.deletedAt;
        delete event.loggedBy;
        delete event.deviceId;
        delete event.photos;
      } else {
        event = {
          ...eventFields(payload),
          id: eventId,
          created: now,
          source: "manual",
          revision: 1,
          loggedBy: device.person,
          deviceId: device.id,
          photos: [],
        };
        ensureActivity(doc, event);
        notify = true;
      }
      doc.events.push(event);
    } else {
      assert(event, "This entry is missing.", 404);
      assert(
        event.revision === expectedRevision,
        "This entry changed on another device. Review both versions.",
        409,
        { current: event },
      );
      assert(
        !event.deletedAt || kind === "restore",
        "This entry was removed. Restore it explicitly to keep it.",
        409,
        { current: event },
      );
      if (kind === "edit") {
        const updated = { ...event, ...eventFields(payload, event) };
        ensureActivity(doc, updated);
        notify =
          event.end_time == null &&
          updated.end_time != null &&
          (SLEEP.includes(event.type) || event.type === "walk");
        Object.assign(event, updated);
      } else if (kind === "delete") {
        event.deletedAt = now;
        notify = true;
      } else if (kind === "restore") {
        delete event.deletedAt;
        ensureActivity(doc, event);
      } else if (kind === "attach") {
        assert(validId(payload.photoId), "Invalid photo.");
        event.photos ||= [];
        assert(event.photos.length < 20, "This moment already has 20 photos.");
        if (!event.photos.some((p) => p.id === payload.photoId)) {
          event.photos.push({
            id: payload.photoId,
            addedAt: now,
            addedBy: device.person,
          });
          notify = true;
        }
      } else if (kind === "removePhoto")
        event.photos = (event.photos || []).filter(
          (p) => p.id !== payload.photoId,
        );
      else throw new Fault(400, "Unknown action.");
      event.revision++;
      event.updatedAt = now;
      event.editedBy = device.person;
    }
  }
  doc.revision++;
  const receipt = {
    operationId: command.operationId,
    digest,
    deviceId: device.id,
    revision: event?.revision || doc.profile.revision,
    committedAt: now,
    eventId,
  };
  doc.receipts[command.operationId] = receipt;
  if (notify) {
    const recipient = device.person === "kim" ? "brandon" : "kim";
    for (const target of Object.values(doc.devices).filter(
      (d) => !d.revoked && d.person === recipient && d.subscription,
    )) {
      const id = `${command.operationId}_${target.id}`;
      doc.jobs[id] = {
        id,
        eventId,
        actor: device.person,
        recipient: target.id,
        kind,
        action:
          kind === "attach"
            ? "added"
            : kind === "edit"
              ? "ended"
              : kind === "delete"
                ? "removed"
                : "logged",
        type: kind === "attach" ? "photo" : event.type,
        time: kind === "edit" ? event.end_time : event.time,
        createdAt: now,
        attempts: 0,
        nextAt: now,
        status: "pending",
      };
    }
  }
  return { receipt };
}

export async function transact(store, key, change, attempts = 12) {
  for (let i = 0; i < attempts; i++) {
    const row = await store.getWithMetadata(key, { type: "json" });
    assert(row, "Shared log not found. Reconnect this device.", 404);
    assert(
      row.etag,
      "Storage did not return a version. Your action remains pending.",
      503,
    );
    const result = await change(row.data);
    if (result?.duplicate) return { doc: row.data, ...result };
    const write = await store.setJSON(key, row.data, { onlyIfMatch: row.etag });
    if (write.modified) {
      assert(write.etag, "Storage did not confirm a write version.", 503);
      return { doc: row.data, ...result };
    }
    await new Promise((r) =>
      setTimeout(r, Math.random() * Math.min(15 * (i + 1), 120)),
    );
  }
  throw new Fault(
    503,
    "Still syncing. Your action is safe on this device; retry shortly.",
  );
}
export const operationId = () => randomUUID();
