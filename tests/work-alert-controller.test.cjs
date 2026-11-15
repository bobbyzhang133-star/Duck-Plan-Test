const test = require("node:test");
const assert = require("node:assert/strict");
const Controller = require("../landing/work-alert-controller.js");
const Domain = require("../landing/work-alerts.js");
const Reminder = require("../landing/reminder-domain.js");

const now = Date.UTC(2026, 10, 14, 12);
const start = "2026-11-15T09:00";
const plain = () => ({ id: "essay", title: "Write essay", scheduledStart: start, dueDate: "2026-11-20", dueTime: "17:00", durationMinutes: 45, completed: false });
const configured = value => Domain.forSave(value || plain(), { timeZone: "UTC" });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

function fixture({ items = [], mode = "local", user = null, timeZone = "UTC", normalAvailable = true, normalCanSave = true, alarmCanSave = true, normalNative = true, storage = new Map() } = {}) {
  let clock = now, tasks = structuredClone(items), failStore = null, holdStore = null;
  const writes = [], contexts = [], foreground = [], errors = [], timerCalls = [];
  const store = {
    mode, user, listItems: () => structuredClone(tasks),
    async upsertItem(task) {
      writes.push(structuredClone(task));
      if (failStore) { const message = failStore; failStore = null; throw new Error(message); }
      const owner = `${store.mode}:${store.user?.id || "local"}`;
      if (holdStore) { const held = holdStore; holdStore = null; held.started.resolve(); await held.release.promise; }
      if (owner === `${store.mode}:${store.user?.id || "local"}`) tasks = [...tasks.filter(item => item.id !== task.id), structuredClone(task)];
      return structuredClone(task);
    },
  };
  function provider(channel, canSave, native, available = canSave) {
    const records = new Map(), calls = [], source = new Map();
    let fail = null, held = null;
    return {
      native, available, calls, records, source,
      canSave: () => canSave, get: id => records.get(id),
      async setContext(scope, items) {
        calls.push({ action: "context", scope, ids: items.filter(item => !item.completed).map(item => item.id) }); contexts.push([channel, scope]);
        const active = new Set(items.filter(item => !item.completed && !item.deleted && !item.deleted_at).map(item => item.id));
        for (const id of records.keys()) if (!active.has(id)) records.delete(id);
      },
      async refresh() { calls.push({ action: "refresh" }); for (const [id, record] of source) records.set(id, record); },
      async save(id, wallTime, options) {
        calls.push({ action: "save", id, wallTime, options });
        if (held) { const current = held; held = null; current.started.resolve(); await current.release.promise; }
        if (fail) { const message = fail; fail = null; throw new Error(message); }
        if (!wallTime) { records.delete(id); return; }
        const result = Reminder.wallTimeToEpoch(wallTime.slice(0, 10), wallTime.slice(11, 16), options.timeZone);
        records.set(id, { item_id: id, fire_at: result.epoch, title: options.title });
      },
      async detach() { calls.push({ action: "detach" }); records.clear(); },
      fail(message) { fail = message; },
      hold() { held = { started: deferred(), release: deferred() }; return held; },
    };
  }
  const alarms = provider("alarm", alarmCanSave, true);
  const notifications = provider("notification", normalCanSave, normalNative, normalAvailable);
  const timers = {
    setInterval(fn, ms) { timerCalls.push({ action: "start", fn, ms }); return "timer"; },
    clearInterval(id) { timerCalls.push({ action: "clear", id }); },
  };
  const localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  const controller = Controller.create({ store, alarms, notifications, timeZone, now: () => clock, timers, storage: localStorage, onForeground: task => foreground.push(task), onError: error => errors.push(error) });
  return {
    controller, store, alarms, notifications, writes, contexts, foreground, errors, timerCalls, storage,
    setClock(value) { clock = value; }, setTasks(value) { tasks = structuredClone(value); },
    setOwner(id) { store.mode = id ? "cloud" : "local"; store.user = id ? { id } : null; },
    failStore(message) { failStore = message; },
    holdStore() { holdStore = { started: deferred(), release: deferred() }; return holdStore; },
  };
}
const savedCalls = provider => provider.calls.filter(call => call.action === "save");

