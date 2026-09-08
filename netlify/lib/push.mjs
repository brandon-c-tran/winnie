import webpush from "web-push";
import { randomUUID } from "node:crypto";
import { transact } from "./core.mjs";
export async function pushKeys(store) {
  let keys = await store.get("config/vapid", { type: "json" });
  if (!keys) {
    await store.setJSON("config/vapid", webpush.generateVAPIDKeys(), {
      onlyIfNew: true,
    });
    keys = await store.get("config/vapid", { type: "json" });
  }
  if (!keys?.privateKey || !keys.publicKey)
    throw new Error("Notification setup is unavailable.");
  return keys;
}
export function notification(job) {
  const person = job.actor === "kim" ? "Kim" : "Brandon";
  const labels = {
    slumber: "sleep",
    nap: "sleep",
    pee: "a pee",
    poop: "a poop",
    meal: "a meal",
    photo: "a photo",
    moment: "a moment",
  };
  const date = new Date(job.time).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    title: `${person} ${job.action} ${labels[job.type] || job.type}`,
    body: date,
    tag: `winnie-${job.eventId}`,
    eventId: job.eventId,
    url: `/?event=${encodeURIComponent(job.eventId)}`,
  };
}
export async function dispatch(
  store,
  key,
  {
    send = webpush.sendNotification.bind(webpush),
    now = Date.now,
    limit = 8,
  } = {},
) {
  const keys = await pushKeys(store);
  for (let n = 0; n < limit; n++) {
    let claimed;
    const leaseId = randomUUID();
    await transact(store, key, (doc) => {
      claimed = undefined;
      const job = Object.values(doc.jobs).find(
        (j) =>
          j.status === "pending" &&
          j.nextAt <= now() &&
          (!j.leaseUntil || j.leaseUntil < now()),
      );
      if (!job) return { duplicate: true };
      const device = doc.devices[job.recipient];
      if (!device?.subscription || device.revoked) {
        job.status = "cancelled";
        return {};
      }
      job.leaseId = leaseId;
      job.leaseUntil = now() + 60000;
      job.attempts++;
      claimed = {
        job: structuredClone(job),
        subscription: device.subscription,
      };
      return {};
    });
    if (!claimed) break;
    let status = "sent",
      code = 0;
    try {
      await send(
        claimed.subscription,
        JSON.stringify(notification(claimed.job)),
        {
          TTL: 86400,
          timeout: 12000,
          vapidDetails: {
            subject: "https://winniecavapoo.netlify.app",
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
          },
        },
      );
    } catch (err) {
      code = err.statusCode || 0;
      status = [404, 410].includes(code) ? "expired" : "pending";
    }
    await transact(store, key, (doc) => {
      const job = doc.jobs[claimed.job.id];
      if (job?.leaseId !== leaseId) return { duplicate: true };
      job.status = status;
      job.lastCode = code;
      job.leaseUntil = 0;
      job.completedAt = status === "sent" ? now() : null;
      job.nextAt =
        now() + Math.min(3600000, 15000 * 2 ** Math.min(job.attempts, 8));
      if (
        status === "expired" &&
        JSON.stringify(doc.devices[job.recipient]?.subscription) ===
          JSON.stringify(claimed.subscription)
      )
        delete doc.devices[job.recipient].subscription;
      return {};
    });
  }
}
