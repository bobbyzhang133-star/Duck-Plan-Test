const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function fixture(offline = false) {
  const stored = new Map([["https://duckplan.test/app.js", new Response("old startup")]]);
  let requests = 0;
  const cache = {
    async match(request, options = {}) {
      const url = new URL(request.url);
      const key = options.ignoreSearch ? `${url.origin}${url.pathname}` : url.href;
      return stored.get(key)?.clone();
    },
    async put(request, response) { stored.set(request.url, response); },
  };
  const context = vm.createContext({
    self: { addEventListener() {} }, URL,
    caches: { async open() { return cache; } },
    async fetch() {
      requests += 1;
      if (offline) throw new Error("Offline");
      return new Response("calendar startup");
    },
  });
  vm.runInContext(fs.readFileSync("landing/service-worker.js", "utf8"), context);
  return { context, stored, requests: () => requests };
}

test("a new script version fetches updated startup code instead of matching the old base entry", async () => {
  const { context, stored, requests } = fixture();
  context.request = new Request("https://duckplan.test/app.js?v=calendar-home");
  const response = await vm.runInContext("cacheFirst(request)", context);
  assert.equal(await response.text(), "calendar startup");
  assert.equal(requests(), 1);
  assert.equal(await stored.get(context.request.url).clone().text(), "calendar startup");
});

test("an uncached script version can still use the precached shell when offline", async () => {
  const { context, requests } = fixture(true);
  context.request = new Request("https://duckplan.test/app.js?v=calendar-home");
  const response = await vm.runInContext("cacheFirst(request)", context);
  assert.equal(await response.text(), "old startup");
  assert.equal(requests(), 1);
});
