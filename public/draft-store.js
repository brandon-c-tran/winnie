// Device-local unfinished work. Never part of the shared household log.
export function createDraftStore(storage = indexedDB) {
  let opening;
  let writes = Promise.resolve();
  // ArrayBuffer storage also works in WebKit builds that cannot persist Blob.
  async function encode(value) {
    if (value instanceof Blob)
      return {
        draftBlob: true,
        type: value.type,
        bytes: await value.arrayBuffer(),
      };
    if (Array.isArray(value)) return Promise.all(value.map(encode));
    if (value && typeof value === "object")
      return Object.fromEntries(
        await Promise.all(
          Object.entries(value).map(async ([key, item]) => [
            key,
            await encode(item),
          ]),
        ),
      );
    return value;
  }
  function decode(value) {
    if (value?.draftBlob === true && value.bytes instanceof ArrayBuffer)
      return new Blob([value.bytes], { type: value.type });
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, decode(item)]),
      );
    return value;
  }
  function write(action) {
    const next = writes.then(action);
    writes = next.catch(() => {});
    return next;
  }
  const db = () =>
    (opening ||= new Promise((resolve, reject) => {
      const request = storage.open("winnie-drafts", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("drafts", { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  async function run(mode, action) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction("drafts", mode);
      const request = action(tx.objectStore("drafts"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () =>
        reject(tx.error || Error("Draft could not be saved."));
    });
  }
  return {
    put: (value) =>
      write(async () => {
        const saved = await encode(value);
        return run("readwrite", (store) => store.put(saved));
      }),
    remove: (key) =>
      write(() => run("readwrite", (store) => store.delete(key))),
    list: (home) =>
      writes
        .then(() => run("readonly", (store) => store.getAll()))
        .then((rows) => rows.filter((row) => row.home === home).map(decode)),
  };
}
