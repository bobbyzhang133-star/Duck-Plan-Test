import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { handleRequest } from "../cloudflare/src/index.js";
import { createCtx, createFakeEnv } from "./support/fake-cloudflare.mjs";

const require = createRequire(import.meta.url);
const Store = require("../landing/planner-store.js");
const Model = require("../landing/planner-model.js");
const apiUrl = "https://duckplan.duckplan-cloudflare.workers.dev/api";
const transport = fs.readFileSync("landing/native-cloud.js", "utf8");
const config = fs.readFileSync("landing/cloud-config.js", "utf8");

function install(native, browserFetch = async () => new Response("browser")) {
  const window = { fetch: browserFetch, ...(native ? { DuckNativeCloud: native } : {}) };
  const context = { window, location: { href: "file:///app/landing/index.html" }, URL, Response };
  vm.runInNewContext(transport, context);
  vm.runInNewContext(config, context);
  return window;
}

test("ordinary browser copies stay local and retain their original fetch", () => {
  const fetch = () => {};
  const window = install(null, fetch);
  assert.equal(window.fetch, fetch);
  assert.equal(window.DUCKPLAN_CLOUD.apiUrl, "");
  assert.equal(window.DUCKPLAN_CLOUD.native, false);
});

test("native requests carry JSON through the bridge, retaining HTTP errors without exposing headers", async () => {
  const calls = [];
  const window = install({ apiUrl, async request(body) { calls.push(body); return { status: 401, body: '{"error":"Incorrect credentials"}' }; } });
  const response = await window.fetch(`${apiUrl}/auth/sign-in`, { method: "post", body: '{"email":"test@example.test"}' });
  assert.equal(response.status, 401);
  assert.equal(response.ok, false);
  assert.equal((await response.json()).error, "Incorrect credentials");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ url: `${apiUrl}/auth/sign-in`, method: "POST", body: '{"email":"test@example.test"}' }]);
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(window.DUCKPLAN_CLOUD.native, true);
});

test("relative API requests use the configured host and unrelated URLs retain browser fetch", async () => {
  const calls = [], browserCalls = [];
  const window = install({ apiUrl, async request(body) { calls.push(body); return { status: 200, body: "{}" }; } }, async (...args) => { browserCalls.push(args); return new Response("asset"); });
  await window.fetch("/api/axis/status");
  await window.fetch("./assets/duck.png");
  await window.fetch("https://unrelated.test/api/session");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${apiUrl}/axis/status`);
  assert.equal(browserCalls.length, 2);
});

test("bundled transport signs in, restores a session, saves tasks and signs out against the real Worker", async () => {
  const fake = createFakeEnv(), ctx = createCtx();
  let cookie = "";
  const native = { apiUrl, async request(body) {
    const response = await handleRequest(new Request(body.url, {
      method: body.method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      ...(body.body === undefined ? {} : { body: body.body }),
    }), fake.env, ctx);
    await ctx.settle();
    if (response.headers.has("Set-Cookie")) cookie = response.headers.get("Set-Cookie").split(";")[0];
    return { status: response.status, body: await response.text() };
  } };
  const storage = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }; };
  const window = install(native);
  const makeStore = () => Store.createPlannerStore({ storage: storage(), model: Model, defaultClasses: () => [], defaultTasks: () => [],
    config: window.DUCKPLAN_CLOUD, fetchImpl: window.fetch, WebSocketImpl: null });
  const store = makeStore();
  await store.init();
  assert.equal(store.configured, true);
  assert.equal(store.user, null);
  await store.signUp("native@duckplan.test", "native test password");
  const id = store.user.id;
  await store.signOut();
  await assert.rejects(store.signIn("native@duckplan.test", "incorrect password"), /password|match|incorrect/i);
  await store.signIn("native@duckplan.test", "native test password");
  assert.equal(store.user.id, id);
  const saved = await store.upsertItem({ title: "Native cloud task", classId: null, priority: "Medium", completed: false });
  const restored = makeStore();
  await restored.init();
  assert.equal(restored.user.id, id);
  assert.equal(restored.listItems()[0].id, saved.id);
  await restored.signOut();
  assert.equal(restored.user, null);
  const signedOut = makeStore();
  await signedOut.init();
  assert.equal(signedOut.user, null);
  await assert.rejects(signedOut.signInWithGoogle(), /email and password/);
});
