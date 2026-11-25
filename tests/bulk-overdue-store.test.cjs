const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("../landing/planner-model.js");
const Store = require("../landing/planner-store.js");
const KEY = "duckplan-demo-tasks-v1";
const reference = new Date(2026, 10, 20, 13);
const task = id => ({ id: String(id), title: `Task ${id}`, classId: null, dueDate: "2026-11-19", dueTime: "", notes: "Keep notes", durationMinutes: 45, priority: "Medium", completed: false });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function storage(rows = []) {
  const data = new Map([[KEY, JSON.stringify(rows)]]);
  return { writes: 0, fail: false, getItem: k => data.get(k) ?? null, removeItem: k => data.delete(k),
    setItem(k, v) { if (this.fail && k === KEY) throw Error("Quota exceeded"); if (k === KEY) this.writes++; data.set(k, String(v)); } };
}
async function local(rows) {
  const saved = storage(rows), store = Store.createPlannerStore({ storage: saved, model: Model, defaultClasses: () => [], defaultTasks: () => [] });
  await store.init(); saved.writes = 0;
  return { store, saved };
}
async function cloud(rows, { bulk = true, persist } = {}) {
  const writes = [], events = [], saved = storage();
  const fetchImpl = async (url, init) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/api/session") return Response.json({ user: { id: "owner", email: "owner@example.test" } });
    if (pathname === "/api/planner") return Response.json({ classes: [], items: rows, bulk_completion_supported: bulk });
    if (pathname === "/api/auth/sign-out") return Response.json({ ok: true });
    const body = JSON.parse(init.body); writes.push({ pathname, body });
    if (persist) await persist({ pathname, body, writes, rows });
    if (pathname === "/api/items/complete-overdue") {
      const completed = body.items.map(item => { const row = rows.find(r => r.id === item.id); row.completed = 1; row.sync_revision++; return { id: row.id, sync_revision: row.sync_revision }; });
      return Response.json({ completed });
    }
    const row = rows.find(r => pathname === `/api/items/${r.id}`);
    Object.assign(row, body); row.sync_revision++;
    return Response.json({ item: row });
  };
  const store = Store.createPlannerStore({ storage: saved, model: Model, defaultClasses: () => [], defaultTasks: () => [], config: { apiUrl: "https://planner.test/api" }, fetchImpl, WebSocketImpl: null, locationRef: { href: "https://planner.test/" } });
  await store.init(); store.subscribe(({ reason }) => events.push(reason));
  return { store, writes, events, rows };
}
const row = id => ({ id: String(id), title: `Task ${id}`, due_date: "2026-11-19", due_time: null, sync_revision: 3, completed: 0 });

test("2000 local completions commit once, notify once and survive reload without changing other fields", async () => {
  const h = await local(Array.from({ length: 2000 }, (_, i) => task(i))), before = h.store.listItems(), events = [];
  h.store.subscribe(({ reason }) => events.push(reason));
  assert.deepEqual(await h.store.completeOverdue(before.map(t => t.id), { reference }), { completed: 2000 });
  assert.equal(h.saved.writes, 1); assert.deepEqual(events, ["bulk-completed"]);
  assert.deepEqual(h.store.listItems(), before.map(t => ({ ...t, completed: true })));
  const reopened = Store.createPlannerStore({ storage: h.saved, model: Model, defaultClasses: () => [], defaultTasks: () => [] });
  await reopened.init(); assert.deepEqual(reopened.listItems(), h.store.listItems());
});

test("bulk selection excludes exact-now, date-only today, future, deleted, completed and undated tasks", async () => {
  const h = await local([task("past"), { ...task("timed"), dueDate: "2026-11-20", dueTime: "12:00" },
    { ...task("today"), dueDate: "2026-11-20" }, { ...task("now"), dueDate: "2026-11-20", dueTime: "13:00" },
    { ...task("future"), dueDate: "2026-11-21" }, { ...task("deleted"), deleted: true }, { ...task("done"), completed: true }, { ...task("undated"), dueDate: "" }]);
  const ids = h.store.listItems().map(t => t.id);
  assert.equal((await h.store.completeOverdue(ids.concat(ids), { reference })).completed, 2);
  assert.deepEqual(h.store.listItems().filter(t => t.completed).map(t => t.id), ["past", "timed", "done"]);
});

