const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const Domain = require("../landing/reminder-domain.js");

const wallTime = "2026-12-15T09:00";
const tick = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function dom() {
  const nodes = new Map(), events = new Map();
  const document = { hidden: false, addEventListener(name, fn) { events.set(name, fn); }, querySelector(id) {
    if (!nodes.has(id)) nodes.set(id, { textContent: "", hidden: false, disabled: false, events: {}, addEventListener(name, fn) { this.events[name] = fn; } });
    return nodes.get(id);
  } };
  return { nodes, events, document };
}
function webSetup({ cloud = true, permission = "default", native = false, storage = new Map() } = {}) {
  const ui = dom(), calls = [], rows = new Map(), groups = new Map(), pending = {};
  let owner = "A", config = { available: true, publicKey: "AAAA" }, subscription = null, fail = null, requested = 0, unsubscribed = 0;
  const notification = { get permission() { return permission; }, async requestPermission() { requested += 1; if (permission !== "denied") permission = "granted"; return permission; } };
  const worker = { active: {}, pushManager: {
    async getSubscription() { return subscription; },
    async subscribe() { subscription = { endpoint: "https://push.example.test/device", async unsubscribe() { unsubscribed += 1; subscription = null; return true; } }; return subscription; },
  } };
  function ownerRows() { if (!groups.has(owner)) groups.set(owner, new Map()); return groups.get(owner); }
  async function fetch(url, options) {
    const method = options.method, body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ owner, method, url, body });
    const captured = ownerRows();
    if (fail && fail.method === method && url.startsWith(fail.url)) { const message = fail.message; fail = null; return { ok: false, async json() { return { error: message }; } }; }
    let data;
    if (url === "/api/push/config") data = { ...config };
    else if (url === "/api/alarms" && method === "GET") data = { alarms: [...captured.values()] };
    else if (url.startsWith("/api/alarms/") && method === "PUT") { const id = decodeURIComponent(url.split("/").at(-1)); const alarm = { item_id: id, fire_at: body.fireAt, time_zone: body.timeZone }; captured.set(id, alarm); data = { alarm }; }
    else if (url.startsWith("/api/alarms/") && method === "DELETE") { captured.delete(decodeURIComponent(url.split("/").at(-1))); data = { ok: true }; }
    else data = { ok: true };
    const hold = pending[`${method} ${url}`];
    if (hold) { delete pending[`${method} ${url}`]; hold.started.resolve(); await hold.release.promise; }
    return { ok: true, async json() { return data; } };
  }
  const capabilityEvents = [];
  const window = {
    DuckReminderDomain: Domain, DuckPlanApp: { ready: Promise.resolve(worker) }, DUCKPLAN_CLOUD: cloud ? { apiUrl: "/api" } : {}, Notification: notification,
    navigator: { serviceWorker: { getRegistration: async () => worker } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    dispatchEvent: event => capabilityEvents.push(event.type),
  };
  if (native) window.DuckNativeAlarms = {};
  vm.runInNewContext(fs.readFileSync("landing/task-alarms.js", "utf8"), { window, document: ui.document, fetch, atob, Uint8Array, Map, Set, Error, Event });
  return {
    ...ui, window, calls, api: window.DuckTaskNotifications, ringing: window.DuckTaskAlarms, rows, groups, capabilityEvents, storage,
    requests: () => requested, unsubscribed: () => unsubscribed,
    setOwner(value) { owner = value; }, setConfig(value) { config = value; },
    seed(user, id, at = 1) { if (!groups.has(user)) groups.set(user, new Map()); groups.get(user).set(id, { item_id: id, fire_at: at }); },
    fail(method, url, message) { fail = { method, url, message }; },
    hold(method, url) { const hold = { started: deferred(), release: deferred() }; pending[`${method} ${url}`] = hold; return hold; },
  };
}

test("ordinary web notifications are independent from an honest unavailable ringing-alarm provider", async () => {
  const f = webSetup();
  await f.api.setContext("cloud:A", [{ id: "task" }]);
  assert.equal(f.ringing.canSave(), false); assert.equal(f.ringing.available, false);
  assert.match(f.nodes.get("#task-alarm-status").textContent, /iPhone app/);
  assert.equal(f.api.canSave(), true); assert.equal(f.api.available, false);
  await f.api.save("task", wallTime, { timeZone: "UTC", scope: "cloud:A" });
  const save = f.calls.find(call => call.method === "PUT");
  assert.equal(save.url, "/api/alarms/task"); assert.equal(save.body.fireAt, Date.UTC(2026, 11, 15, 9));
  assert.equal(f.api.get("task").fire_at, save.body.fireAt);
  assert.equal(f.ringing.get("task"), undefined);
  await f.api.save("task", "", { scope: "cloud:A" });
  assert.equal(f.api.get("task"), undefined);
});

