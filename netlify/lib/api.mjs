import {
  assert,
  Fault,
  hash,
  stable,
  migrate,
  snapshot,
  authenticate,
  applyCommand,
  transact,
  validId,
} from "./core.mjs";
import { pushKeys, dispatch } from "./push.mjs";
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function body(req, max = 50000) {
  const text = await req.text();
  assert(Buffer.byteLength(text) <= max, "This request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new Fault(400, "Invalid request.");
  }
}
function mediaType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  throw new Fault(415, "Choose a JPEG, PNG, or WebP photo.");
}
export function createHandler(getStores, { runDispatch = dispatch } = {}) {
  return async (req) => {
    try {
      const url = new URL(req.url),
        action = url.searchParams.get("action") || "snapshot";
      assert(
        !req.headers.get("origin") || req.headers.get("origin") === url.origin,
        "This request must come from Winnie.",
        403,
      );
      const { main, legacy, photos, backup } = getStores(req);
      if (action === "pair" && req.method === "POST") {
        const { code, person, deviceId, secret, name } = await body(req);
        assert(
          typeof code === "string" && /^[a-zA-Z0-9_-]{12,100}$/.test(code),
          "Enter your existing shared code.",
        );
        assert(
          ["brandon", "kim"].includes(person) &&
            validId(deviceId) &&
            typeof secret === "string" &&
            /^[a-zA-Z0-9_-]{40,100}$/.test(secret),
          "Choose who is using this device.",
        );
        const home = hash(code),
          key = `home/${home}`;
        let doc = await main.get(key, { type: "json" });
        if (!doc) {
          let raw = await legacy.get(code, { type: "json" });
          if (
            !raw &&
            url.hostname !== "winniecavapoo.netlify.app" &&
            code === "winnie-preview-demo"
          ) {
            raw = {
              schemaVersion: 3,
              events: [
                {
                  id: "preview-pee",
                  type: "pee",
                  time: Date.now() - 3600000,
                  who: "us",
                  note: "Preview example",
                  tags: [],
                },
              ],
            };
            await legacy.setJSON(code, raw, { onlyIfNew: true });
          }
          assert(
            raw && Array.isArray(raw.events),
            "No existing log was found for that code. Please check it.",
            404,
          );
          const digest = hash(stable(raw));
          await backup.setJSON(`migration/${home}/${digest}`, raw, {
            onlyIfNew: true,
          });
          const saved = await backup.get(`migration/${home}/${digest}`, {
            type: "json",
          });
          assert(
            hash(stable(saved)) === digest,
            "The history backup could not be verified. Nothing was migrated.",
            503,
          );
          await main.setJSON(key, migrate(raw), { onlyIfNew: true });
        }
        const result = await transact(main, key, (d) => {
          const previous = d.devices[deviceId];
          assert(
            !previous ||
              (previous.tokenHash === hash(secret) && !previous.revoked),
            "This device needs a fresh connection.",
            401,
          );
          assert(
            previous ||
              Object.values(d.devices).filter((x) => !x.revoked).length < 30,
            "Remove an old device before connecting another.",
          );
          assert(
            !previous || previous.person === person,
            "Reconnect to change the person on this device.",
            409,
          );
          d.devices[deviceId] = previous || {
            id: deviceId,
            person,
            tokenHash: hash(secret),
            name: String(name || "Phone").slice(0, 60),
            created: Date.now(),
          };
          if (!previous) d.revision++;
          return {};
        });
        return json({
          home,
          token: `${deviceId}.${secret}`,
          person,
          ...snapshot(result.doc),
        });
      }
      const home = req.headers.get("X-Winnie-Home");
      assert(
        home && /^[a-f0-9]{64}$/.test(home),
        "Reconnect to your shared log.",
        401,
      );
      const key = `home/${home}`,
        token = (req.headers.get("Authorization") || "").replace(
          /^Bearer /,
          "",
        );
      const doc = await main.get(key, { type: "json" });
      assert(doc, "Shared log not found.", 404);
      const device = authenticate(doc, token);
      if (action === "snapshot" && req.method === "GET") {
        if (url.searchParams.get("revision") === String(doc.revision))
          return json({ unchanged: true, revision: doc.revision });
        return json(snapshot(doc));
      }
      if (action === "command" && req.method === "POST") {
        const command = await body(req, 2000000);
        if (command.kind === "attach") {
          assert(validId(command.payload?.photoId), "Invalid photo.");
          assert(
            await photos.getMetadata(`${home}/${command.payload.photoId}`),
            "Your photo is still uploading. Retry shortly.",
            409,
          );
        }
        const result = await transact(main, key, (d) =>
          applyCommand(d, command, authenticate(d, token)),
        );
        try {
          await runDispatch(main, key, { limit: 3 });
        } catch {
          /* Durable jobs remain for the sweep. */
        }
        return json({ receipt: result.receipt, ...snapshot(result.doc) });
      }
      if (action === "photo" && req.method === "PUT") {
        const id = url.searchParams.get("id");
        assert(validId(id), "Invalid photo ID.");
        const bytes = Buffer.from(await req.arrayBuffer());
        assert(
          bytes.length > 12 && bytes.length <= 2500000,
          "Choose a photo smaller than 2.5 MB.",
          413,
        );
        const type = mediaType(bytes),
          digest = hash(bytes),
          photoKey = `${home}/${id}`;
        const existing = await photos.getMetadata(photoKey);
        if (existing) {
          assert(
            existing.metadata.sha256 === digest,
            "A different photo already uses this ID.",
            409,
          );
          return json({ id });
        }
        const result = await photos.set(photoKey, bytes, {
          onlyIfNew: true,
          metadata: {
            type,
            sha256: digest,
            createdAt: Date.now(),
            addedBy: device.person,
          },
        });
        if (!result.modified) {
          const current = await photos.getMetadata(photoKey);
          assert(
            current?.metadata.sha256 === digest,
            "A different photo already uses this ID.",
            409,
          );
        }
        return json({ id });
      }
      if (action === "photo" && req.method === "GET") {
        const id = url.searchParams.get("id");
        assert(validId(id), "Invalid photo ID.");
        assert(
          doc.events.some(
            (e) => !e.deletedAt && e.photos?.some((p) => p.id === id),
          ),
          "Photo not found.",
          404,
        );
        const row = await photos.getWithMetadata(`${home}/${id}`, {
          type: "arrayBuffer",
        });
        assert(row, "Photo not found.", 404);
        return new Response(row.data, {
          headers: {
            "Content-Type": row.metadata.type,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (action === "archive" && req.method === "POST") {
        const raw = await body(req, 4000000);
        assert(Array.isArray(raw.events), "Invalid device history.");
        const digest = hash(stable(raw));
        await backup.setJSON(`device/${home}/${device.id}/${digest}`, raw, {
          onlyIfNew: true,
        });
        return json({
          archived: true,
          sha256: digest,
          count: raw.events.length,
        });
      }
      if (action === "push-key" && req.method === "GET")
        return json({ publicKey: (await pushKeys(main)).publicKey });
      if (action === "subscription" && req.method === "POST") {
        const { subscription } = await body(req, 6000);
        if (subscription) {
          let endpoint;
          try {
            endpoint = new URL(subscription.endpoint);
          } catch {
            throw new Fault(400, "Invalid notification subscription.");
          }
          assert(
            endpoint.protocol === "https:" &&
              !endpoint.port &&
              !endpoint.username &&
              !endpoint.password &&
              /^(?:fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)*push\.apple\.com|(?:[a-z0-9-]+\.)*notify\.windows\.com)$/.test(
                endpoint.hostname,
              ),
            "This push provider is not supported.",
          );
          assert(
            typeof subscription.keys?.p256dh === "string" &&
              typeof subscription.keys?.auth === "string",
            "Invalid notification keys.",
          );
        }
        await transact(main, key, (d) => {
          const current = authenticate(d, token);
          if (subscription) current.subscription = subscription;
          else delete current.subscription;
          d.revision++;
          return {};
        });
        return json({ subscribed: !!subscription });
      }
      if (action === "revoke" && req.method === "POST") {
        const { deviceId } = await body(req);
        await transact(main, key, (d) => {
          authenticate(d, token);
          assert(d.devices[deviceId], "Device not found.", 404);
          d.devices[deviceId].revoked = Date.now();
          delete d.devices[deviceId].subscription;
          d.revision++;
          return {};
        });
        return json({ revoked: true });
      }
      if (action === "export" && req.method === "GET")
        return json({ ...snapshot(doc), exportedAt: new Date().toISOString() });
      throw new Fault(405, "This action is not supported.");
    } catch (err) {
      return json(
        {
          error: err.status
            ? err.message
            : "Could not reach the shared log. Your pending actions remain on this device.",
          ...err.detail,
        },
        err.status || 503,
      );
    }
  };
}
