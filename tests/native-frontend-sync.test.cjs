const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Store = require("../landing/planner-store.js");
const Model = require("../landing/planner-model.js");

test("synced personal and organization features use the native JSON transport without browser networking", async () => {
  const calls = [];
  const apiUrl = "https://duckplan.duckplan-cloudflare.workers.dev/api";
  const native = {
    apiUrl,
    async request(request) {
      calls.push(request);
      const path = new URL(request.url).pathname;
      const body = path === "/api/session"
        ? { user: { id: "synthetic-native-owner", email: "fixture@example.test" }, providers: { google: true } }
        : path === "/api/planner"
          ? { classes: [], items: [], templates: [], resources: [], organization: { urgency_days: 2 }, goals: [], habits: [], habit_checkins: [], notes: [] }
          : {};
      return { status: 200, body: JSON.stringify(body) };
    },
  };
  const window = { DuckNativeCloud: native, fetch: () => { throw new Error("Unexpected browser network request"); } };
  const context = { window, location: { href: "file:///app/landing/index.html" }, URL, Response };
  vm.runInNewContext(fs.readFileSync("landing/native-cloud.js", "utf8"), context);
  vm.runInNewContext(fs.readFileSync("landing/cloud-config.js", "utf8"), context);
  const storage = new Map();
  const store = Store.createPlannerStore({
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    model: Model, defaultClasses: () => [], defaultTasks: () => [],
    config: window.DUCKPLAN_CLOUD, fetchImpl: window.fetch, WebSocketImpl: null,
  });
  await store.init();
  assert.equal(store.mode, "cloud");
  assert.equal(store.supportsOrganization, true);
  assert.equal(store.supportsPersonal, true);
  assert.equal(store.providers.google, false);
  await assert.rejects(store.signInWithGoogle(), /email and password/);

  const course = await store.upsertClass({ name: "Synthetic class", color: "#538fc5" });
  const template = await store.upsertTemplate({ title: "Reading template", classId: course.id, durationMinutes: 20, priority: "High", notes: "Keep the saved instructions", reminderChoice: "60" });
  const resource = await store.upsertResource({ classId: course.id, title: "Study guide", url: "https://example.test/guide", category: "Handout", description: "Synthetic link", sortOrder: 0 });
  const goal = await store.upsertGoal({ title: "Revision", targetCount: 5, currentCount: 2, unit: "sessions" });
  const habit = await store.upsertHabit({ title: "Read", repeatDays: [1, 2, 3, 4, 5] });
  const date = Model.todayKey();
  await store.setHabitCheckin(habit.id, date, true);
  const note = await store.upsertNote({ title: "Class ideas", category: "School", body: "A saved note" });
  await store.saveOrganizationPreferences({ urgencyDays: 3 });
  assert.equal(store.listTemplates()[0].notes, "Keep the saved instructions");
  assert.equal(store.listHabitCheckins({ habitId: habit.id })[0].completed, true);
  assert.equal(store.listNotes()[0].body, "A saved note");
  await store.deleteTemplate(template.id);
  await store.deleteResource(resource.id);
  await store.deleteGoal(goal.id);
  await store.deleteHabit(habit.id);
  await store.deleteNote(note.id);

  for (const [path, methods] of [
    [`classes/${course.id}`, ["PUT"]], [`task-templates/${template.id}`, ["PUT", "DELETE"]],
    [`class-resources/${resource.id}`, ["PUT", "DELETE"]], [`goals/${goal.id}`, ["PUT", "DELETE"]],
    [`habits/${habit.id}`, ["PUT", "DELETE"]], [`habit-checkins/${habit.id}/${date}`, ["PUT"]],
    [`notes/${note.id}`, ["PUT", "DELETE"]],
    ["organization-preferences", ["PUT"]],
  ]) {
    for (const method of methods) assert.ok(calls.some(call => call.url === `${apiUrl}/${path}` && call.method === method), `${method} ${path}`);
  }
  const savedTemplate = JSON.parse(calls.find(call => call.method === "PUT" && call.url.endsWith(`/task-templates/${template.id}`)).body);
  assert.equal(savedTemplate.duration_minutes, 20);
  assert.equal(savedTemplate.notes, "Keep the saved instructions");
  assert.equal(savedTemplate.reminder_choice, "60");
  assert.ok(calls.every(call => new URL(call.url).origin === new URL(apiUrl).origin));
});
