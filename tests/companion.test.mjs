import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("every declared icon has the correct raster dimensions and keeps app identity", () => {
  const manifest = JSON.parse(fs.readFileSync("public/manifest.json", "utf8"));
  assert.equal(manifest.start_url, ".");
  for (const icon of manifest.icons) {
    const png = fs.readFileSync("public/" + icon.src),
      [w, h] = icon.sizes.split("x").map(Number);
    assert.equal(png.readUInt32BE(16), w);
    assert.equal(png.readUInt32BE(20), h);
    assert.equal(icon.purpose, "any maskable");
  }
  for (const size of [32, 180]) {
    const png = fs.readFileSync(`public/icons/winnie-v2-${size}.png`);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const sprite = fs.readFileSync("public/photos/winnie-pixel-v2.png");
  assert.equal(sprite.readUInt32BE(16) / 3, sprite.readUInt32BE(20) / 2);
});

test("blink and wandering stop for sleep, editing, and reduced-motion preferences", async (t) => {
  const { createWinnieCompanion } = await import("../public/companion.js");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(Math, "random", () => 0.5);
  const saved = new Map(),
    listeners = new Map(),
    classes = new Set();
  let editing = false;
  const media = {
    matches: false,
    addEventListener: (_n, fn) => listeners.set("motion", fn),
    removeEventListener() {},
  };
  const button = {
    style: {},
    dataset: {},
    hidden: false,
    offsetWidth: 64,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    },
    matches: () => false,
    contains: () => false,
    setAttribute() {},
    getBoundingClientRect: () => ({ left: 20, top: 200 }),
    addEventListener() {},
    removeEventListener() {},
  };
  const doc = {
    body: {},
    hidden: false,
    activeElement: { matches: () => editing },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener() {},
  };
  const env = {
    document: doc,
    matchMedia: () => media,
    innerWidth: 390,
    innerHeight: 844,
    scrollX: 0,
    scrollY: 0,
    requestAnimationFrame: (fn) => {
      fn();
      return 1;
    },
    cancelAnimationFrame() {},
    addEventListener() {},
    removeEventListener() {},
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  };
  for (const [key, value] of Object.entries(env)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  }
  let companion;
  try {
    companion = createWinnieCompanion(button);
    t.mock.timers.tick(1800);
    assert(classes.has("blinking"));
    t.mock.timers.tick(150);
    assert(!classes.has("blinking"));
    t.mock.timers.tick(3050);
    assert(classes.has("walking"));
    companion.setSleeping(true);
    assert(!classes.has("walking"));
    assert.equal(button.dataset.state, "sleeping");
    t.mock.timers.tick(20000);
    assert(!classes.has("blinking"));
    assert(!classes.has("walking"));
    companion.setSleeping(false);
    editing = true;
    t.mock.timers.tick(20000);
    assert(!classes.has("walking"));
    editing = false;
    media.matches = true;
    listeners.get("motion")();
    t.mock.timers.tick(20000);
    assert(!classes.has("walking"));
    assert(!classes.has("blinking"));
  } finally {
    companion?.destroy();
    for (const [key, descriptor] of saved)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  }
});
