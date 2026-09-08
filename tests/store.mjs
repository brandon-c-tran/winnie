import { hash } from "../netlify/lib/core.mjs";
export class MemoryStore {
  rows = new Map();
  fail = null;
  async get(key, { type = "json" } = {}) {
    const row = this.rows.get(key);
    if (!row) return null;
    return type === "json"
      ? JSON.parse(row.bytes.toString())
      : type === "arrayBuffer"
        ? new Uint8Array(row.bytes).buffer
        : row.bytes.toString();
  }
  async getWithMetadata(key, options = {}) {
    const row = this.rows.get(key);
    if (!row) return null;
    return {
      data: await this.get(key, options),
      etag: row.etag,
      metadata: structuredClone(row.metadata),
    };
  }
  async getMetadata(key) {
    const row = this.rows.get(key);
    return row
      ? { etag: row.etag, metadata: structuredClone(row.metadata) }
      : null;
  }
  async setJSON(key, value, options = {}) {
    return this.set(key, Buffer.from(JSON.stringify(value)), options);
  }
  async set(key, value, options = {}) {
    if (this.fail) throw new Error(this.fail);
    const old = this.rows.get(key);
    if (
      (options.onlyIfNew && old) ||
      (options.onlyIfMatch && old?.etag !== options.onlyIfMatch)
    )
      return { modified: false };
    const bytes = Buffer.from(value),
      etag = hash(bytes);
    this.rows.set(key, { bytes, etag, metadata: options.metadata || {} });
    return { modified: true, etag };
  }
  async list({ prefix = "" } = {}) {
    return {
      blobs: [...this.rows.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
      directories: [],
    };
  }
}