test("local Enable requests browser permission only from the click and preserves open-page availability semantics", async () => {
  const f = webSetup({ cloud: false });
  await f.api.setContext("local:local", [{ id: "task" }]);
  assert.equal(f.requests(), 0); assert.equal(f.api.canSave(), false); assert.equal(f.api.available, false);
  assert.equal(f.nodes.get("#enable-task-notifications").disabled, false);
  await f.nodes.get("#enable-task-notifications").events.click();
  assert.equal(f.requests(), 1); assert.equal(f.calls.length, 0);
  assert.match(f.nodes.get("#task-notification-status").textContent, /while this page is open/);
  assert.equal(f.nodes.get("#enable-task-notifications").hidden, true);
  await assert.rejects(f.api.save("task", wallTime), /open-page reminder/);
  assert.equal(f.api.get("task"), undefined);
});

test("a blocked or absent service worker cannot hold API refresh or task notification saves behind an unresolved ready promise", async () => {
  for (const worker of [undefined, { active: null, pushManager: {} }]) {
    const f = webSetup();
    f.window.DuckPlanApp.ready = new Promise(() => {});
    f.window.navigator.serviceWorker.getRegistration = async () => worker;
    let finished = false;
    const operation = (async () => {
      await f.api.setContext("cloud:A", [{ id: "task" }]);
      await f.api.refresh();
      await f.api.save("task", wallTime, { timeZone: "UTC", scope: "cloud:A" });
      finished = true;
    })();
    for (let i = 0; i < 120 && !finished; i += 1) await Promise.resolve();
    assert.equal(finished, true, "An unresolved DuckPlanApp.ready must never gate save/refresh");
    await operation;
    assert.equal(f.api.canSave(), true); assert.equal(f.api.available, false);
    assert.equal(f.api.get("task").fire_at, Date.UTC(2026, 11, 15, 9));
    await f.nodes.get("#enable-task-notifications").events.click();
    assert.match(f.nodes.get("#task-notification-status").textContent, /active service worker/);
    assert.equal(f.calls.filter(call => call.url === "/api/push/devices").length, 0);
  }
});

test("cloud enable registers the normal push device and failed registration unsubscribes it", async () => {
  const f = webSetup();
  await f.api.setContext("cloud:A", [{ id: "task" }]);
  await f.nodes.get("#enable-task-notifications").events.click();
  assert.equal(f.api.available, true);
  assert.ok(f.calls.some(call => call.url === "/api/push/devices" && call.method === "POST"));
  await f.api.detach();
  assert.equal(f.unsubscribed(), 1); assert.equal(f.api.get("task"), undefined);
  const failed = webSetup();
  await failed.api.setContext("cloud:A", [{ id: "task" }]);
  failed.fail("POST", "/api/push/devices", "Cannot register this device");
  await failed.nodes.get("#enable-task-notifications").events.click();
  assert.match(failed.nodes.get("#task-notification-status").textContent, /Cannot register/);
  assert.equal(failed.unsubscribed(), 1); assert.equal(failed.api.available, false);
});

test("an older subscription lookup cannot undo a newer successful device enable", async () => {
  const f = webSetup(), worker = await f.window.navigator.serviceWorker.getRegistration(), old = deferred();
  const original = worker.pushManager.getSubscription; let lookups = 0;
  worker.pushManager.getSubscription = () => ++lookups === 1 ? old.promise : original();
  await f.api.setContext("cloud:A", [{ id: "task" }]);
  await f.nodes.get("#enable-task-notifications").events.click(); await tick();
  assert.equal(f.api.available, true);
  old.resolve(null); await tick();
  assert.equal(f.api.available, true);
});