test("saving newly scheduled work persists both enabled links before scheduling independent channels", async () => {
  const f = fixture();
  const original = plain(), saved = await f.controller.save(original);
  assert.equal(f.writes.length, 1); assert.equal(saved.workAlerts.alarm.mode, "work"); assert.equal(saved.workAlerts.notification.mode, "alarm");
  assert.equal(saved.workAlerts.alarm.enabled, true); assert.equal(saved.workAlerts.notification.enabled, true);
  for (const provider of [f.alarms, f.notifications]) {
    assert.equal(savedCalls(provider).length, 1); assert.equal(savedCalls(provider)[0].wallTime, start);
    assert.equal(savedCalls(provider)[0].options.timeZone, "UTC");
    assert.equal(savedCalls(provider)[0].options.scope, "local");
  }
  assert.equal(saved.dueDate, original.dueDate); assert.equal(saved.dueTime, original.dueTime); assert.equal(original.workAlerts, undefined);
  f.controller.destroy();
});

test("legacy provider records load before preference initialization and retain their explicit time in the configured zone", async () => {
  const f = fixture({ items: [plain()], timeZone: "America/Los_Angeles" });
  const alarmEpoch = Date.UTC(2026, 10, 15, 16, 30), normalEpoch = Date.UTC(2026, 10, 15, 16, 15);
  f.alarms.source.set("essay", { item_id: "essay", fire_at: alarmEpoch, sound: "gentle", snoozeMinutes: 10 });
  f.notifications.source.set("essay", { item_id: "essay", fire_at: normalEpoch });
  const saved = await f.controller.save(plain());
  assert.equal(saved.workAlerts.alarm.mode, "manual"); assert.equal(saved.workAlerts.alarm.at, "2026-11-15T08:30");
  assert.equal(saved.workAlerts.notification.mode, "manual"); assert.equal(saved.workAlerts.notification.at, "2026-11-15T08:15");
  assert.equal(saved.workAlerts.alarm.sound, "gentle"); assert.equal(saved.workAlerts.alarm.snoozeMinutes, 10);
  assert.equal(saved.workAlerts.timeZone, "America/Los_Angeles");
  assert.equal(savedCalls(f.alarms)[0].wallTime, "2026-11-15T08:30");
  f.controller.destroy();
});

test("turning off the ringing alarm does not break a normal notification that follows its chosen time", async () => {
  const f = fixture(), task = configured();
  task.workAlerts = Domain.setEnabled(Domain.editTime(task.workAlerts, "alarm", "2026-11-15T08:45"), "alarm", false);
  await f.controller.save(task);
  assert.equal(savedCalls(f.alarms).at(-1).wallTime, "");
  assert.equal(savedCalls(f.notifications).at(-1).wallTime, "2026-11-15T08:45");
  f.controller.destroy();
});

test("manual channel overrides survive work moves and Undo while untouched links follow the new work time", async () => {
  const f = fixture(), task = configured();
  task.workAlerts = Domain.editTime(task.workAlerts, "notification", "2026-11-15T08:30");
  await f.controller.save(task);
  await f.controller.save({ ...task, scheduledStart: "2026-11-15T23:00" });
  assert.equal(savedCalls(f.alarms).at(-1).wallTime, "2026-11-15T23:00");
  assert.equal(savedCalls(f.notifications).at(-1).wallTime, "2026-11-15T08:30");
  await f.controller.save(task);
  assert.equal(savedCalls(f.alarms).at(-1).wallTime, start);
  assert.equal(f.store.listItems()[0].workAlerts.notification.mode, "manual");
  f.controller.destroy();
});

