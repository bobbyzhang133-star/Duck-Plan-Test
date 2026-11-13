import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../cloudflare/src/index.js";
import { ORIGIN, createCtx, createFakeEnv } from "./support/fake-cloudflare.mjs";

const uuid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function setup() {
  const fake = createFakeEnv(), ctx = createCtx();
  async function call(route, { method = "GET", cookie, body, origin = ORIGIN } = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (method !== "GET" && origin) headers.Origin = origin;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await handleRequest(new Request(`${ORIGIN}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), fake.env, ctx);
    await ctx.settle();
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function account(email = "a@personal.test") {
    const result = await call("/api/auth/sign-up", { method: "POST", body: { email, password: "personal test password" } });
    assert.equal(result.status, 201);
    return { user: result.data.user, cookie: result.headers.get("set-cookie").split(";")[0] };
  }
  const planner = async (cookie) => (await call("/api/planner", { cookie })).data;
  return { ...fake, call, account, planner };
}

test("personal routes require an account, same-origin writes and valid IDs", async () => {
  const app = setup();
  for (const route of [`/api/goals/${uuid(1)}`, `/api/habits/${uuid(2)}`, `/api/notes/${uuid(3)}`, `/api/habit-checkins/${uuid(2)}/2026-11-12`]) {
    assert.equal((await app.call(route, { method: "PUT", body: { title: "Private", completed: true } })).status, 401);
  }
  const { cookie } = await app.account();
  assert.equal((await app.call(`/api/goals/${uuid(1)}`, { method: "PUT", cookie, origin: "https://elsewhere.test", body: { title: "Private" } })).status, 403);
  assert.equal((await app.call("/api/notes/not-a-uuid", { method: "DELETE", cookie })).status, 400);
  assert.equal((await app.call("/api/habits/%FF", { method: "PUT", cookie, body: { title: "Private" } })).status, 400);
  const data = await app.planner(cookie);
  assert.deepEqual([data.goals, data.habits, data.habit_checkins, data.notes], [[], [], [], []]);
});

test("goals persist progress, valid deadlines and defaults, broadcast updates and never resurrect deleted IDs", async () => {
  const app = setup(), { cookie, user } = await app.account();
  const route = `/api/goals/${uuid(1)}`;
  const first = await app.call(route, { method: "PUT", cookie, body: { title: " Read chapters ", user_id: "spoof" } });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.deepEqual([first.data.goal.title, first.data.goal.target_count, first.data.goal.current_count, first.data.goal.unit, first.data.goal.deadline_date], ["Read chapters", 5, 0, "sessions", null]);
  const saved = await app.call(route, { method: "PUT", cookie, body: { ...first.data.goal, target_count: 12, current_count: 3, unit: "chapters", notes: "Before the exam", deadline_date: "2028-02-29" } });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.goal.created_at, first.data.goal.created_at);
  assert.equal(saved.data.goal.user_id, user.id);
  assert.deepEqual(app.broadcasts.at(-1), { userId: user.id, message: { table: "goals", row: saved.data.goal } });
  assert.equal((await app.planner(cookie)).goals[0].current_count, 3);
  const deleted = await app.call(route, { method: "DELETE", cookie });
  assert.ok(deleted.data.goal.deleted_at);
  assert.deepEqual((await app.planner(cookie)).goals, []);
  assert.equal((await app.call(route, { method: "DELETE", cookie })).data.goal, null);
  assert.equal((await app.call(route, { method: "PUT", cookie, body: { title: "Revive" } })).status, 404);
});

test("personal field validation rejects invalid limits, repeat days and impossible calendar dates", async () => {
  const app = setup(), { cookie } = await app.account();
  for (const fields of [{ title: "" }, { title: "x".repeat(101) }, { notes: "x".repeat(5001) }, { target_count: 0 }, { target_count: 100001 }, { target_count: 1.5 }, { current_count: -1 }, { current_count: 100001 }, { unit: "" }, { unit: "x".repeat(31) }, { deadline_date: "2026-02-29" }, { deadline_date: "2026-11-31" }]) {
    assert.equal((await app.call(`/api/goals/${uuid(1)}`, { method: "PUT", cookie, body: { title: "Goal", ...fields } })).status, 400);
  }
  for (const fields of [{ repeat_days: [] }, { repeat_days: [1, 1] }, { repeat_days: [7] }, { repeat_days: [-1] }, { repeat_days: [1.5] }, { repeat_days: ["1"] }, { repeat_days: "bad-json" }, { notes: "x".repeat(2001) }]) {
    assert.equal((await app.call(`/api/habits/${uuid(2)}`, { method: "PUT", cookie, body: { title: "Habit", ...fields } })).status, 400);
  }
  for (const fields of [{ title: "" }, { title: "x".repeat(101) }, { body: "x".repeat(5001) }, { category: "x".repeat(61) }]) {
    assert.equal((await app.call(`/api/notes/${uuid(3)}`, { method: "PUT", cookie, body: { title: "Note", ...fields } })).status, 400);
  }
});

test("notes preserve text formatting, use server timestamps and broadcast soft-deletes", async () => {
  const app = setup(), { cookie, user } = await app.account();
  const route = `/api/notes/${uuid(3)}`, body = "  An indented thought\n\nAnother paragraph.\n";
  const first = await app.call(route, { method: "PUT", cookie, body: { title: "Class notes", body, created_at: "fake", updated_at: "fake" } });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.note.category, "Personal");
  assert.equal(first.data.note.body, body);
  assert.notEqual(first.data.note.created_at, "fake");
  const edited = await app.call(route, { method: "PUT", cookie, body: { title: "Updated", category: "Ideas", body } });
  assert.equal(edited.data.note.created_at, first.data.note.created_at);
  assert.equal((await app.planner(cookie)).notes[0].title, "Updated");
  assert.deepEqual(app.broadcasts.at(-1), { userId: user.id, message: { table: "notes", row: edited.data.note } });
  assert.ok((await app.call(route, { method: "DELETE", cookie })).data.note.deleted_at);
  assert.deepEqual((await app.planner(cookie)).notes, []);
  assert.equal((await app.call(route, { method: "PUT", cookie, body: { title: "Revive" } })).status, 404);
});

test("habit check-ins toggle once per date, accept future local dates and clear when their habit is deleted", async () => {
  const app = setup(), { cookie, user } = await app.account();
  const habitRoute = `/api/habits/${uuid(2)}`, date = "2099-12-31", checkinRoute = `/api/habit-checkins/${uuid(2)}/${date}`;
  const habit = await app.call(habitRoute, { method: "PUT", cookie, body: { title: "Read", repeat_days: [5, 1, 3] } });
  assert.equal(habit.status, 200, JSON.stringify(habit.data));
  assert.equal(habit.data.habit.repeat_days, "[1,3,5]");
  const first = await app.call(checkinRoute, { method: "PUT", cookie, body: { completed: true } });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const again = await app.call(checkinRoute, { method: "PUT", cookie, body: { completed: true } });
  assert.equal(again.data.checkin.created_at, first.data.checkin.created_at);
  assert.equal((await app.planner(cookie)).habit_checkins.length, 1);
  assert.deepEqual(app.broadcasts.at(-1), { userId: user.id, message: { table: "habit_checkins", row: again.data.checkin } });
  const undone = await app.call(checkinRoute, { method: "PUT", cookie, body: { completed: false } });
  assert.ok(undone.data.checkin.deleted_at);
  assert.equal(undone.data.checkin.completed, 0);
  assert.deepEqual((await app.planner(cookie)).habit_checkins, []);
  assert.equal((await app.call(checkinRoute, { method: "PUT", cookie, body: { completed: false } })).data.checkin, null);
  await app.call(checkinRoute, { method: "PUT", cookie, body: { completed: true } });
  assert.equal((await app.planner(cookie)).habit_checkins.length, 1);
  for (const invalid of ["2026-02-30", "not-a-date", "2026-00-01"]) assert.equal((await app.call(`/api/habit-checkins/${uuid(2)}/${invalid}`, { method: "PUT", cookie, body: { completed: true } })).status, 400);
  assert.equal((await app.call(checkinRoute, { method: "PUT", cookie, body: { completed: 1 } })).status, 400);
  await app.call(habitRoute, { method: "DELETE", cookie });
  const data = await app.planner(cookie);
  assert.deepEqual([data.habits, data.habit_checkins], [[], []]);
  assert.ok(app.broadcasts.some((entry) => entry.message.table === "habit_checkins" && entry.message.row.deleted_at));
  assert.equal((await app.call(checkinRoute, { method: "PUT", cookie, body: { completed: true } })).status, 404);
});

test("personal rows and check-ins cannot be read, overwritten or linked across accounts", async () => {
  const app = setup(), a = await app.account(), b = await app.account("b@personal.test");
  for (const [table, number] of [["goals", 1], ["habits", 2], ["notes", 3]]) {
    await app.call(`/api/${table}/${uuid(number)}`, { method: "PUT", cookie: a.cookie, body: { title: "A private record" } });
    assert.equal((await app.call(`/api/${table}/${uuid(number)}`, { method: "PUT", cookie: b.cookie, body: { title: "Take over" } })).status, 404);
    assert.equal((await app.call(`/api/${table}/${uuid(number)}`, { method: "DELETE", cookie: b.cookie })).data[table === "habits" ? "habit" : table.slice(0, -1)], null);
  }
  assert.equal((await app.call(`/api/habit-checkins/${uuid(2)}/2026-11-12`, { method: "PUT", cookie: b.cookie, body: { completed: true } })).status, 404);
  const data = await app.planner(b.cookie);
  assert.deepEqual([data.goals, data.habits, data.habit_checkins, data.notes], [[], [], [], []]);
  const db = app.env.DB.raw;
  assert.throws(() => db.prepare("INSERT INTO habit_checkins (user_id, habit_id, date) VALUES (?, ?, '2026-11-12')").run(b.user.id, uuid(2)), /not owned/);
  for (const [table, number] of [["goals", 1], ["habits", 2], ["notes", 3]]) assert.throws(() => db.prepare(`UPDATE ${table} SET user_id = ? WHERE id = ?`).run(b.user.id, uuid(number)), /cannot change owner/);
  assert.throws(() => db.prepare("INSERT INTO habits (id,user_id,title,repeat_days) VALUES (?,?,'Bad','[1,1]')").run(uuid(4), a.user.id), /repeat days/);
});

function personalImport(offset, key) {
  return {
    idempotencyKey: key,
    goalRows: [{ id: uuid(offset + 1), title: "Imported goal", target_count: 7, current_count: 2 }],
    habitRows: [{ id: uuid(offset + 2), title: "Imported habit", repeat_days: [1, 2] }],
    habitCheckinRows: [{ habit_id: uuid(offset + 2), date: "2026-11-12", completed: true }],
    noteRows: [{ id: uuid(offset + 3), title: "Imported note", category: "Ideas", body: "Saved text" }],
  };
}

test("personal imports are atomic, habit-first and idempotent across freshly remapped retry IDs", async () => {
  const app = setup(), { cookie } = await app.account();
  const key = "e".repeat(64);
  const first = await app.call("/api/import", { method: "POST", cookie, body: personalImport(100, key) });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.deepEqual(first.data, { imported: 0, classesAdded: 0, templatesAdded: 0, resourcesAdded: 0, goalsAdded: 1, habitsAdded: 1, notesAdded: 1, habitCheckinsAdded: 1 });
  const again = await app.call("/api/import", { method: "POST", cookie, body: personalImport(200, key) });
  assert.deepEqual(again.data, first.data);
  const data = await app.planner(cookie);
  assert.deepEqual([data.goals.length, data.habits.length, data.habit_checkins.length, data.notes.length], [1, 1, 1, 1]);
  assert.equal(data.habit_checkins[0].habit_id, uuid(102));
  assert.equal(data.goals[0].current_count, 2);
  assert.equal(data.notes[0].body, "Saved text");
  const invalid = personalImport(300, "f".repeat(64));
  invalid.habitCheckinRows[0].habit_id = uuid(999);
  assert.equal((await app.call("/api/import", { method: "POST", cookie, body: invalid })).status, 400);
  const after = await app.planner(cookie);
  assert.deepEqual([after.goals.length, after.habits.length, after.notes.length], [1, 1, 1]);
  assert.equal(app.env.DB.raw.prepare("SELECT count(*) AS n FROM planner_imports WHERE user_id = ?").get((await app.call("/api/session", { cookie })).data.user.id).n, 1);
});

test("personal import rejects foreign habits and validates array payloads without committing partial rows", async () => {
  const app = setup(), a = await app.account(), b = await app.account("b@personal.test");
  await app.call(`/api/habits/${uuid(2)}`, { method: "PUT", cookie: a.cookie, body: { title: "Private habit" } });
  const imported = await app.call("/api/import", { method: "POST", cookie: b.cookie, body: { goalRows: [{ id: uuid(10), title: "Must roll back" }], habitCheckinRows: [{ habit_id: uuid(2), date: "2026-11-12", completed: true }] } });
  assert.equal(imported.status, 400);
  assert.deepEqual((await app.planner(b.cookie)).goals, []);
  for (const field of ["goalRows", "habitRows", "habitCheckinRows", "noteRows"]) assert.equal((await app.call("/api/import", { method: "POST", cookie: b.cookie, body: { [field]: "wrong" } })).status, 400);
});