test("a device registration finishing after an account change is unsubscribed before the next account refresh", async () => {
  const f = webSetup();
  await f.api.setContext("cloud:A", [{ id: "task-a" }]);
  const pending = f.hold("POST", "/api/push/devices");
  const enable = f.nodes.get("#enable-task-notifications").events.click(); await pending.started.promise;
  f.setOwner("B"); const next = f.api.setContext("cloud:B", [{ id: "task-b" }]);
  pending.release.resolve(); await Promise.all([enable, next]);
  assert.equal(f.unsubscribed(), 1); assert.equal(f.api.available, false);
  assert.equal(f.api.get("task-a"), undefined);
  const denied = webSetup({ cloud: false, permission: "denied" });
  await denied.nodes.get("#enable-task-notifications").events.click();
  assert.equal(denied.nodes.get("#enable-task-notifications").disabled, true);
  assert.match(denied.nodes.get("#task-notification-status").textContent, /device settings/);
});

test("a failed ordinary notification save preserves the previous record and permits a real retry", async () => {
  const f = webSetup();
  f.seed("A", "task", 100);
  await f.api.setContext("cloud:A", [{ id: "task" }]);
  f.fail("PUT", "/api/alarms/task", "Try this notification again");
  await assert.rejects(f.api.save("task", wallTime, { timeZone: "UTC" }), /Try this notification again/);
  assert.equal(f.api.get("task").fire_at, 100);
  await f.api.save("task", wallTime, { timeZone: "UTC" });
  assert.equal(f.api.get("task").fire_at, Date.UTC(2026, 11, 15, 9));
  const before = f.calls.filter(call => call.method === "PUT").length;
  await assert.rejects(f.api.save("task", "2026-03-08T02:30", { timeZone: "America/Los_Angeles" }), /does not exist/);
  assert.equal(f.calls.filter(call => call.method === "PUT").length, before);
});

test("old-scope web refresh and save replies cannot populate or overwrite the next account", async () => {
  const f = webSetup(); f.seed("A", "task-a", 100); f.seed("B", "task-b", 200);
  await f.api.setContext("cloud:A", [{ id: "task-a" }]);
  const list = f.hold("GET", "/api/alarms");
  const refresh = f.api.refresh(); await list.started.promise;
  f.setOwner("B"); const change = f.api.setContext("cloud:B", [{ id: "task-b" }]);
  assert.equal(f.api.get("task-a"), undefined);
  list.release.resolve(); await Promise.all([refresh, change]);
  assert.equal(f.api.get("task-a"), undefined); assert.equal(f.api.get("task-b").fire_at, 200);
  f.setOwner("A"); await f.api.setContext("cloud:A", [{ id: "task-a" }]);
  const put = f.hold("PUT", "/api/alarms/task-a");
  const oldSave = f.api.save("task-a", wallTime, { timeZone: "UTC" }).catch(error => error); await put.started.promise;
  f.setOwner("B"); const next = f.api.setContext("cloud:B", [{ id: "task-b" }]);
  put.release.resolve(); const result = await oldSave; await next;
  assert.match(result.message, /context changed/);
  assert.equal(f.api.get("task-a"), undefined); assert.equal(f.api.get("task-b").fire_at, 200);
  await assert.rejects(f.api.save("task-a", wallTime, { scope: "cloud:A" }), /context changed/);
});

test("web task context removes completed notification records without touching active tasks", async () => {
  const f = webSetup(); f.seed("A", "active", 100); f.seed("A", "done", 200);
  await f.api.setContext("cloud:A", [{ id: "active" }, { id: "done" }]);
  await f.api.setContext("cloud:A", [{ id: "active" }, { id: "done", completed: true }]);
  assert.equal(f.api.get("done"), undefined); assert.equal(f.api.get("active").fire_at, 100);
  assert.ok(f.calls.some(call => call.method === "DELETE" && call.url === "/api/alarms/done"));
});

test("native hosts without the new banner bridge never fall back to browser push", async () => {
  const f = webSetup({ native: true });
  assert.equal(f.api.native, true); assert.equal(f.api.available, false); assert.equal(f.api.canSave(), false);
  await f.api.refresh(); await f.api.setContext("cloud:A", [{ id: "task" }]);
  assert.match(f.nodes.get("#task-notification-status").textContent, /Update the iPhone app/);
  await assert.rejects(f.api.save("task", wallTime), /Update the iPhone app/);
  assert.equal(f.calls.length, 0);
});

