import { getStore } from '@netlify/blobs';

const SCHEMA_VERSION = 3;
const EMPTY = { events: [], schemaVersion: SCHEMA_VERSION };

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const key = (url.searchParams.get('key') || '').trim();
  if (!key) return json({ error: 'missing key' }, 400);

  const store = getStore('winnie');

  if (req.method === 'GET') {
    const data = await store.get(key, { type: 'json' });
    return json(data || EMPTY);
  }

  if (req.method === 'PUT') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
    if (!body || !Array.isArray(body.events)) {
      return json({ error: 'body must include events array' }, 400);
    }
    await store.setJSON(key, {
      events: body.events,
      schemaVersion: body.schemaVersion || SCHEMA_VERSION
    });
    return json({ ok: true, count: body.events.length });
  }

  return json({ error: 'method not allowed' }, 405);
};