test("local quota failure leaves memory and disk untouched and allows retry", async () => {
  const h = await local([task("a")]), before = h.store.listItems(), disk = h.saved.getItem(KEY);
  h.saved.fail = true;
  await assert.rejects(h.store.completeOverdue(["a"], { reference }), e => /storage/.test(e.message) && e.completed === 0);
  assert.deepEqual(h.store.listItems(), before); assert.equal(h.saved.getItem(KEY), disk);
  h.saved.fail = false; assert.equal((await h.store.completeOverdue(["a"], { reference })).completed, 1);
});

test("signed-in completion uses bounded 200-row requests, revision guards and one presentation refresh", async () => {
  const h = await cloud(Array.from({ length: 451 }, (_, i) => row(i)));
  const pending = h.store.completeOverdue(h.store.listItems().map(t => t.id), { reference });
  assert.equal(h.store.completeOverdue(["0"], { reference }), pending);
  assert.equal((await pending).completed, 451);
  assert.deepEqual(h.writes.map(w => w.body.items.length), [200, 200, 51]);
  assert.equal(h.writes[0].body.before, "2026-11-20T13:00:00.000");
  assert.equal(h.writes[0].body.items[0].expected_revision, 3);
  assert.deepEqual(h.events, ["bulk-completed"]);
  assert.ok(h.store.listItems().every(t => t.completed && t.syncRevision === 4));
});

test("a failed cloud batch keeps committed batches, reports count and can retry", async () => {
  let fail = true;
  const h = await cloud(Array.from({ length: 201 }, (_, i) => row(i)), { persist: async ({ writes }) => { if (writes.length === 2 && fail) throw Error("Offline"); } });
  await assert.rejects(h.store.completeOverdue(h.store.listItems().map(t => t.id), { reference }), e => e.completed === 200);
  assert.equal(h.store.listItems().filter(t => t.completed).length, 200);
  fail = false; await h.store.refresh();
  assert.equal((await h.store.completeOverdue(["200"], { reference })).completed, 1);
});

test("legacy servers use serial PATCH with one final presentation update", async () => {
  const gate = deferred();
  const h = await cloud([row("a"), row("b"), row("c")], { bulk: false, persist: async ({ writes }) => { if (writes.length === 1) await gate.promise; } });
  const pending = h.store.completeOverdue(["a", "b", "c"], { reference });
  await new Promise(r => setImmediate(r)); assert.equal(h.writes.length, 1); assert.deepEqual(h.events, []);
  gate.resolve(); assert.equal((await pending).completed, 3);
  assert.equal(h.writes.length, 3); assert.ok(h.writes.every(w => !w.body.items)); assert.deepEqual(h.events, ["bulk-completed"]);
});

test("account changes stop later batches and never apply old acknowledgements to a new owner", async () => {
  const gate = deferred(), h = await cloud(Array.from({ length: 201 }, (_, i) => row(i)), { persist: async () => gate.promise });
  const pending = h.store.completeOverdue(h.store.listItems().map(t => t.id), { reference });
  await new Promise(r => setImmediate(r)); await h.store.signOut(); gate.resolve(); await pending;
  assert.equal(h.writes.length, 1); assert.equal(h.store.mode, "local"); assert.deepEqual(h.store.listItems(), []);
  assert.ok(!h.events.includes("bulk-completed"));
});

test("a concurrently moved deadline is not swept into later batches", async () => {
  const gate = deferred(), h = await cloud(Array.from({ length: 201 }, (_, i) => row(i)), { persist: async ({ writes }) => { if (writes.length === 1) await gate.promise; } });
  const pending = h.store.completeOverdue(h.store.listItems().map(t => t.id), { reference });
  await new Promise(r => setImmediate(r));
  const moved = h.store.listItems().find(t => t.id === "200");
  await h.store.upsertItem({ ...moved, dueDate: "2026-12-01", title: "Moved deadline" });
  gate.resolve(); assert.equal((await pending).completed, 200);
  assert.equal(h.store.listItems().find(t => t.id === "200").completed, false);
  assert.equal(h.store.listItems().find(t => t.id === "200").dueDate, "2026-12-01");
  assert.equal(h.writes.filter(w => w.body.items).length, 1);
});
