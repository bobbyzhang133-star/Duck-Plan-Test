const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("../landing/planner-model.js");
const Store = require("../landing/planner-store.js");

function memoryStorage() {
  const data = new Map();
  return { data, full: false, getItem(key) { return data.get(key) ?? null; }, setItem(key, value) { if (this.full) throw new Error("Quota exceeded"); data.set(key, String(value)); }, removeItem(key) { data.delete(key); } };
}
function makeStore(storage, options = {}) {
  return Store.createPlannerStore({ storage, model: Model, defaultClasses: () => [], defaultTasks: () => [], documentRef: null, ...options });
}
async function cloudHarness({ legacyPersonal = false } = {}) {
  const [{ handleRequest }, { createFakeEnv, createCtx, ORIGIN }] = await Promise.all([import("../cloudflare/src/index.js"), import("./support/fake-cloudflare.mjs")]);
  const fake = createFakeEnv(), ctx = createCtx(), storage = memoryStorage(), requests = [], sockets = [], jar = { value: null }, network = {};
  class Socket { constructor() { sockets.push(this); } close() { this.closed = true; } send() {} receive(message) { this.onmessage({ data: JSON.stringify(message) }); } }
  const fetchImpl = async (url, init = {}) => {
    const request = { path: new URL(url, ORIGIN).pathname, method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
    requests.push(request);
    const headers = { ...init.headers, Origin: ORIGIN };
    if (jar.value) headers.Cookie = jar.value;
    if (network.intercept) { const replacement = await network.intercept(request); if (replacement) return replacement; }
    const response = await handleRequest(new Request(new URL(url, ORIGIN), { ...init, headers }), fake.env, ctx);
    await ctx.settle();
    const cookie = response.headers.get("set-cookie");
    if (cookie?.startsWith("duckplan_session=")) jar.value = cookie.includes("Max-Age=0") ? null : cookie.split(";")[0];
    if (legacyPersonal && request.path === "/api/planner" && response.ok) {
      const { goals, habits, habit_checkins, notes, ...old } = await response.json();
      return new Response(JSON.stringify(old));
    }
    return response;
  };
  const create = () => makeStore(storage, { config: { apiUrl: "/api" }, fetchImpl, WebSocketImpl: Socket, locationRef: { href: `${ORIGIN}/#goals` } });
  const store = create(); await store.init();
  return { ...fake, storage, store, create, requests, sockets, network };
}

test("personal local data starts empty, saves goals/habits/notes and check-ins, and never restores deleted samples", async () => {
  const storage = memoryStorage(), store = makeStore(storage); await store.init();
  assert.equal(store.supportsPersonal, true);
  assert.deepEqual([store.listGoals(), store.listHabits(), store.listHabitCheckins(), store.listNotes()], [[], [], [], []]);
  const goal = await store.upsertGoal({ title: "Study practice", targetCount: 7, currentCount: 2, unit: "sessions", deadlineDate: "2026-12-01" });
  const habit = await store.upsertHabit({ title: "Read", repeatDays: [5, 1, 3], notes: "A chapter" });
  const note = await store.upsertNote({ title: "Ideas", category: "", body: "  First line\n\nSecond line  " });
  await store.setHabitCheckin(habit.id, "2026-11-12", true);
  await store.setHabitCheckin(habit.id, "2026-11-12", true);
  assert.equal(store.listHabitCheckins().length, 1);
  const reload = makeStore(storage); await reload.init();
  assert.deepEqual(reload.listGoals(), [goal]);
  assert.deepEqual(reload.listHabits()[0].repeatDays, [1, 3, 5]);
  assert.equal(reload.listNotes()[0].body, note.body);
  assert.equal(reload.listNotes()[0].category, "Personal");
  assert.ok(!Number.isNaN(Date.parse(reload.listNotes()[0].createdAt)));
  await reload.resetLocalDemo();
  assert.equal(reload.listGoals().length, 1, "the legacy task-demo reset does not delete saved personal data");
  assert.equal(reload.listHabitCheckins().length, 1);
  assert.equal(reload.listNotes().length, 1);
  const edited = await reload.upsertNote({ ...reload.listNotes()[0], title: "Edited note" });
  assert.equal(edited.createdAt, note.createdAt);
  await reload.setHabitCheckin(habit.id, "2026-11-12", false);
  assert.deepEqual(reload.listHabitCheckins(), []);
  await reload.setHabitCheckin(habit.id, "2026-11-13", true);
  await reload.deleteHabit(habit.id);
  await reload.deleteGoal(goal.id); await reload.deleteNote(note.id);
  const empty = makeStore(storage); await empty.init();
  assert.deepEqual([empty.listGoals(), empty.listHabits(), empty.listHabitCheckins(), empty.listNotes()], [[], [], [], []]);
});

test("personal validation enforces real dates, bounded progress, repeat days and text limits", async () => {
  const store = makeStore(memoryStorage()); await store.init();
  for (const fields of [{ targetCount: 0 }, { targetCount: 100001 }, { currentCount: -1 }, { currentCount: 1.5 }, { unit: "" }, { deadlineDate: "2026-02-30" }, { title: "x".repeat(101) }]) await assert.rejects(store.upsertGoal({ title: "Goal", ...fields }));
  for (const repeatDays of [[], [1, 1], [7], [-1], ["1"], [2.5]]) await assert.rejects(store.upsertHabit({ title: "Habit", repeatDays }), /days/);
  const habit = await store.upsertHabit({ title: "Daily" });
  await assert.rejects(store.setHabitCheckin(habit.id, "2026-02-30", true), /date/);
  await assert.rejects(store.setHabitCheckin("missing", "2026-11-12", true), /habit/);
  await assert.rejects(store.setHabitCheckin(habit.id, "2026-11-12", "yes"), /completed/);
  await assert.rejects(store.upsertNote({ title: "Note", body: "x".repeat(5001) }), /5000/);
  await store.upsertGoal({ title: "Leap goal", deadlineDate: "2028-02-29", currentCount: 8, targetCount: 5 });
  assert.equal(store.listGoals()[0].currentCount, 8, "progress may exceed the target without losing the recorded count");
});

test("quota failures roll back a habit deletion and all dependent check-ins together", async () => {
  const storage = memoryStorage(), store = makeStore(storage); await store.init();
  const habit = await store.upsertHabit({ title: "Walk" });
  await store.setHabitCheckin(habit.id, "2026-11-12", true);
  const goal = await store.upsertGoal({ title: "Saved goal" });
  const note = await store.upsertNote({ title: "Saved note", body: "Keep me" });
  storage.full = true;
  for (const attempt of [() => store.deleteHabit(habit.id), () => store.setHabitCheckin(habit.id, "2026-11-13", true), () => store.upsertGoal({ ...goal, currentCount: 3 }), () => store.deleteNote(note.id)]) await assert.rejects(attempt(), /Couldn't save/);
  assert.equal(store.listHabits().length, 1); assert.equal(store.listHabitCheckins().length, 1);
  assert.equal(store.listGoals()[0].currentCount, 0); assert.equal(store.listNotes()[0].body, "Keep me");
  storage.full = false;
  const reload = makeStore(storage); await reload.init();
  assert.equal(reload.listHabits().length, 1); assert.equal(reload.listHabitCheckins().length, 1);
});

test("personal imports use fresh IDs and remap every habit check-in to its imported habit", () => {
  let id = 0;
  const plan = Store.planLocalImport({ localTasks: [], localClasses: [], cloudClasses: [], makeId: () => `fresh-${++id}`,
    localGoals: [{ id: "goal", title: "Goal", targetCount: 3, currentCount: 1, unit: "books" }],
    localHabits: [{ id: "habit", title: "Read", repeatDays: [1, 2] }],
    localHabitCheckins: [{ habitId: "habit", date: "2026-11-12", completed: true }],
    localNotes: [{ id: "note", title: "Note", category: "Ideas", body: "Text" }],
  });
  assert.deepEqual([plan.goalRows[0].id, plan.habitRows[0].id, plan.noteRows[0].id], ["fresh-1", "fresh-2", "fresh-3"]);
  assert.equal(plan.habitCheckinRows[0].habit_id, "fresh-2");
  assert.equal(plan.goalRows[0].current_count, 1);
});

test("empty personal lists preserve the pre-personal import fingerprint for existing receipts", async () => {
  const state = { classes: [], tasks: [], templates: [], resources: [], organizationConfigured: false };
  assert.equal(await Store.localImportFingerprint({ ...state, goals: [], habits: [], habitCheckins: [], notes: [] }), "8d2ed413fc84b28f0aa530e8bae95d4048b0c95009a15d5c5c42e0b9e686123d");
  assert.notEqual(await Store.localImportFingerprint({ ...state, goals: [{ id: "g", title: "Saved goal" }] }), await Store.localImportFingerprint(state));
});

test("cloud personal CRUD round-trips through the real Worker and live rows, including habit deletion cleanup", async () => {
  const app = await cloudHarness(), { store } = app;
  await store.signUp("personal@store.test", "planner test password");
  assert.equal(store.supportsPersonal, true);
  const goal = await store.upsertGoal({ title: "Read books", targetCount: 4, currentCount: 1, unit: "books", deadlineDate: "2026-12-10" });
  const habit = await store.upsertHabit({ title: "Plan day", repeatDays: [6, 0] });
  const note = await store.upsertNote({ title: "Class notes", category: "Physics", body: "  Keep spacing\n  here" });
  await store.setHabitCheckin(habit.id, "2026-11-12", true);
  await store.refresh();
  assert.deepEqual(store.listGoals(), [goal]);
  assert.deepEqual(store.listHabits()[0].repeatDays, [0, 6]);
  assert.deepEqual(store.listHabitCheckins(), [{ habitId: habit.id, date: "2026-11-12", completed: true }]);
  assert.equal(store.listNotes()[0].body, note.body);
  assert.ok(store.listNotes()[0].createdAt);
  const socket = app.sockets.at(-1);
  socket.receive({ table: "goals", row: { ...Store.goalToRow(goal), current_count: 3 } });
  socket.receive({ table: "notes", row: { ...Store.noteToRow(note), deleted_at: "2026-11-12T12:00:00Z" } });
  assert.equal(store.listGoals()[0].currentCount, 3); assert.deepEqual(store.listNotes(), []);
  socket.receive({ table: "habits", row: { ...Store.habitToRow(habit), deleted_at: "2026-11-12T12:00:00Z" } });
  assert.deepEqual(store.listHabitCheckins(), []);
  await store.refresh();
  await store.setHabitCheckin(habit.id, "2026-11-12", false);
  await store.refresh(); assert.deepEqual(store.listHabitCheckins(), []);
  await store.setHabitCheckin(habit.id, "2026-11-13", true);
  await store.deleteHabit(habit.id); await store.deleteGoal(goal.id); await store.deleteNote(note.id);
  await store.refresh();
  assert.deepEqual([store.listGoals(), store.listHabits(), store.listHabitCheckins(), store.listNotes()], [[], [], [], []]);
});

test("personal local imports remain idempotent when a storage-full browser retries with fresh remapped IDs", async () => {
  const app = await cloudHarness(), { store } = app;
  await store.upsertGoal({ title: "Goal", targetCount: 6, currentCount: 2 });
  const habit = await store.upsertHabit({ title: "Habit" });
  await store.setHabitCheckin(habit.id, "2026-11-12", true);
  await store.upsertNote({ title: "Note", body: "Persist" });
  await store.signUp("personal-import@store.test", "planner test password");
  app.storage.full = true;
  assert.equal(await store.localImportOffer(), 4);
  await store.importLocalTasks();
  const ids = [store.listGoals()[0].id, store.listHabits()[0].id, store.listNotes()[0].id];
  assert.notEqual(ids[1], habit.id);
  assert.equal(store.listHabitCheckins()[0].habitId, ids[1]);
  const reload = app.create(); await reload.init(); await reload.importLocalTasks();
  assert.deepEqual([reload.listGoals().length, reload.listHabits().length, reload.listHabitCheckins().length, reload.listNotes().length], [1, 1, 1, 1]);
  assert.deepEqual([reload.listGoals()[0].id, reload.listHabits()[0].id, reload.listNotes()[0].id], ids);
  const attempts = app.requests.filter((request) => request.path === "/api/import");
  assert.equal(attempts[0].body.idempotencyKey, attempts[1].body.idempotencyKey);
});

test("older organization-enabled servers cannot silently discard personal data or accept unsupported personal writes", async () => {
  const app = await cloudHarness({ legacyPersonal: true }), { store } = app;
  await store.upsertNote({ title: "Local only", body: "Keep safe" });
  await store.signUp("legacy-personal@store.test", "planner test password");
  assert.equal(store.supportsOrganization, true); assert.equal(store.supportsPersonal, false);
  await assert.rejects(store.upsertGoal({ title: "Unsupported" }), /available/);
  await assert.rejects(store.importLocalTasks(), /server can't import/);
  assert.equal(app.requests.some((request) => request.path === "/api/import"), false);
  await store.signOut(); assert.equal(store.listNotes()[0].body, "Keep safe");
});

test("account switches clear saved personal state and ignore retired personal live callbacks", async () => {
  const app = await cloudHarness(), { store } = app;
  await store.signUp("first-personal@store.test", "planner test password");
  await store.upsertGoal({ title: "Private goal" });
  const habit = await store.upsertHabit({ title: "Private habit" });
  await store.setHabitCheckin(habit.id, "2026-11-12", true);
  const note = await store.upsertNote({ title: "Private note", body: "Private content" });
  const socket = app.sockets.at(-1);
  await store.signOut(); await store.signUp("second-personal@store.test", "planner test password");
  socket.receive({ table: "notes", row: Store.noteToRow(note) });
  assert.deepEqual([store.listGoals(), store.listHabits(), store.listHabitCheckins(), store.listNotes()], [[], [], [], []]);
});