test("web device pause persists by owner, suppresses foreground fallback and resumes only on explicit Enable", async () => {
  const storage = new Map(), f = webSetup({ storage });
  await f.api.setContext("cloud:A", [{ id: "task" }]);
  await f.nodes.get("#enable-task-notifications").events.click();
  await f.nodes.get("#disable-task-notifications").events.click();
  assert.equal(f.api.foregroundEnabled, false); assert.equal(f.api.available, false);
  assert.equal(f.api.canSave(), true, "Server schedules can still serve another opted-in device");
  assert.equal(f.unsubscribed(), 1); assert.match(f.nodes.get("#task-notification-status").textContent, /paused on this device/);
  const restored = webSetup({ storage, permission: "granted" });
  await restored.api.setContext("cloud:A", [{ id: "task" }]); assert.equal(restored.api.foregroundEnabled, false);
  await restored.api.setContext("cloud:B", [{ id: "other" }]); assert.equal(restored.api.foregroundEnabled, true);
  const local = webSetup({ cloud: false, storage, permission: "granted" });
  await local.api.setContext("local", []); await local.nodes.get("#disable-task-notifications").events.click();
  assert.equal(local.api.foregroundEnabled, false);
  await local.nodes.get("#enable-task-notifications").events.click(); assert.equal(local.api.foregroundEnabled, true);
  assert.ok(local.capabilityEvents.every(type => type === "duckplan:work-alert-capability"));
  assert.ok(local.capabilityEvents.length >= 2);
});

function nativeSetup({ storage = new Map() } = {}) {
  const ui = dom(), calls = [], groups = new Map(), pending = {};
  let scope = "local", permission = "authorized", fail = null;
  function rows() { if (!groups.has(scope)) groups.set(scope, new Map()); return groups.get(scope); }
  const windowEvents = new Map();
  const capabilityEvents = [];
  const window = { DuckReminderDomain: Domain, DuckTaskAlarms: { native: true, marker: "ringing-independent" },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, dispatchEvent: event => capabilityEvents.push(event.type),
    addEventListener(name, fn) { windowEvents.set(name, fn); }, DuckNativeNotifications: {
    async request(body) {
      calls.push(body);
      if (fail && body.action === fail.action) { const error = fail.error; fail = null; throw new Error(error); }
      let result;
      if (body.action === "status") result = { permission };
      else if (body.action === "authorize") { if (permission === "denied") throw new Error("Normal notifications denied"); permission = "authorized"; result = { permission }; }
      else if (body.action === "context") { scope = body.scope; for (const [owner, map] of groups) for (const id of map.keys()) if (owner !== scope || !body.activeTaskIDs.includes(id)) map.delete(id); result = { ok: true }; }
      else if (body.action === "list") result = { notifications: [...rows().values()] };
      else if (body.action === "schedule") { if (permission === "denied") throw new Error("Normal notifications denied"); const notification = { item_id: body.taskID, title: body.title, fire_at: body.fireAt, time_zone: body.timeZone }; rows().set(body.taskID, notification); result = { notification }; }
      else if (body.action === "cancel") { rows().delete(body.taskID); result = { ok: true }; }
      else if (body.action === "cancelAll") { for (const map of groups.values()) map.clear(); result = { ok: true }; }
      const hold = pending[body.action]; if (hold) { delete pending[body.action]; hold.started.resolve(); await hold.release.promise; }
      return result;
    },
  } };
  vm.runInNewContext(fs.readFileSync("landing/native-task-notifications.js", "utf8"), { window, document: ui.document, Map, Set, Error, String, Event });
  return {
    ...ui, calls, window, windowEvents, groups, api: window.DuckTaskNotifications, capabilityEvents, storage,
    deny() { permission = "denied"; }, fail(action, error) { fail = { action, error }; },
    hold(action) { const hold = { started: deferred(), release: deferred() }; pending[action] = hold; return hold; },
  };
}

test("native normal notifications use a separate bridge, explicit timezone and serialized cancellation", async () => {
  const f = nativeSetup();
  await f.api.setContext("cloud:A", [{ id: "task", title: "Study" }]);
  await f.api.save("task", wallTime, { timeZone: "UTC", scope: "cloud:A" });
  const schedule = f.calls.find(call => call.action === "schedule");
  assert.equal(schedule.title, "Study"); assert.equal(schedule.fireAt, Date.UTC(2026, 11, 15, 9)); assert.equal(schedule.timeZone, "UTC");
  assert.equal(schedule.scope, "cloud:A");
  assert.equal(f.api.get("task").title, "Study"); assert.equal(f.api.available, true);
  assert.equal(f.window.DuckTaskAlarms.marker, "ringing-independent");
  await f.api.save("task", "");
  assert.equal(f.api.get("task"), undefined);
});

