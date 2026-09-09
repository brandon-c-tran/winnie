import { notificationState } from "./everyday.js?v=3.2";
const API = "/.netlify/functions/api";
const empty = () => ({
  snapshot: {
    events: [],
    revision: 0,
    profile: { revision: 1, routine: "", goal: "" },
  },
  queue: [],
  legacy: null,
  reviewed: [],
});
const uid = () => crypto.randomUUID();
const ordered = (v) =>
  Array.isArray(v)
    ? v.map(ordered)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, ordered(v[k])]),
        )
      : v;
export function legacyMatches(old, shared) {
  return (
    !!shared &&
    !shared.deletedAt &&
    Object.keys(old).every(
      (k) =>
        JSON.stringify(ordered(old[k])) === JSON.stringify(ordered(shared[k])),
    )
  );
}
export function project(data) {
  const snap = structuredClone(data.snapshot);
  for (const item of data.queue) {
    const c = item.command,
      e = snap.events.find((e) => e.id === c.eventId);
    if (item.error) continue;
    if (c.kind === "profile") {
      Object.assign(snap.profile, c.payload);
      snap.profile.revision++;
      continue;
    }
    if (["create", "recover"].includes(c.kind)) {
      if (!e)
        snap.events.push({
          ...c.payload,
          id: c.eventId,
          revision: 1,
          loggedBy: c.kind === "recover" ? undefined : item.person,
          photos: [],
          pending: true,
        });
    } else if (e) {
      if (c.kind === "edit") Object.assign(e, c.payload);
      if (c.kind === "delete") e.deletedAt = Date.now();
      if (c.kind === "restore") delete e.deletedAt;
      if (c.kind === "attach")
        e.photos = [
          ...(e.photos || []),
          { id: c.payload.photoId, addedBy: item.person },
        ];
      if (c.kind === "removePhoto")
        e.photos = (e.photos || []).filter((p) => p.id !== c.payload.photoId);
      e.revision++;
      e.pending = true;
    }
  }
  return snap;
}
export class WinnieSync extends EventTarget {
  data = empty();
  session = null;
  busy = false;
  lastError = "";
  lastChecked = 0;
  async init() {
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("winnie-v4", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("homes");
        req.result.createObjectStore("photos");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      this.session = JSON.parse(localStorage.getItem("winnie:v4:session"));
    } catch {}
    if (this.session) this.data = (await this.read()) || empty();
    window.addEventListener("online", () => this.flush());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.flush();
    });
    setInterval(() => {
      if (!document.hidden) this.flush();
    }, 15000);
    this.channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("winnie-v4")
        : null;
    if (this.channel)
      this.channel.onmessage = async () => {
        if (this.session) {
          this.data = (await this.read()) || empty();
          this.emit();
        }
      };
    this.emit();
    if (this.session) this.flush();
  }
  emit() {
    this.dispatchEvent(new Event("change"));
  }
  read() {
    return new Promise((resolve, reject) => {
      const r = this.db
        .transaction("homes")
        .objectStore("homes")
        .get(this.session.home);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async change(fn) {
    const result = await new Promise((resolve, reject) => {
      const tx = this.db.transaction("homes", "readwrite"),
        store = tx.objectStore("homes"),
        req = store.get(this.session.home);
      let value;
      req.onsuccess = () => {
        value = req.result || empty();
        try {
          fn(value);
          store.put(value, this.session.home);
        } catch (err) {
          reject(err);
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () =>
        reject(tx.error || new Error("Could not save on this device."));
      tx.onabort = () =>
        reject(tx.error || new Error("Could not save on this device."));
    });
    this.data = result;
    this.channel?.postMessage({ changed: true });
    this.emit();
    return result;
  }
  async request(action, { method = "GET", value, raw, extra = "" } = {}) {
    const headers = this.session
      ? {
          Authorization: `Bearer ${this.session.token}`,
          "X-Winnie-Home": this.session.home,
        }
      : {};
    if (value !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${API}?action=${action}${extra}`, {
      method,
      headers,
      body: raw || (value !== undefined ? JSON.stringify(value) : undefined),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
    if (action === "photo" && method === "GET" && res.ok) return res.blob();
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(
        "The server did not confirm this action. It remains pending.",
      );
    }
    if (!res.ok) {
      const err = new Error(data.error || "Please try again.");
      err.status = res.status;
      err.current = data.current;
      throw err;
    }
    return data;
  }
  async pair(code, person, name) {
    let pending;
    try {
      pending = JSON.parse(localStorage.getItem("winnie:v4:pair"));
    } catch {}
    if (!pending || pending.code !== code || pending.person !== person) {
      pending = {
        code,
        person,
        name,
        deviceId: uid(),
        secret: Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
          x.toString(16).padStart(2, "0"),
        ).join(""),
      };
      localStorage.setItem("winnie:v4:pair", JSON.stringify(pending));
    }
    const data = await this.request("pair", { method: "POST", value: pending });
    this.session = { home: data.home, token: data.token, person, code };
    localStorage.setItem("winnie:v4:session", JSON.stringify(this.session));
    localStorage.removeItem("winnie:v4:pair");
    await this.change((d) => {
      const { home, token, person, ...publicData } = data;
      d.snapshot = publicData;
      if (!d.legacy && localStorage.getItem("winnie:bin") === code) {
        const raw = localStorage.getItem("winnie:local");
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            d.legacy = {
              events: Array.isArray(parsed) ? parsed : parsed.events || [],
              capturedAt: Date.now(),
              archived: false,
            };
            const byId = new Map(publicData.events.map((e) => [e.id, e]));
            d.reviewed.push(
              ...d.legacy.events
                .filter((e) => legacyMatches(e, byId.get(e.id)))
                .map((e) => e.id),
            );
          } catch {
            d.legacyRaw = raw;
          }
        }
      }
    });
    navigator.storage?.persist?.().catch(() => {});
    this.flush();
  }
  view() {
    return project(this.data);
  }
  async enqueue(kind, eventId, payload = {}, baseRevision) {
    let id;
    await this.change((d) => {
      const snap = project(d),
        current =
          kind === "profile"
            ? snap.profile
            : snap.events.find((e) => e.id === eventId);
      if (d.queue.some((q) => q.error && q.command.eventId === eventId))
        throw new Error("Review the pending change for this entry first.");
      const command = {
        protocol: 4,
        operationId: uid(),
        kind,
        eventId,
        payload,
      };
      if (!["create", "recover"].includes(kind)) {
        if (!current) throw new Error("Entry not found.");
        command.expectedRevision = baseRevision ?? current.revision;
      }
      id = command.operationId;
      d.queue.push({
        command,
        person: this.session.person,
        queuedAt: Date.now(),
      });
    });
    this.flush();
    return id;
  }
  async addPhoto(eventId, blob) {
    const id = uid();
    await new Promise((resolve, reject) => {
      const t = this.db.transaction("photos", "readwrite");
      t.objectStore("photos").put(blob, `${this.session.home}/${id}`);
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
    await this.change((d) => {
      const event = project(d).events.find(
        (e) => e.id === eventId && !e.deletedAt,
      );
      if (!event)
        throw new Error(
          "The entry was removed. Your photo remains on this device.",
        );
      d.queue.push({
        command: {
          protocol: 4,
          operationId: uid(),
          kind: "attach",
          eventId,
          expectedRevision: event.revision,
          payload: { photoId: id },
        },
        person: this.session.person,
        queuedAt: Date.now(),
        upload: id,
      });
    });
    this.flush();
    return id;
  }
  async photo(id) {
    const local = await new Promise((resolve, reject) => {
      const r = this.db
        .transaction("photos")
        .objectStore("photos")
        .get(`${this.session.home}/${id}`);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return (
      local || this.request("photo", { extra: `&id=${encodeURIComponent(id)}` })
    );
  }
  async refresh() {
    const data = await this.request("snapshot", {
      extra: `&revision=${this.data.snapshot.revision}`,
    });
    if (!data.unchanged)
      await this.change((d) => {
        if (data.revision >= d.snapshot.revision) d.snapshot = data;
      });
    this.lastChecked = Date.now();
    this.lastError = "";
    this.emit();
  }
  async flush() {
    if (!this.session || this.busy) return;
    if (!navigator.onLine) {
      this.lastError = "Offline · saved actions will sync when you reconnect";
      this.emit();
      return;
    }
    this.busy = true;
    this.emit();
    const run = async () => {
      await this.refresh();
      this.data = await this.read();
      if (this.data.legacy && !this.data.legacy.archived) {
        const legacy = this.data.legacy;
        await this.request("archive", {
          method: "POST",
          value: { events: legacy.events, capturedAt: legacy.capturedAt },
        });
        await this.change((d) => {
          d.legacy.archived = true;
        });
      }
      for (let count = 0; count < 40; count++) {
        this.data = await this.read();
        const blocked = new Set(
          this.data.queue.filter((q) => q.error).map((q) => q.command.eventId),
        );
        const item = this.data.queue.find(
          (q) => !q.error && !blocked.has(q.command.eventId),
        );
        if (!item) break;
        try {
          if (item.upload)
            await this.request("photo", {
              method: "PUT",
              raw: await this.photo(item.upload),
              extra: `&id=${item.upload}`,
            });
          const data = await this.request("command", {
            method: "POST",
            value: item.command,
          });
          if (
            !data.receipt ||
            data.receipt.operationId !== item.command.operationId
          )
            throw new Error(
              "Waiting for confirmation. Your action remains pending.",
            );
          await this.change((d) => {
            if (data.revision >= d.snapshot.revision) d.snapshot = data;
            d.queue = d.queue.filter(
              (q) => q.command.operationId !== item.command.operationId,
            );
          });
          this.lastError = "";
          this.lastChecked = Date.now();
        } catch (err) {
          if ([400, 404, 409, 413, 415].includes(err.status)) {
            await this.change((d) => {
              const q = d.queue.find(
                (q) => q.command.operationId === item.command.operationId,
              );
              if (q) {
                q.error = err.message;
                q.current = err.current || null;
              }
            });
          } else throw err;
        }
      }
    };
    try {
      if (navigator.locks)
        await navigator.locks.request(`winnie-sync-${this.session.home}`, run);
      else await run();
    } catch (err) {
      this.lastError = err.message;
    } finally {
      this.busy = false;
      this.emit();
    }
  }
  async resolve(id, keepMine) {
    await this.change((d) => {
      const item = d.queue.find((q) => q.command.operationId === id);
      if (!item) return;
      const c = item.command,
        current =
          c.kind === "profile"
            ? d.snapshot.profile
            : d.snapshot.events.find((e) => e.id === c.eventId);
      if (keepMine) {
        if (
          !current ||
          current.deletedAt ||
          ["create", "recover"].includes(c.kind)
        )
          throw new Error(
            "Open the shared entry to decide how to keep this information.",
          );
        c.operationId = uid();
        c.expectedRevision = current.revision;
        delete item.error;
        delete item.current;
      } else d.queue = d.queue.filter((q) => q.command.operationId !== id);
      // Rebase only later, never-transmitted dependents. An uncertain sent operation is never rewritten.
      let revision = current?.revision || 0;
      for (const q of d.queue.filter((q) => q.command.eventId === c.eventId)) {
        if (q !== item) {
          q.command.expectedRevision = revision;
          q.command.operationId = uid();
          delete q.error;
        }
        revision++;
      }
    });
    this.flush();
  }
  async markReviewed(id) {
    await this.change((d) => {
      d.reviewed.push(id);
    });
  }
  async enablePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window))
      throw new Error(
        "On iPhone, add Winnie to your Home Screen in Safari, then open it there to enable notifications.",
      );
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw new Error(
        "Notifications are off. You can enable them in your phone settings.",
      );
    const registration = await navigator.serviceWorker.ready,
      { publicKey } = await this.request("push-key");
    const key = Uint8Array.from(
      atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }));
    await this.request("subscription", {
      method: "POST",
      value: { subscription: subscription.toJSON() },
    });
    await this.refresh();
  }
  async pushState() {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in globalThis &&
      "Notification" in globalThis;
    const registration = supported
      ? await navigator.serviceWorker.getRegistration()
      : null;
    const local = !!(await registration?.pushManager.getSubscription());
    const id = this.session?.token.split(".")[0];
    const server = !!this.data.snapshot.devices?.find(
      (d) => d.id === id && !d.revoked,
    )?.notifications;
    return notificationState({
      supported,
      local,
      server,
      permission: globalThis.Notification?.permission,
    });
  }
  async disablePush() {
    await this.request("subscription", {
      method: "POST",
      value: { subscription: null },
    });
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
    await this.refresh();
  }
}
