import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { handleRequest } from "../cloudflare/src/index.js";
import { cleanWorkAlerts } from "../cloudflare/src/work-alerts.js";
import { ORIGIN, createCtx, createFakeEnv } from "./support/fake-cloudflare.mjs";

const require = createRequire(import.meta.url);
const Store = require("../landing/planner-store.js"), Model = require("../landing/planner-model.js");
const uuid = n => `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const preferences = () => ({ version: 1, timeZone: "America/Los_Angeles",
  alarm: { enabled: true, mode: "work", at: null, sound: "gentle", snoozeMinutes: 5 },
  notification: { enabled: true, mode: "alarm", at: null } });
function memoryStorage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
function app() {
  const fixture = createFakeEnv(), ctx = createCtx();
  async function call(route, { method = "GET", cookie, body } = {}) {
    const headers = { Origin: ORIGIN };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await handleRequest(new Request(ORIGIN + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), fixture.env, ctx);
    await ctx.settle();
    return { response, status: response.status, data: await response.clone().json() };
  }
  async function account(email) {
    const result = await call("/api/auth/sign-up", { method: "POST", body: { email, password: "fixture account password" } });
    assert.equal(result.status, 201);
    return { cookie: result.response.headers.get("set-cookie").split(";")[0], user: result.data.user };
  }
  return { ...fixture, ctx, call, account };
}
function browser(app, { storage = memoryStorage(), jar = { value: null }, legacy = false, before = async () => {}, after = async () => {}, WebSocketImpl = null } = {}) {
  const requests = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input, ORIGIN), method = init.method || "GET";
    const body = init.body === undefined ? undefined : JSON.parse(init.body);
    const cookieAtStart = jar.value;
    requests.push({ path: url.pathname, method, body });
    await before({ path: url.pathname, method, body });
    const result = await app.call(url.pathname, { method, cookie: cookieAtStart, body });
    await after({ path: url.pathname, method, body, result });
    const cookie = result.response.headers.get("set-cookie");
    if (cookie?.startsWith("duckplan_session=")) jar.value = cookie.includes("Max-Age=0") ? null : cookie.split(";")[0];
    if (legacy && url.pathname === "/api/planner" && result.status === 200) {
      delete result.data.work_alerts_supported;
      result.data.items.forEach(row => delete row.work_alerts);
      return new Response(JSON.stringify(result.data), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return result.response;
  };
  const store = Store.createPlannerStore({ storage, model: Model, defaultClasses: () => [], defaultTasks: () => [], config: { apiUrl: "/api" },
    fetchImpl, WebSocketImpl, locationRef: { href: ORIGIN + "/" }, documentRef: null, historyRef: null });
  return { store, requests, storage, jar };
}

test("work alert JSON roundtrips locally, through rows and import fingerprints without activating legacy tasks", async () => {
  const storage = memoryStorage(), options = { storage, model: Model, defaultClasses: () => [], defaultTasks: () => [{ id: "legacy", title: "Legacy", scheduledStart: "2026-11-15T09:00" }] };
  const store = Store.createPlannerStore(options); await store.init();
  assert.equal(store.supportsWorkAlerts, true);
  assert.equal(store.listItems()[0].workAlerts, undefined);
  const prefs = preferences();
  const saved = await store.upsertItem({ id: "copy", title: "Work", workAlerts: prefs });
  assert.deepEqual(Store.rowToTask(Store.taskToRow(saved)).workAlerts, prefs);
  const reloaded = Store.createPlannerStore(options); await reloaded.init();
  assert.deepEqual(reloaded.listItems().find(t => t.id === "copy").workAlerts, prefs);
  const local = { tasks: [saved], classes: [], templates: [], resources: [], goals: [], habits: [], habitCheckins: [], notes: [] };
  const first = await Store.localImportFingerprint(local);
  const changed = structuredClone(local); changed.tasks[0].workAlerts.notification.enabled = false;
  assert.notEqual(await Store.localImportFingerprint(changed), first);
  const plan = Store.planLocalImport({ localTasks: [saved], localClasses: [], cloudClasses: [], makeId: () => uuid(4) });
  assert.deepEqual(JSON.parse(plan.itemRows[0].work_alerts), prefs);
});

test("work alert validation enforces explicit modes, complete manual times and server/client parity", () => {
  const valid = preferences();
  assert.deepEqual(cleanWorkAlerts(valid), Store.normalizeWorkAlerts(valid));
  const manual = structuredClone(valid); manual.alarm.mode = "manual"; manual.alarm.at = "2028-02-29T23:55";
  manual.notification.mode = "manual"; manual.notification.at = "2028-02-29T00:00";
  assert.deepEqual(cleanWorkAlerts(JSON.stringify(manual)), Store.normalizeWorkAlerts(manual));
  for (const mutate of [
    p => { p.version = 2; }, p => { p.timeZone = "Unknown/Clock"; }, p => { p.extra = true; }, p => { p.alarm.enabled = 1; },
    p => { p.alarm.at = "2026-11-15T09:00"; }, p => { p.alarm.mode = "manual"; }, p => { p.alarm.sound = "loud"; },
    p => { p.alarm.snoozeMinutes = 1; }, p => { p.notification.mode = "work"; }, p => { p.notification.mode = "manual"; p.notification.at = "2026-02-30T12:00"; },
    p => { p.notification.mode = "manual"; p.notification.at = "2026-11-15T24:00"; }, p => { delete p.alarm.enabled; },
  ]) {
    const invalid = structuredClone(valid); mutate(invalid);
    assert.throws(() => cleanWorkAlerts(invalid)); assert.throws(() => Store.normalizeWorkAlerts(invalid));
  }
  manual.alarm.enabled = false; manual.alarm.at = null;
  assert.deepEqual(cleanWorkAlerts(manual), Store.normalizeWorkAlerts(manual), "a disabled manual channel can retain an empty draft");
});

test("the API preserves alert settings across old-client edits/completion, scopes ownership, and supports explicit clearing", async () => {
  const fixture = app(), a = await fixture.account("alerts-a@example.test"), b = await fixture.account("alerts-b@example.test");
  const path = `/api/items/${uuid(1)}`, prefs = preferences();
  const result = await fixture.call(path, { method: "PUT", cookie: a.cookie, body: { title: "Plan", scheduled_start: "2026-11-15T09:00", work_alerts: prefs } });
  assert.equal(result.status, 200); assert.deepEqual(JSON.parse(result.data.item.work_alerts), prefs);
  assert.equal(result.data.item.user_id, a.user.id);
  assert.equal((await fixture.call(path, { method: "PUT", cookie: b.cookie, body: { title: "Hijack", work_alerts: prefs } })).status, 404);
  const older = await fixture.call(path, { method: "PUT", cookie: a.cookie, body: { title: "Older client", scheduled_start: "2026-11-16T09:00" } });
  assert.deepEqual(JSON.parse(older.data.item.work_alerts), prefs);
  const done = await fixture.call(path, { method: "PATCH", cookie: a.cookie, body: { completed: true } });
  assert.deepEqual(JSON.parse(done.data.item.work_alerts), prefs);
  const snapshot = (await fixture.call("/api/planner", { cookie: a.cookie })).data;
  assert.equal(snapshot.work_alerts_supported, true); assert.deepEqual(JSON.parse(snapshot.items[0].work_alerts), prefs);
  assert.equal((await fixture.call(path, { method: "PUT", cookie: a.cookie, body: { title: "Clear", work_alerts: null } })).data.item.work_alerts, null);
  assert.throws(() => fixture.env.DB.raw.prepare("UPDATE items SET work_alerts='bad json' WHERE id=?").run(uuid(1)), /CHECK constraint/);
});

test("import retains work alert JSON atomically and rejects invalid preferences without inserting any rows", async () => {
  const fixture = app(), { cookie } = await fixture.account("alerts-import@example.test"), prefs = preferences();
  const saved = await fixture.call("/api/import", { method: "POST", cookie, body: { itemRows: [{ id: uuid(2), title: "Import", work_alerts: JSON.stringify(prefs) }] } });
  assert.equal(saved.status, 200);
  assert.deepEqual(JSON.parse((await fixture.call("/api/planner", { cookie })).data.items[0].work_alerts), prefs);
  const failed = await fixture.call("/api/import", { method: "POST", cookie, body: { itemRows: [{ id: uuid(3), title: "Good" }, { id: uuid(4), title: "Invalid", work_alerts: { ...prefs, version: 999 } }] } });
  assert.equal(failed.status, 400); assert.equal((await fixture.call("/api/planner", { cookie })).data.items.length, 1);
});

test("capable cloud stores sync alert JSON while old servers retain it only in owner-scoped device extras", async () => {
  const fixture = app(), a = await fixture.account("alerts-store-a@example.test"), b = await fixture.account("alerts-store-b@example.test");
  const capable = browser(fixture, { jar: { value: a.cookie } }); await capable.store.init();
  assert.equal(capable.store.supportsWorkAlerts, true);
  const prefs = preferences(); await capable.store.upsertItem({ id: uuid(10), title: "Cloud", workAlerts: prefs });
  assert.deepEqual(JSON.parse(fixture.env.DB.raw.prepare("SELECT work_alerts FROM items WHERE id=?").get(uuid(10)).work_alerts), prefs);
  const legacy = browser(fixture, { jar: { value: a.cookie }, legacy: true }); await legacy.store.init();
  assert.equal(legacy.store.supportsWorkAlerts, false);
  const localPrefs = preferences(); localPrefs.notification.enabled = false;
  const task = await legacy.store.upsertItem({ id: uuid(11), title: "Device only", workAlerts: localPrefs });
  assert.equal(task.workAlertsDeviceOnly, true);
  const request = legacy.requests.findLast(r => r.method === "PUT"); assert.equal(Object.hasOwn(request.body, "work_alerts"), false);
  assert.equal(fixture.env.DB.raw.prepare("SELECT work_alerts FROM items WHERE id=?").get(uuid(11)).work_alerts, null);
  const reopen = browser(fixture, { storage: legacy.storage, jar: { value: a.cookie }, legacy: true }); await reopen.store.init();
  assert.deepEqual(reopen.store.listItems().find(t => t.id === uuid(11)).workAlerts, localPrefs);
  assert.equal(reopen.store.listItems().find(t => t.id === uuid(11)).workAlertsDeviceOnly, true);
  const other = browser(fixture, { storage: legacy.storage, jar: { value: b.cookie }, legacy: true }); await other.store.init();
  assert.equal(other.store.listItems().length, 0);
  const upgraded = browser(fixture, { storage: legacy.storage, jar: { value: a.cookie } }); await upgraded.store.init();
  const pending = upgraded.store.listItems().find(t => t.id === uuid(11)); assert.equal(pending.workAlertsDeviceOnly, true);
  await upgraded.store.upsertItem(pending); await upgraded.store.refresh();
  assert.deepEqual(upgraded.store.listItems().find(t => t.id === uuid(11)).workAlerts, localPrefs);
  assert.equal(upgraded.store.listItems().find(t => t.id === uuid(11)).workAlertsDeviceOnly, undefined);
});

test("an old-server live echo before response commit retains device-only preferences without replacing canonical task fields", async () => {
  const fixture = app(), a = await fixture.account("alerts-live-echo@example.test");
  let socket;
  class LiveSocket { constructor() { socket = this; } close() {} }
  const old = browser(fixture, { jar: { value: a.cookie }, legacy: true, WebSocketImpl: LiveSocket,
    after: ({ method, result }) => {
      if (method !== "PUT") return;
      const row = { ...result.data.item, title: "Canonical live title" }; delete row.work_alerts;
      socket.onmessage({ data: JSON.stringify({ table: "items", row }) });
    } });
  await old.store.init();
  const prefs = preferences();
  await old.store.upsertItem({ id: uuid(12), title: "Draft title", workAlerts: prefs });
  const saved = old.store.listItems().find(t => t.id === uuid(12));
  assert.deepEqual(saved.workAlerts, prefs);
  assert.equal(saved.workAlertsDeviceOnly, true);
  assert.equal(saved.title, "Canonical live title", "metadata recovery must preserve the server's live row fields");
  await old.store.refresh();
  assert.deepEqual(old.store.listItems().find(t => t.id === uuid(12)).workAlerts, prefs);
});

test("old-server failed saves do not persist new preferences and unsupported imports preserve local data", async () => {
  const fixture = app(), a = await fixture.account("alerts-failure@example.test"); let fail = false;
  const legacy = browser(fixture, { jar: { value: a.cookie }, legacy: true, before: async r => { if (fail && r.method === "PUT") throw new Error("offline"); } }); await legacy.store.init();
  const first = preferences(); await legacy.store.upsertItem({ id: uuid(20), title: "First", workAlerts: first });
  const next = preferences(); next.alarm.enabled = false; fail = true;
  await assert.rejects(legacy.store.upsertItem({ id: uuid(20), title: "Failed", workAlerts: next }), /reach DuckPlan/);
  fail = false;
  const reopen = browser(fixture, { storage: legacy.storage, jar: { value: a.cookie }, legacy: true }); await reopen.store.init();
  assert.deepEqual(reopen.store.listItems().find(t => t.id === uuid(20)).workAlerts, first);
  const local = Store.createPlannerStore({ storage: legacy.storage, model: Model, defaultClasses: () => [], defaultTasks: () => [] }); await local.init();
  await local.upsertItem({ title: "Private local", workAlerts: first });
  await assert.rejects(reopen.store.importLocalTasks(), /can't import.*work alarm/);
  assert.equal((await fixture.call("/api/planner", { cookie: a.cookie })).data.items.length, 1);
  const localReload = Store.createPlannerStore({ storage: legacy.storage, model: Model, defaultClasses: () => [], defaultTasks: () => [] }); await localReload.init();
  assert.deepEqual(localReload.listItems()[0].workAlerts, first);
});

test("out-of-order old-server saves keep the latest committed preferences and never hydrate them into another owner", async () => {
  const fixture = app(), a = await fixture.account("alerts-order-a@example.test"), b = await fixture.account("alerts-order-b@example.test");
  const pending = [];
  const legacy = browser(fixture, { jar: { value: a.cookie }, legacy: true, before: r => r.method === "PUT" ? new Promise(resolve => pending.push(resolve)) : Promise.resolve() }); await legacy.store.init();
  const older = preferences(), newer = preferences(); newer.notification.enabled = false;
  const first = legacy.store.upsertItem({ id: uuid(30), title: "Older", workAlerts: older });
  const second = legacy.store.upsertItem({ id: uuid(30), title: "Newer", workAlerts: newer });
  pending[1](); await second; pending[0](); await first;
  const reopened = browser(fixture, { storage: legacy.storage, jar: { value: a.cookie }, legacy: true }); await reopened.store.init();
  assert.deepEqual(reopened.store.listItems().find(t => t.id === uuid(30)).workAlerts, newer);
  const late = reopened.store.upsertItem({ id: uuid(31), title: "Committed for A", workAlerts: older });
  await late;
  const other = browser(fixture, { storage: legacy.storage, jar: { value: b.cookie }, legacy: true }); await other.store.init();
  assert.equal(other.store.listItems().length, 0);
});

test("an old-owner save retains fallback only for its captured account after sign-out", async () => {
  const fixture = app(), a = await fixture.account("alerts-switch-a@example.test"); let finish;
  const legacy = browser(fixture, { jar: { value: a.cookie }, legacy: true, after: r => r.method === "PUT" ? new Promise(resolve => { finish = resolve; }) : Promise.resolve() }); await legacy.store.init();
  const prefs = preferences();
  const pending = legacy.store.upsertItem({ id: uuid(40), title: "A pending", workAlerts: prefs });
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  await legacy.store.signOut();
  finish(); await pending;
  assert.equal(legacy.store.mode, "local"); assert.equal(legacy.store.listItems().length, 0);
  // Sign-out invalidates the previous cookie; a normal sign-in obtains the next session.
  await legacy.store.signIn("alerts-switch-a@example.test", "fixture account password");
  assert.deepEqual(legacy.store.listItems().find(t => t.id === uuid(40)).workAlerts, prefs);
});

test("old-server storage failures prevent an unpersistable preference save without blocking capable cloud saves", async () => {
  const fixture = app(), a = await fixture.account("alerts-quota@example.test"), storage = memoryStorage();
  const write = storage.setItem; storage.setItem = (key, value) => { if (key.includes(":work-alerts:")) throw new Error("quota"); write(key, value); };
  const old = browser(fixture, { storage, jar: { value: a.cookie }, legacy: true }); await old.store.init();
  await assert.rejects(old.store.upsertItem({ id: uuid(50), title: "No space", workAlerts: preferences() }), /couldn't save the alert settings/);
  assert.equal(old.requests.some(r => r.method === "PUT"), false);
  assert.equal(old.store.listItems().length, 0);
  const current = browser(fixture, { storage, jar: { value: a.cookie } }); await current.store.init();
  await current.store.upsertItem({ id: uuid(51), title: "Cloud persists", workAlerts: preferences() });
  assert.deepEqual(JSON.parse(fixture.env.DB.raw.prepare("SELECT work_alerts FROM items WHERE id=?").get(uuid(51)).work_alerts), preferences());
});

test("a device-cache failure after task commit reports the saved identity so retry cannot duplicate the task", async () => {
  const fixture = app(), a = await fixture.account("alerts-partial@example.test"), storage = memoryStorage();
  let fail = true;
  const write = storage.setItem; storage.setItem = (key, value) => { if (fail && key.includes(":work-alerts:") && !key.endsWith(":check")) throw new Error("quota changed"); write(key, value); };
  const old = browser(fixture, { storage, jar: { value: a.cookie }, legacy: true }); await old.store.init();
  let partial;
  try { await old.store.upsertItem({ title: "Task survives", workAlerts: preferences() }); }
  catch (error) { partial = error; }
  assert.equal(partial.taskSaved, true); assert.match(partial.message, /^Task saved, but/);
  assert.match(partial.savedTask.id, /^[0-9a-f-]{36}$/);
  assert.equal(fixture.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM items").get().n, 1);
  fail = false;
  await old.store.upsertItem(partial.savedTask);
  assert.equal(fixture.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM items").get().n, 1);
  const reopened = browser(fixture, { storage, jar: { value: a.cookie }, legacy: true }); await reopened.store.init();
  assert.deepEqual(reopened.store.listItems()[0].workAlerts, preferences());
});
