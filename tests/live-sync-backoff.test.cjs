const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Model = require("../landing/planner-model.js");

// Run the entire shipped store, including owner changes, against a deterministic
// clock and fault-injected socket. No production requests or real waiting.
async function harness(random = () => 1) {
  let time = 0, id = 0, user = { id: "owner-a" }, constructorFails = false, snapshotStatus = 200;
  const jobs = new Map(), sockets = [], requests = [], delays = [];
  const schedule = (fn, ms, interval = false) => {
    const key = ++id; jobs.set(key, { fn, at: time + ms, interval: interval ? ms : 0 });
    if (!interval) delays.push(ms);
    return key;
  };
  const timers = {
    setTimeout: (fn, ms) => schedule(fn, ms), clearTimeout: key => jobs.delete(key),
    setInterval: (fn, ms) => schedule(fn, ms, true), clearInterval: key => jobs.delete(key),
  };
  const settle = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
  const advance = async (ms) => {
    const end = time + ms;
    for (;;) {
      const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      const [key, job] = next; time = job.at;
      if (job.interval) job.at += job.interval; else jobs.delete(key);
      job.fn(); await settle();
    }
    time = end; await settle();
  };
  class Socket {
    constructor() { if (constructorFails) throw new Error("Transport unavailable"); sockets.push(this); this.sent = []; }
    open() { this.onopen(); }
    send(value) { this.sent.push(value); }
    close() { this.closed = true; this.onclose?.(); }
    receive(value) { this.onmessage({ data: JSON.stringify(value) }); }
  }
  const rows = [];
  const planner = () => ({ classes: [], items: rows, templates: [], resources: [], organization: {}, goals: [], habits: [], habit_checkins: [], notes: [] });
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, at: time });
    if (url.endsWith("/sign-out")) user = null;
    const data = url.endsWith("/planner") ? planner() : { user };
    const status = url.endsWith("/planner") ? snapshotStatus : 200;
    return { ok: status === 200, status, json: async () => structuredClone(data) };
  };
  const context = vm.createContext({ ...timers, Date: class extends Date { static now() { return time; } },
    Math: Object.assign(Object.create(Math), { random }), URL, console, structuredClone, crypto: globalThis.crypto });
  vm.runInContext(fs.readFileSync(require.resolve("../landing/planner-store.js"), "utf8"), context);
  const storage = new Map();
  const store = context.DuckPlannerStore.createPlannerStore({
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    model: Model, defaultClasses: () => [], defaultTasks: () => [], config: { apiUrl: "/api" },
    WebSocketImpl: Socket, fetchImpl, documentRef: null, locationRef: { href: "https://fixture.test/" },
  });
  await store.init();
  return { store, sockets, requests, delays, jobs, rows, advance, settle,
    snapshots: () => requests.filter(request => request.url.endsWith("/planner")),
    time: () => time, failConstructor: value => { constructorFails = value; }, failSnapshots: status => { snapshotStatus = status; } };
}

test("brief successful connections retain exponential backoff and cap catch-up snapshots", async () => {
  const app = await harness();
  for (const delay of [2000, 4000, 8000, 16000, 30000, 30000]) {
    const previous = app.sockets.length;
    app.sockets.at(-1).open(); await app.settle();
    await app.advance(1000); app.sockets.at(-1).close();
    await app.advance(delay - 1); assert.equal(app.sockets.length, previous);
    await app.advance(1); assert.equal(app.sockets.length, previous + 1);
  }
  const catchUps = app.snapshots().slice(1);
  assert.ok(catchUps.length >= 2, "missed data still gets a catch-up");
  assert.ok(catchUps.every((request, i) => !i || request.at - catchUps[i - 1].at >= 30000));
  await app.store.signOut(); assert.equal(app.jobs.size, 0);
});

test("only a continuously stable open connection resets backoff, including heartbeats", async () => {
  const app = await harness();
  app.sockets[0].close(); await app.advance(2000);
  app.sockets[1].close(); await app.advance(4000);
  const stable = app.sockets.at(-1); stable.open();
  await app.advance(30000);
  assert.deepEqual(stable.sent, ["ping"]);
  stable.close(); const before = app.sockets.length;
  await app.advance(1999); assert.equal(app.sockets.length, before);
  await app.advance(1); assert.equal(app.sockets.length, before + 1);
  await app.store.signOut();
});

