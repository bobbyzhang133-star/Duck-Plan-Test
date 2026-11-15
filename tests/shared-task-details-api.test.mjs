import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { handleRequest } from "../cloudflare/src/index.js";
import { cleanTaskDetails } from "../cloudflare/src/task-details.js";
import { ORIGIN, createCtx, createFakeEnv, repoRoot } from "./support/fake-cloudflare.mjs";

const uuid = n => `65000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const details = (actualMinutes = 25, reminderChoice = "60") => ({ version: 1, actualMinutes, reminderChoice });
const alerts = () => ({ version: 1, timeZone: "America/Los_Angeles",
  alarm: { enabled: true, mode: "manual", at: "2028-06-15T09:15", sound: "bright", snoozeMinutes: 10 },
  notification: { enabled: true, mode: "alarm", at: null } });

function app() {
  const fixture = createFakeEnv(), ctx = createCtx();
  async function call(route, { method = "GET", cookie, body } = {}) {
    const headers = { Origin: ORIGIN };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await handleRequest(new Request(ORIGIN + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), fixture.env, ctx);
    await ctx.settle();
    return { response, status: response.status, data: await response.clone().json() };
  }
  async function account(email) {
    const result = await call("/api/auth/sign-up", { method: "POST", body: { email, password: "synthetic metadata fixture password" } });
    assert.equal(result.status, 201);
    return { cookie: result.response.headers.get("set-cookie").split(";")[0], user: result.data.user };
  }
  const row = id => ({ ...fixture.env.DB.raw.prepare("SELECT * FROM items WHERE id=?").get(id) });
  return { ...fixture, ctx, call, account, row };
}

test("shared task details require the exact bounded versioned payload", () => {
  assert.equal(cleanTaskDetails(null), null);
  for (const minutes of [null, 0, 10080]) for (const reminder of ["default", "off", "15", "60", "1440"]) {
    const value = details(minutes, reminder);
    assert.deepEqual(cleanTaskDetails(value), value);
    assert.deepEqual(cleanTaskDetails(JSON.stringify(value)), value);
  }
  for (const value of [undefined, [], {}, "null", "bad json", " ".repeat(513),
    { ...details(), version: 2 }, { ...details(), extra: true }, { ...details(), actualMinutes: -1 },
    { ...details(), actualMinutes: 10081 }, { ...details(), actualMinutes: 1.5 },
    { ...details(), actualMinutes: "25" }, { ...details(), actualMinutes: false },
    { version: 1, actualMinutes: 25 }, { version: 1, reminderChoice: "60" },
    { ...details(), reminderChoice: 60 }, { ...details(), reminderChoice: "30" }]) {
    assert.throws(() => cleanTaskDetails(value), /Task details aren't valid/);
  }
});

test("migration retains legacy rows and advances direct-write revisions once with recursive triggers on or off", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const migrations = path.join(repoRoot, "cloudflare/migrations");
    fs.readdirSync(migrations).filter(name => /^000[1-6]_.*\.sql$/.test(name)).sort()
      .forEach(name => db.exec(fs.readFileSync(path.join(migrations, name), "utf8")));
    db.prepare("INSERT INTO users(id,email) VALUES (?,?)").run(uuid(100), "migration@example.test");
    db.prepare("INSERT INTO items(id,user_id,title,work_alerts) VALUES (?,?,?,?)").run(uuid(101), uuid(100), "Legacy", JSON.stringify(alerts()));
    db.exec(fs.readFileSync(path.join(migrations, "0007_shared_task_details.sql"), "utf8"));
    let row = db.prepare("SELECT * FROM items WHERE id=?").get(uuid(101));
    assert.equal(row.task_details, null); assert.equal(row.sync_revision, 0);
    assert.deepEqual(JSON.parse(row.work_alerts), alerts());
    for (const recursive of ["OFF", "ON"]) {
      db.exec(`PRAGMA recursive_triggers=${recursive}`);
      const before = db.prepare("SELECT sync_revision FROM items WHERE id=?").get(uuid(101)).sync_revision;
      // These columns model Axis's direct writer, bypassing the planner endpoint.
      db.prepare("UPDATE items SET title=?,axis_missing=1 WHERE id=?").run(`Axis ${recursive}`, uuid(101));
      row = db.prepare("SELECT * FROM items WHERE id=?").get(uuid(101));
      assert.equal(row.sync_revision, before + 1);
      assert.deepEqual(JSON.parse(row.work_alerts), alerts());
    }
    assert.throws(() => db.prepare("UPDATE items SET task_details='invalid' WHERE id=?").run(uuid(101)), /CHECK/);
  } finally { db.close(); }
});

test("normal saves roundtrip details, preserve omitted older-client fields, clear explicitly and return post-trigger revisions", async () => {
  const fixture = app(), a = await fixture.account("details-save-a@example.test"), b = await fixture.account("details-save-b@example.test");
  const id = uuid(1), route = `/api/items/${id}`;
  let result = await fixture.call(route, { method: "PUT", cookie: a.cookie, body: {
    title: "Shared", work_alerts: alerts(), task_details: details(), sync_revision: 999,
  } });
  assert.equal(result.status, 200); assert.equal(result.data.item.sync_revision, 0);
  assert.deepEqual(JSON.parse(result.data.item.task_details), details());
  assert.equal((await fixture.call(route, { method: "PUT", cookie: b.cookie, body: { title: "Hijack", task_details: details(99) } })).status, 404);
  result = await fixture.call(route, { method: "PUT", cookie: a.cookie, body: { title: "Older client", sync_revision: 999 } });
  assert.equal(result.data.item.sync_revision, 1);
  assert.deepEqual(JSON.parse(result.data.item.task_details), details());
  assert.deepEqual(JSON.parse(result.data.item.work_alerts), alerts());
  result = await fixture.call(route, { method: "PATCH", cookie: a.cookie, body: { completed: true, sync_revision: 999 } });
  assert.equal(result.data.item.sync_revision, 2); assert.deepEqual(JSON.parse(result.data.item.task_details), details());
  result = await fixture.call(route, { method: "PUT", cookie: a.cookie, body: { title: "Clear", task_details: null } });
  assert.equal(result.data.item.task_details, null); assert.equal(result.data.item.sync_revision, 3);
  const snapshot = (await fixture.call("/api/planner", { cookie: a.cookie })).data;
  assert.equal(snapshot.task_details_supported, true); assert.equal(snapshot.settings_adoption_supported, true);
  assert.equal(snapshot.work_alerts_supported, true); assert.equal(snapshot.items[0].sync_revision, 3);
  await fixture.call(route, { method: "DELETE", cookie: a.cookie });
  assert.equal(fixture.broadcasts.at(-1).message.row.sync_revision, 4);
  assert.ok(fixture.broadcasts.at(-1).message.row.deleted_at);
  assert.equal(fixture.row(id).sync_revision, 4);
});

test("invalid metadata rejects a normal save without modifying its canonical task", async () => {
  const fixture = app(), { cookie } = await fixture.account("details-invalid@example.test"), id = uuid(2), route = `/api/items/${id}`;
  await fixture.call(route, { method: "PUT", cookie, body: { title: "Keep", task_details: details() } });
  const before = fixture.row(id), broadcastCount = fixture.broadcasts.length;
  for (const task_details of [{ ...details(), actualMinutes: -1 }, { ...details(), reminderChoice: "unknown" }, "not json"]) {
    assert.equal((await fixture.call(route, { method: "PUT", cookie, body: { title: "Replace", task_details } })).status, 400);
    assert.deepEqual(fixture.row(id), before);
  }
  assert.equal(fixture.broadcasts.length, broadcastCount);
});

test("imports retain shared details and alerts atomically, ignore client revisions, and keep old imports compatible", async () => {
  const fixture = app(), { cookie } = await fixture.account("details-import@example.test");
  assert.equal((await fixture.call("/api/import", { method: "POST", cookie, body: { itemRows: [
    { id: uuid(3), title: "New import", task_details: JSON.stringify(details(0, "off")), work_alerts: alerts(), sync_revision: 999 },
    { id: uuid(4), title: "Old import" },
  ] } })).status, 200);
  assert.deepEqual(JSON.parse(fixture.row(uuid(3)).task_details), details(0, "off"));
  assert.deepEqual(JSON.parse(fixture.row(uuid(3)).work_alerts), alerts());
  assert.equal(fixture.row(uuid(3)).sync_revision, 0); assert.equal(fixture.row(uuid(4)).task_details, null);
  assert.equal((await fixture.call("/api/import", { method: "POST", cookie, body: { itemRows: [
    { id: uuid(5), title: "Do not partially insert" }, { id: uuid(6), title: "Invalid", task_details: details(10081) },
  ] } })).status, 400);
  assert.equal(fixture.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM items").get().n, 2);
});

test("adoption fills both canonical-null metadata columns once without changing other task data", async () => {
  const fixture = app(), { cookie } = await fixture.account("adoption-both@example.test"), id = uuid(10), route = `/api/items/${id}`;
  await fixture.call(route, { method: "PUT", cookie, body: { title: "Keep this title", notes: "Keep notes", due_date: "2028-06-17", scheduled_start: "2028-06-15T09:00" } });
  const before = fixture.row(id), broadcastCount = fixture.broadcasts.length;
  const result = await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie, body: { expected_revision: 0, work_alerts: alerts(), task_details: details() } });
  assert.equal(result.status, 200); assert.equal(result.data.adopted, true); assert.equal(result.data.item.sync_revision, 1);
  assert.deepEqual(JSON.parse(result.data.item.work_alerts), alerts()); assert.deepEqual(JSON.parse(result.data.item.task_details), details());
  for (const field of ["id", "user_id", "title", "notes", "due_date", "scheduled_start", "completed", "created_at", "source"]) assert.equal(result.data.item[field], before[field]);
  assert.equal(fixture.broadcasts.length, broadcastCount + 1);
  assert.deepEqual(fixture.broadcasts.at(-1).message.row, result.data.item);
  const retry = await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie, body: { expected_revision: 0, work_alerts: alerts(), task_details: details(90) } });
  assert.equal(retry.data.adopted, false); assert.deepEqual(retry.data.item, result.data.item);
  assert.equal(fixture.broadcasts.length, broadcastCount + 1);
});

test("adoption never replaces nonnull canonical data, but can adopt its still-null sibling atomically", async () => {
  const fixture = app(), { cookie } = await fixture.account("adoption-canonical@example.test"), id = uuid(11), route = `/api/items/${id}`;
  await fixture.call(route, { method: "PUT", cookie, body: { title: "Canonical", task_details: details(100, "off") } });
  const first = await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie, body: { expected_revision: 0, task_details: details(), work_alerts: alerts() } });
  assert.equal(first.data.adopted, true); assert.deepEqual(JSON.parse(first.data.item.task_details), details(100, "off"));
  assert.deepEqual(JSON.parse(first.data.item.work_alerts), alerts()); assert.equal(first.data.item.sync_revision, 1);
  const broadcastCount = fixture.broadcasts.length;
  const second = await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie, body: { expected_revision: 1, task_details: details(200), work_alerts: alerts() } });
  assert.equal(second.data.adopted, false); assert.deepEqual(second.data.item, first.data.item); assert.equal(fixture.broadcasts.length, broadcastCount);
});

test("competing device adoptions have one winner and stale revisions lose after ordinary or Axis-like edits", async () => {
  const fixture = app(), { cookie } = await fixture.account("adoption-race@example.test"), id = uuid(12), route = `/api/items/${id}`;
  await fixture.call(route, { method: "PUT", cookie, body: { title: "Race" } });
  const results = await Promise.all([details(10, "15"), details(20, "1440")].map(task_details => fixture.call(`${route}/adopt-settings`, {
    method: "POST", cookie, body: { expected_revision: 0, task_details },
  })));
  assert.deepEqual(results.map(result => result.data.adopted).sort(), [false, true]);
  assert.deepEqual(results[0].data.item, results[1].data.item); assert.equal(fixture.row(id).sync_revision, 1);
  const nextId = uuid(13), nextRoute = `/api/items/${nextId}`;
  await fixture.call(nextRoute, { method: "PUT", cookie, body: { title: "Before Axis" } });
  fixture.env.DB.raw.prepare("UPDATE items SET title='Axis revised',axis_missing=1 WHERE id=?").run(nextId);
  let stale = await fixture.call(`${nextRoute}/adopt-settings`, { method: "POST", cookie, body: { expected_revision: 0, task_details: details() } });
  assert.equal(stale.data.adopted, false); assert.equal(stale.data.item.title, "Axis revised"); assert.equal(stale.data.item.task_details, null);
  await fixture.call(nextRoute, { method: "PUT", cookie, body: { title: "Other device" } });
  stale = await fixture.call(`${nextRoute}/adopt-settings`, { method: "POST", cookie, body: { expected_revision: 1, work_alerts: alerts() } });
  assert.equal(stale.data.adopted, false); assert.equal(stale.data.item.sync_revision, 2); assert.equal(stale.data.item.work_alerts, null);
});

test("completion or deletion between the ownership read and CAS prevents adoption and returns the authoritative inactive row", async () => {
  const fixture = app(), { cookie } = await fixture.account("adoption-inactive-race@example.test");
  const prepare = fixture.env.DB.prepare;
  let intervene;
  fixture.env.DB.prepare = sql => {
    const statement = prepare(sql);
    if (!sql.includes("AND sync_revision = ?8")) return statement;
    return { bind(...params) {
      const bound = statement.bind(...params);
      return { async run() { intervene(); return bound.run(); } };
    } };
  };
  for (const [n, mutation, field] of [[14, "completed=1", "completed"], [15, "deleted_at='2028-06-01T00:00:00Z'", "deleted_at"]]) {
    const id = uuid(n), route = `/api/items/${id}`;
    await fixture.call(route, { method: "PUT", cookie, body: { title: "Initially active" } });
    const broadcastCount = fixture.broadcasts.length;
    intervene = () => fixture.env.DB.raw.prepare(`UPDATE items SET ${mutation} WHERE id=?`).run(id);
    const result = await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie, body: { expected_revision: 0, work_alerts: alerts(), task_details: details() } });
    assert.equal(result.status, 200); assert.equal(result.data.adopted, false);
    assert.ok(result.data.item[field]); assert.equal(result.data.item.sync_revision, 1);
    assert.equal(result.data.item.work_alerts, null); assert.equal(result.data.item.task_details, null);
    assert.equal(fixture.broadcasts.length, broadcastCount, "losing CAS must not broadcast an adoption");
  }
});

test("completed tasks can adopt all historical metadata without activating jobs or changing completion", async () => {
  const fixture = app(), { cookie } = await fixture.account("adoption-completed-details@example.test"), id = uuid(16), route = `/api/items/${id}`;
  await fixture.call(route, { method: "PUT", cookie, body: { title: "Finished work", completed: true } });
  const before = fixture.row(id);
  const result = await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie, body: { expected_revision: 0, task_details: details(85, "60"), work_alerts: alerts() } });
  assert.equal(result.status, 200); assert.equal(result.data.adopted, true);
  assert.deepEqual(JSON.parse(result.data.item.task_details), details(85, "60"));
  assert.equal(result.data.item.completed, 1); assert.equal(result.data.item.completed_at, before.completed_at);
  assert.deepEqual(JSON.parse(result.data.item.work_alerts), alerts()); assert.equal(result.data.item.sync_revision, 1);
  for (const body of [{ expected_revision: 1, work_alerts: alerts() }, { expected_revision: 1, work_alerts: alerts(), task_details: details() }]) {
    const retry = await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie, body });
    assert.equal(retry.status, 200); assert.equal(retry.data.adopted, false);
  }
  assert.deepEqual(fixture.row(id), result.data.item);
  assert.equal(fixture.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM task_alarms").get().n, 0, "metadata adoption must not create notification jobs");
});

test("adoption validates metadata-only input and protects other owners, stale revisions and deleted tasks", async () => {
  const fixture = app(), a = await fixture.account("adoption-owner-a@example.test"), b = await fixture.account("adoption-owner-b@example.test");
  const route = `/api/items/${uuid(20)}`;
  await fixture.call(route, { method: "PUT", cookie: a.cookie, body: { title: "Protected" } });
  const before = fixture.row(uuid(20)), broadcastCount = fixture.broadcasts.length;
  for (const body of [null, [], {}, { expected_revision: 0 }, { expected_revision: -1, task_details: details() },
    { expected_revision: 0.5, task_details: details() }, { expected_revision: "0", task_details: details() },
    { expected_revision: Number.MAX_SAFE_INTEGER + 1, task_details: details() },
    { expected_revision: 0, task_details: null }, { expected_revision: 0, work_alerts: null },
    { expected_revision: 0, task_details: details(), title: "Sneak title" },
    { expected_revision: 0, task_details: details(), scheduled_start: "2028-06-15T12:00" },
    { expected_revision: 0, task_details: { ...details(), actualMinutes: 10081 } },
    { expected_revision: 0, work_alerts: { ...alerts(), version: 2 } }]) {
    assert.equal((await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie: a.cookie, body })).status, 400);
  }
  assert.deepEqual(fixture.row(uuid(20)), before); assert.equal(fixture.broadcasts.length, broadcastCount);
  assert.equal((await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie: b.cookie, body: { expected_revision: 0, task_details: details() } })).status, 404);
  await fixture.call(route, { method: "PATCH", cookie: a.cookie, body: { completed: true } });
  const stale = await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie: a.cookie, body: { expected_revision: 0, work_alerts: alerts() } });
  assert.equal(stale.status, 200); assert.equal(stale.data.adopted, false); assert.equal(stale.data.item.completed, 1);
  await fixture.call(route, { method: "PATCH", cookie: a.cookie, body: { completed: false } });
  await fixture.call(route, { method: "DELETE", cookie: a.cookie });
  assert.equal((await fixture.call(`${route}/adopt-settings`, { method: "POST", cookie: a.cookie, body: { expected_revision: 3, work_alerts: alerts() } })).status, 404);
  assert.equal(fixture.row(uuid(20)).work_alerts, null); assert.equal(fixture.row(uuid(20)).task_details, null);
});
