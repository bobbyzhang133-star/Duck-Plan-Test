const test = require("node:test");
const assert = require("node:assert/strict");
const Demo = require("../landing/completion-demo.js");
const Model = require("../landing/planner-model.js");
const Alerts = require("../landing/work-alerts.js");

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), values };
}
const location = { hostname: "127.0.0.1", search: "?demo=completion-20261122" };

test("ordinary previews, hosted sites and cloud/native configurations use the original storage", () => {
  const s = storage();
  for (const input of [{ location: { ...location, search: "" } }, { location: { ...location, hostname: "duckplan.example" } }, { location, cloud: { apiUrl: "/api" } }, { location, cloud: { native: true } }]) {
    const config = Demo.configure({ storage: s, ...input });
    assert.equal(config.enabled, false); assert.equal(config.storage, s);
  }
});

test("sample records are isolated from real planner records and other sample batches", () => {
  const s = storage(); s.setItem("duckplan-demo-tasks-v1", "real records");
  const a = Demo.configure({ location, storage: s });
  const b = Demo.configure({ location: { ...location, search: "?demo=completion-20261122-2" }, storage: s });
  a.storage.setItem("duckplan-demo-tasks-v1", "sample records");
  assert.equal(s.getItem("duckplan-demo-tasks-v1"), "real records");
  assert.equal(b.storage.getItem("duckplan-demo-tasks-v1"), null);
  a.storage.removeItem("duckplan-demo-tasks-v1");
  assert.equal(s.getItem("duckplan-demo-tasks-v1"), "real records");
});

test("reloading samples preserves completed work and never duplicates or enables reminders", async () => {
  const tasks = [];
  const store = { mode: "local", user: null, listClasses: () => [], listItems: () => tasks, upsertItem: async task => tasks.push(task) };
  const demo = Demo.configure({ location, storage: storage() });
  assert.equal(await Demo.seed({ demo, store, model: Model, alerts: Alerts }), 8);
  tasks[0].completed = true;
  assert.equal(await Demo.seed({ demo, store, model: Model, alerts: Alerts }), 0);
  assert.equal(tasks.length, 8); assert.equal(tasks[0].completed, true);
  assert.ok(tasks.every(task => !task.workAlerts.alarm.enabled && !task.workAlerts.notification.enabled && task.reminderChoice === "off"));
});

test("sample seeding does not write to a signed-in account", async () => {
  let writes = 0;
  const store = { mode: "cloud", user: { id: "account" }, upsertItem: async () => { writes += 1; } };
  assert.equal(await Demo.seed({ demo: { enabled: true }, store, model: Model, alerts: Alerts }), 0);
  assert.equal(writes, 0);
});
