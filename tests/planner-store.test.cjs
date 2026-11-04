const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("../landing/planner-model.js");
const Store = require("../landing/planner-store.js");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key), data };
}
const defaultClasses = () => [
  { id: "calculus", name: "Calculus", color: "#538fc5", code: "M", teacher: "Ms. Nguyen", period: "Period 2" },
  { id: "personal", name: "Personal", color: "#c48b34", code: "★", teacher: "Personal", period: "Anytime" },
];
const defaultTasks = () => [{ id: "demo-1", title: "Demo", className: "Calculus", dueDate: "2026-10-30", dueTime: "17:00", priority: "High", completed: false }];

function makeStore(options = {}) {
  return Store.createPlannerStore({ storage: options.storage || memoryStorage(), model: Model, defaultClasses, defaultTasks, ...options });
}

test("maps database rows to planner tasks and back without losing the deadline/schedule split", () => {
  const row = { id: "a", class_id: "c", type: "test", title: "Quiz", notes: "", priority: "high", due_date: "2026-11-03", due_time: "08:30:00", scheduled_start: "2026-11-02T19:00:00", duration_minutes: 60, completed: false, source: "axis", axis_missing: false };
  const task = Store.rowToTask(row);
  assert.equal(task.priority, "High");
  assert.equal(task.dueTime, "08:30");
  assert.equal(task.scheduledStart, "2026-11-02T19:00");
  const back = Store.taskToRow(task);
  assert.equal(back.priority, "high");
  assert.equal(back.due_date, "2026-11-03");
  assert.equal(back.scheduled_start, "2026-11-02T19:00");
  assert.ok(!("source" in back) && !("axis_uid" in back), "the browser never rewrites Axis bookkeeping");
  assert.equal(Store.taskToRow({ title: "x", dueDate: "", dueTime: "" }).due_date, null);
});

test("softColor tints a class color toward white", () => {
  assert.equal(Store.softColor("#000000"), "#d6d6d6");
  assert.equal(Store.softColor("bad"), Store.NO_CLASS.soft);
});

test("range filtering matches either the deadline or the scheduled work date", () => {
  const task = { dueDate: "2026-11-10", scheduledStart: "2026-11-02T10:00" };
  assert.equal(Store.taskInRange(task, { from: "2026-11-01", to: "2026-11-03" }), true);
  assert.equal(Store.taskInRange(task, { from: "2026-11-04", to: "2026-11-09" }), false);
  assert.equal(Store.taskInRange(task), true);
});

test("local mode migrates legacy className tasks to class ids and persists edits", async () => {
  const legacy = [{ id: "old", title: "Old", className: "Calculus", dueDate: "2026-10-30", dueTime: "09:00" }];
  const storage = memoryStorage({ "duckplan-demo-tasks-v1": JSON.stringify(legacy) });
  const store = makeStore({ storage });
  await store.init();
  assert.equal(store.mode, "local");
  const [task] = store.listItems();
  assert.equal(task.classId, "calculus");
  assert.equal(task.scheduledStart, null, "migration never invents a schedule from a due time");
  assert.equal(store.classById(task.classId).name, "Calculus");

  const added = await store.upsertItem({ title: "New", classId: "personal", dueDate: "2026-10-31" });
  await store.toggleComplete("old", true);
  const saved = JSON.parse(storage.getItem("duckplan-demo-tasks-v1"));
  assert.equal(saved.length, 2);
  assert.equal(saved.find((item) => item.id === "old").completed, true);
  assert.match(added.id, /^[0-9a-f-]{36}$/);
  await store.deleteItem(added.id);
  assert.equal(JSON.parse(storage.getItem("duckplan-demo-tasks-v1")).length, 1);
});

test("without a cloud API the store stays local and account calls explain why", async () => {
  const store = makeStore({ config: { apiUrl: "" } });
  await store.init();
  assert.equal(store.configured, false);
  await assert.rejects(store.signInWithEmail("a@b.test"), /isn't set up/);
  assert.deepEqual(await store.axisStatus(), { connected: false, lastSyncedAt: null, lastError: null });
});

test("planLocalImport reuses classes by name, creates the rest, and remaps every task", () => {
  let next = 0;
  const plan = Store.planLocalImport({
    localTasks: [{ id: "t1", title: "A", classId: "calculus", scheduledStart: null, dueDate: "2026-11-01", dueTime: "17:00" }, { id: "t2", title: "B", classId: "personal" }],
    localClasses: defaultClasses(),
    cloudClasses: [{ id: "cloud-calc", name: "calculus" }],
    makeId: () => `id-${++next}`,
  });
  assert.deepEqual(plan.classRows.map((row) => [row.id, row.name]), [["id-1", "Personal"]]);
  assert.deepEqual(plan.itemRows.map((row) => [row.id, row.class_id]), [["id-2", "cloud-calc"], ["id-3", "id-1"]]);
  assert.equal(plan.itemRows[0].scheduled_start, null);
});

// Cloud mode (sign-in, D1 writes, live updates, local-task import) is tested against the real
// Worker in tests/cloudflare-worker.test.mjs.
