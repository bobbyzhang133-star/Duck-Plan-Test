const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Model = require("../landing/planner-model.js");
const source = fs.readFileSync("landing/app.js", "utf8");
const functions = ["unfinishedOverdueTasks", "renderOverdueActions", "completeAllOverdue"].map(name => {
  const text = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^\\}`, "m"))?.[0];
  assert.ok(text, name); return text;
}).join("\n");
const overdue = id => ({ id, dueDate: "2026-11-19", dueTime: "", completed: false });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness(initial, persist = async () => {}) {
  let items = structuredClone(initial);
  const writes = [], messages = [], errors = [];
  const buttons = [0, 1].map(() => ({ setAttribute(name, value) { this[name] = value; } }));
  const store = { mode: "local", user: null, listItems: () => items,
    async toggleComplete(id, completed) { writes.push(id); await persist(id); items = items.map(t => t.id === id ? { ...t, completed } : t); } };
  const context = vm.createContext({ store, Model: { taskTiming: task => Model.taskTiming(task, "2026-11-20T13:00") },
    document: { querySelectorAll: () => buttons }, showToast: m => messages.push(m), reportError: e => errors.push(e.message) });
  vm.runInContext(`let plannerOwnerVersion=0, overdueCompletion=null;\n${functions}`, context);
  return { store, buttons, writes, messages, errors, run: () => context.completeAllOverdue(),
    get items() { return items; }, update: fn => { items = fn(items); },
    switchOwner() { store.mode = "cloud"; store.user = { id: "new-owner" }; vm.runInContext("plannerOwnerVersion++", context); } };
}

test("one action completes past deadlines, including earlier today, while preserving other task details", async () => {
  const rows = [overdue("past-day"), { ...overdue("earlier-today"), dueDate: "2026-11-20", dueTime: "12:00", scheduledStart: "2026-11-21T09:00", notes: "Keep me" },
    { ...overdue("today-date-only"), dueDate: "2026-11-20" }, { ...overdue("exact-now"), dueDate: "2026-11-20", dueTime: "13:00" },
    { ...overdue("future"), dueDate: "2026-11-21" }, { ...overdue("done"), completed: true },
    { ...overdue("deleted"), deleted_at: "2026-11-19" }, { ...overdue("no-deadline"), dueDate: "", scheduledStart: "2026-11-18T09:00" }];
  const h = harness(rows); await h.run();
  assert.deepEqual(h.writes, ["past-day", "earlier-today"]);
  assert.deepEqual(h.items, rows.map(t => ["past-day", "earlier-today"].includes(t.id) ? { ...t, completed: true } : t));
  assert.deepEqual(h.messages, ["Completed 2 overdue tasks."]);
  assert.ok(h.buttons.every(b => b.hidden && b.disabled && b["aria-busy"] === "false"));
});

test("repeated clicks cannot duplicate work and requests run serially", async () => {
  const gate = deferred(), h = harness([overdue("one"), overdue("two")], async id => { if (id === "one") await gate.promise; });
  const pending = h.run(); await h.run();
  assert.deepEqual(h.writes, ["one"]);
  assert.ok(h.buttons.every(b => b.disabled && b["aria-busy"] === "true"));
  gate.resolve(); await pending; assert.deepEqual(h.writes, ["one", "two"]);
});

test("a changed deadline, deletion or completion is rechecked and newly overdue tasks are not added mid-run", async () => {
  const gate = deferred(), h = harness([overdue("one"), overdue("moved"), overdue("removed"), overdue("done")], async id => { if (id === "one") await gate.promise; });
  const pending = h.run();
  h.update(rows => rows.filter(t => t.id !== "removed").map(t => t.id === "moved" ? { ...t, dueDate: "2026-11-22" } : t.id === "done" ? { ...t, completed: true } : t).concat(overdue("new")));
  gate.resolve(); await pending; assert.deepEqual(h.writes, ["one"]);
  assert.equal(h.items.find(t => t.id === "new").completed, false);
});

test("account changes stop queued writes and suppress old-owner feedback", async () => {
  const gate = deferred(), h = harness([overdue("one"), overdue("two")], async () => gate.promise);
  const pending = h.run(); h.switchOwner(); gate.resolve(); await pending;
  assert.deepEqual(h.writes, ["one"]); assert.deepEqual(h.messages, []); assert.deepEqual(h.errors, []);
});

test("a save failure stops the queue, retains successful completions and allows retry", async () => {
  let fail = true; const h = harness([overdue("one"), overdue("two"), overdue("three")], async id => { if (id === "two" && fail) throw Error("Network unavailable."); });
  await h.run(); assert.deepEqual(h.writes, ["one", "two"]);
  assert.deepEqual(h.items.map(t => t.completed), [true, false, false]);
  assert.match(h.errors[0], /Completed 1 overdue task before stopping.*Network unavailable.*Remaining tasks are still open/);
  assert.ok(h.buttons.every(b => !b.disabled)); fail = false; await h.run();
  assert.deepEqual(h.writes, ["one", "two", "two", "three"]);
  assert.deepEqual(h.messages, ["Completed 2 overdue tasks."]);
});

test("no overdue tasks produces no write, while both entry points remain independent of task search and filters", async () => {
  const h = harness([]); await h.run(); assert.deepEqual(h.writes, []);
  const html = fs.readFileSync("landing/index.html", "utf8");
  assert.equal((html.match(/data-complete-overdue hidden/g) || []).length, 2);
  assert.ok(h.buttons.every(b => b.hidden && b.disabled));
});