test("startup reconciliation leaves unconfigured legacy tasks alone and is idempotent for configured tasks", async () => {
  const original = plain(), f = fixture({ items: [original] });
  await f.controller.reconcile({ refresh: true });
  assert.equal(f.writes.length, 0); assert.equal(savedCalls(f.alarms).length, 0); assert.equal(savedCalls(f.notifications).length, 0);
  f.setTasks([configured()]); await f.controller.reconcile(); await f.controller.reconcile();
  assert.equal(savedCalls(f.alarms).length, 1); assert.equal(savedCalls(f.notifications).length, 1);
  assert.equal(original.workAlerts, undefined); f.controller.destroy();
});

test("failed task persistence causes no scheduling calls and a later retry remains usable", async () => {
  const f = fixture(); f.failStore("Disk is full");
  await assert.rejects(f.controller.save(plain()), /Disk is full/);
  assert.equal(savedCalls(f.alarms).length, 0); assert.equal(savedCalls(f.notifications).length, 0);
  const saved = await f.controller.save(plain());
  assert.equal(saved.id, "essay"); assert.equal(savedCalls(f.alarms).length, 1); f.controller.destroy();
});

test("a failure in one alert channel still attempts the other and reports the saved task honestly", async () => {
  const f = fixture(); f.alarms.fail("Alarm permission denied");
  let reported;
  try { await f.controller.save(plain()); } catch (error) { reported = error; }
  assert.ok(reported); assert.equal(reported.savedTask.id, "essay"); assert.match(reported.message, /Task saved/); assert.match(reported.message, /Alarm permission denied/);
  assert.equal(f.store.listItems().length, 1); assert.equal(savedCalls(f.notifications).length, 1);
  assert.equal(f.notifications.records.get("essay").fire_at, Date.UTC(2026, 10, 15, 9));
  await f.controller.reconcile(); assert.equal(f.alarms.records.get("essay").fire_at, Date.UTC(2026, 10, 15, 9));
  f.controller.destroy();
});

test("an old account's pending task save cannot schedule into the next account or invoke error/foreground callbacks", async () => {
  const f = fixture({ mode: "cloud", user: { id: "A" } });
  const held = f.holdStore(), pending = f.controller.save(plain()); await held.started.promise;
  f.setOwner("B"); f.setTasks([{ id: "b", title: "B task", completed: false }]);
  await f.controller.reconcile(); held.release.resolve(); await pending;
  assert.equal(savedCalls(f.alarms).length, 0); assert.equal(savedCalls(f.notifications).length, 0);
  assert.deepEqual(f.store.listItems().map(task => task.id), ["b"]);
  assert.equal(f.errors.length, 0); assert.equal(f.foreground.length, 0);
  assert.ok(f.contexts.some(([channel, scope]) => channel === "notification" && scope === "B")); f.controller.destroy();
});

test("a rejected old-owner channel request neither reports into the next owner nor blocks current reconciliation", async () => {
  const f = fixture({ mode: "cloud", user: { id: "A" }, items: [configured()] });
  const held = f.alarms.hold(); f.alarms.fail("A private failure");
  const previous = f.controller.reconcile(); await held.started.promise;
  f.setOwner("B"); f.setTasks([{ id: "b", title: "B", completed: false }]); const current = f.controller.reconcile();
  held.release.resolve(); await Promise.all([previous, current]);
  assert.equal(f.errors.length, 0); assert.equal(savedCalls(f.notifications).length, 0); f.controller.destroy();
});

test("an error collected before an owner change is not reported after another channel finishes late", async () => {
  const f = fixture({ mode: "cloud", user: { id: "A" }, items: [configured()] });
  f.alarms.fail("A private alarm failure"); const held = f.notifications.hold();
  const previous = f.controller.reconcile(); await held.started.promise;
  f.setOwner("B"); f.setTasks([{ id: "b", title: "B", completed: false }]); const current = f.controller.reconcile();
  held.release.resolve(); await Promise.all([previous, current]);
  assert.equal(f.errors.length, 0, "A's collected alarm failure must not appear in B's planner"); f.controller.destroy();
});