test("native banner denial and failed replacement do not create records or poison later cancellation", async () => {
  const f = nativeSetup(); await f.api.setContext("local", [{ id: "task" }]);
  await f.api.save("task", wallTime, { title: "Study", timeZone: "UTC" });
  const before = f.api.get("task");
  f.fail("schedule", "Could not replace notification");
  await assert.rejects(f.api.save("task", "2026-12-15T10:00", { timeZone: "UTC" }), /Could not replace/);
  assert.equal(f.api.get("task"), before);
  await f.api.save("task", ""); f.deny(); await f.api.refresh();
  assert.equal(f.api.available, false); assert.equal(f.api.canSave(), true);
  assert.match(f.nodes.get("#task-notification-status").textContent, /permission is off/);
  await assert.rejects(f.api.save("task", wallTime, { timeZone: "UTC" }), /Normal notifications denied/);
  assert.equal(f.api.get("task"), undefined);
  await f.api.detach();
});

test("native context removes completed/deleted records and stale saves cannot cross owners", async () => {
  const f = nativeSetup(); await f.api.setContext("cloud:A", [{ id: "task-a" }]);
  const pending = f.hold("schedule");
  const old = f.api.save("task-a", wallTime, { timeZone: "UTC" }).catch(error => error); await pending.started.promise;
  const change = f.api.setContext("cloud:B", [{ id: "task-b" }, { id: "done", completed: true }, { id: "deleted", deleted: true }]);
  assert.equal(f.api.get("task-a"), undefined); pending.release.resolve();
  assert.match((await old).message, /context changed/); await change;
  assert.equal(f.api.get("task-a"), undefined); assert.equal(f.groups.get("cloud:A").size, 0);
  const context = f.calls.filter(call => call.action === "context").at(-1);
  assert.deepEqual(Array.from(context.activeTaskIDs), ["task-b"]);
  await assert.rejects(f.api.save("done", wallTime, { timeZone: "UTC" }), /no longer active/);
  await assert.rejects(f.api.save("task-a", wallTime, { scope: "cloud:A" }), /context changed/);
  await f.api.save("task-b", wallTime, { timeZone: "UTC" });
  assert.equal(f.api.get("task-b").item_id, "task-b");
});

test("native device pause cancels without changing task choices and persists until explicit re-enable", async () => {
  const storage = new Map(), f = nativeSetup({ storage });
  const task = { id: "task", title: "Study", workAlerts: { notification: { enabled: true } } };
  await f.api.setContext("A", [task]); await f.api.save("task", wallTime, { timeZone: "UTC", scope: "A" });
  await f.nodes.get("#disable-task-notifications").events.click();
  assert.equal(f.api.canSave(), false); assert.equal(f.api.available, false); assert.equal(f.api.foregroundEnabled, false);
  assert.equal(f.api.get("task"), undefined); assert.equal(task.workAlerts.notification.enabled, true);
  await f.api.setContext("A", [task]); await f.api.refresh();
  await assert.rejects(f.api.save("task", wallTime, { timeZone: "UTC", scope: "A" }), /paused on this device/);
  const restored = nativeSetup({ storage }); await restored.api.setContext("A", [task]); assert.equal(restored.api.canSave(), false);
  await restored.api.setContext("B", [task]); assert.equal(restored.api.canSave(), true);
  await f.nodes.get("#enable-task-notifications").events.click(); assert.equal(f.api.canSave(), true);
  assert.equal(f.api.available, true); assert.ok(f.capabilityEvents.length >= 2);
  assert.ok(f.capabilityEvents.every(type => type === "duckplan:work-alert-capability"));
});

test("native normal adapter leaves ordinary browsers untouched", () => {
  const existing = {}, window = { DuckTaskNotifications: existing };
  vm.runInNewContext(fs.readFileSync("landing/native-task-notifications.js", "utf8"), { window });
  assert.equal(window.DuckTaskNotifications, existing);
});