test("retry jitter separates clients and synchronous construction failures stay backed off", async () => {
  const early = await harness(() => 0), late = await harness(() => 1);
  early.sockets[0].close(); late.sockets[0].close();
  await early.advance(1500); await late.advance(1500);
  assert.equal(early.sockets.length, 2); assert.equal(late.sockets.length, 1);
  early.failConstructor(true);
  early.sockets[1].close(); await early.advance(3000);
  assert.equal(early.sockets.length, 2);
  early.failConstructor(false); await early.advance(5999);
  assert.equal(early.sockets.length, 2);
  await early.advance(1); assert.equal(early.sockets.length, 3);
  await Promise.all([early.store.signOut(), late.store.signOut()]);
});

test("delayed catch-up retains missed writes while live rows bypass the throttle", async () => {
  const app = await harness();
  app.sockets[0].open(); await app.settle();
  assert.equal(app.snapshots().length, 2, "first connection closes the bootstrap gap");
  app.sockets[0].close(); await app.advance(2000);
  app.sockets[1].open();
  app.rows.push({ id: "missed", title: "Missed while disconnected", priority: "medium" });
  app.sockets[1].receive({ table: "items", row: { id: "live", title: "Immediate row", priority: "medium" } });
  assert.equal(app.store.listItems()[0].id, "live");
  assert.equal(app.snapshots().length, 2);
  await app.advance(27999); assert.equal(app.snapshots().length, 2);
  await app.advance(1); assert.equal(app.snapshots().length, 3);
  assert.equal(app.store.listItems()[0].id, "missed");
  await app.store.signOut();
});

test("retired socket events and duplicate closes cannot affect the replacement connection", async () => {
  const app = await harness(), old = app.sockets[0];
  old.open(); old.close(); old.close(); await app.advance(2000);
  assert.equal(app.sockets.length, 2);
  const current = app.sockets[1]; current.open();
  old.receive({ table: "items", row: { id: "stale", title: "Do not inject" } });
  old.open(); old.close();
  assert.equal(app.store.listItems().length, 0);
  await app.advance(30000);
  assert.equal(app.sockets.length, 2); assert.deepEqual(current.sent, ["ping"]);
  await app.store.signOut();
});

test("rate-limited catch-up preserves saved data and does not spin HTTP retries", async () => {
  const app = await harness();
  app.sockets[0].receive({ table: "items", row: { id: "existing", title: "Keep existing data" } });
  app.failSnapshots(429);
  app.sockets[0].open(); await app.settle();
  assert.equal(app.snapshots().length, 2);
  await app.advance(120000);
  assert.equal(app.snapshots().length, 2, "a rejected catch-up must not immediately retry itself");
  assert.equal(app.store.listItems()[0].id, "existing");
  app.failSnapshots(200); app.rows.push({ id: "after-outage", title: "Caught up after recovery" });
  app.sockets[0].close(); await app.advance(2000); app.sockets[1].open(); await app.settle();
  assert.equal(app.store.listItems()[0].id, "after-outage");
  await app.store.signOut();
});

test("sign-out cancels deferred snapshots, stable timers, heartbeats and retries", async () => {
  for (const pendingOpen of [false, true]) {
    const app = await harness(), first = app.sockets[0];
    first.open(); first.close(); await app.advance(2000);
    const next = app.sockets[1];
    if (pendingOpen) next.open(); else next.close();
    await app.store.signOut();
    const before = [app.sockets.length, app.snapshots().length];
    next.open(); next.receive({ table: "items", row: { id: "other-owner", title: "Private" } }); next.close();
    await app.advance(120000);
    assert.deepEqual([app.sockets.length, app.snapshots().length], before);
    assert.equal(app.jobs.size, 0); assert.equal(app.store.mode, "local");
    assert.equal(app.store.listItems().length, 0);
  }
});

test("a simulated day of one-second flapping stays bounded rather than retrying every two seconds", async () => {
  for (const random of [() => 0, () => 1]) {
    const app = await harness(random);
    while (app.time() < 86400000) {
      app.sockets.at(-1).open(); await app.settle();
      await app.advance(1000); app.sockets.at(-1).close();
      await app.advance(app.delays.at(-1));
    }
    assert.ok(app.sockets.length < 3700, `bounded handshakes: ${app.sockets.length}`);
    assert.ok(app.snapshots().length < 2900, `bounded snapshots: ${app.snapshots().length}`);
    await app.store.signOut();
  }
});