test("completion and deletion remove scheduled channel records without changing task preferences", async () => {
  const f = fixture({ items: [configured()] }); await f.controller.reconcile();
  const completed = { ...f.store.listItems()[0], completed: true }; f.setTasks([completed]); await f.controller.reconcile();
  assert.equal(f.alarms.records.has("essay"), false); assert.equal(f.notifications.records.has("essay"), false);
  assert.equal(completed.workAlerts.alarm.enabled, true);
  f.setTasks([configured()]); await f.controller.reconcile(); f.setTasks([]); await f.controller.reconcile();
  assert.equal(f.alarms.records.size, 0); assert.equal(f.notifications.records.size, 0); f.controller.destroy();
});

test("local foreground notifications deduplicate a saved occurrence across ticks and controller restarts", async () => {
  const storage = new Map(), f = fixture({ normalCanSave: false, normalAvailable: false, normalNative: false, alarmCanSave: false, storage });
  await f.controller.save(plain());
  const fireAt = Date.UTC(2026, 10, 15, 9); f.setClock(fireAt - 1); f.controller.tick(); assert.equal(f.foreground.length, 0);
  f.setClock(fireAt); f.controller.tick(); f.controller.tick(); assert.equal(f.foreground.length, 1);
  f.controller.destroy();
  const restored = fixture({ items: f.store.listItems(), normalCanSave: false, normalAvailable: false, normalNative: false, alarmCanSave: false, storage });
  await restored.controller.reconcile(); restored.setClock(fireAt); restored.controller.tick(); assert.equal(restored.foreground.length, 0);
  assert.ok(f.timerCalls.some(call => call.action === "clear")); restored.controller.destroy();
});

test("foreground tick rechecks current enabled settings and work time before delivering an old queued occurrence", async () => {
  for (const change of [task => ({ ...task, workAlerts: Domain.setEnabled(task.workAlerts, "notification", false) }), task => ({ ...task, scheduledStart: "2026-11-16T09:00" }), task => ({ ...task, deleted: true })]) {
    const f = fixture({ normalCanSave: false, normalAvailable: false, normalNative: false, alarmCanSave: false });
    await f.controller.save(plain()); f.setTasks([change(f.store.listItems()[0])]);
    f.setClock(Date.UTC(2026, 10, 15, 9)); f.controller.tick();
    assert.equal(f.foreground.length, 0, "A pending reconcile must not allow a stale occurrence to fire"); f.controller.destroy();
  }
});

test("foreground reminders preserve the one-minute late-delivery window across a reconciliation", async () => {
  const f = fixture({ normalCanSave: false, normalAvailable: false, normalNative: false, alarmCanSave: false });
  await f.controller.save(plain()); f.setClock(Date.UTC(2026, 10, 15, 9) + 30000);
  await f.controller.reconcile(); f.controller.tick(); assert.equal(f.foreground.length, 1);
  const late = fixture({ normalCanSave: false, normalAvailable: false, normalNative: false, alarmCanSave: false });
  await late.controller.save(plain()); late.setClock(Date.UTC(2026, 10, 15, 9) + 60001); late.controller.tick();
  assert.equal(late.foreground.length, 0); f.controller.destroy(); late.controller.destroy();
});

test("unavailable push delivery still permits foreground fallback even when the server can save its schedule", async () => {
  const f = fixture({ normalCanSave: true, normalAvailable: false, normalNative: false, alarmCanSave: false });
  await f.controller.save(plain()); f.setClock(Date.UTC(2026, 10, 15, 9)); f.controller.tick();
  assert.equal(f.foreground.length, 1); f.controller.destroy();
});

test("detach and destroy clear foreground work and provider contexts without future callbacks", async () => {
  const f = fixture({ normalCanSave: false, normalAvailable: false, normalNative: false, alarmCanSave: false });
  await f.controller.save(plain()); await f.controller.detach();
  assert.equal(f.alarms.calls.at(-1).action, "detach"); assert.equal(f.notifications.calls.at(-1).action, "detach");
  f.setClock(Date.UTC(2026, 10, 15, 9)); f.controller.tick(); assert.equal(f.foreground.length, 0);
  f.controller.destroy(); f.controller.tick(); assert.equal(f.foreground.length, 0);
});
