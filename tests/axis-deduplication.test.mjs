import test from "node:test";
import assert from "node:assert/strict";
import { syncUser } from "../cloudflare/src/axis.js";
import { createFakeEnv } from "./support/fake-cloudflare.mjs";

const LINK = "https://fixture.myschoolapp.com/podium/feed/iCal.aspx?z=synthetic-axis-fixture";
const NOW = Date.parse("2026-11-25T20:00:00Z");
const item = (uid, changes = {}) => ({ uid, title: "Math - 1: Worksheet", date: "20261126", notes: "Bring a pencil", ...changes });
const feed = rows => "BEGIN:VCALENDAR\n" + rows.map(row => `BEGIN:VEVENT\nUID:${row.uid}\nDTSTART:${row.date}T120000\nSUMMARY:${row.title}\nDESCRIPTION:${row.notes}\nEND:VEVENT`).join("\n") + "\nEND:VCALENDAR";
function setup() {
  const { env } = createFakeEnv();
  const owner = crypto.randomUUID(), other = crypto.randomUUID();
  for (const id of [owner, other]) env.DB.raw.prepare("INSERT INTO users (id,email) VALUES (?,?)").run(id, id + "@fixture.test");
  const sync = (rows, user = owner) => syncUser(env, user, LINK, { fetchImpl: async () => new Response(feed(rows)), now: () => NOW });
  const rows = (user = owner) => env.DB.raw.prepare("SELECT * FROM items WHERE user_id=? ORDER BY created_at,id").all(user);
  return { env, owner, other, sync, rows };
}

test("28 feeds with regenerated UIDs retain one assignment and its saved work/preferences", async () => {
  const a = setup();
  await a.sync([item("original")]);
  const original = a.rows()[0];
  a.env.DB.raw.prepare("UPDATE items SET scheduled_start='2026-11-26T10:00', duration_minutes=90, priority='high' WHERE id=?").run(original.id);
  for (let i = 1; i < 28; i += 1) assert.equal((await a.sync([item("regenerated-" + i)])).added, 0);
  assert.equal(a.rows().length, 1);
  assert.equal(a.rows()[0].id, original.id);
  assert.equal(a.rows()[0].scheduled_start, "2026-11-26T10:00");
  assert.equal(a.rows()[0].duration_minutes, 90);
  assert.equal(a.rows()[0].priority, "high");
  assert.equal(a.rows()[0].due_time, "12:00");
  assert.equal(a.rows()[0].axis_missing, 0);
});

test("exact source snapshots survive task edits, completion, reopening and soft deletion", async () => {
  const a = setup();
  await a.sync([item("first")]);
  const id = a.rows()[0].id;
  a.env.DB.raw.prepare("UPDATE items SET completed=1, title='My finished title', notes='My notes', due_time='14:00' WHERE id=?").run(id);
  assert.equal((await a.sync([item("next")])).added, 0);
  assert.equal(a.rows()[0].title, "My finished title");
  assert.equal(a.rows()[0].notes, "My notes");
  a.env.DB.raw.prepare("UPDATE items SET completed=0 WHERE id=?").run(id);
  assert.equal((await a.sync([item("third")])).added, 0);
  assert.equal(a.rows()[0].completed, 0);
  assert.equal(a.rows()[0].due_time, "14:00", "manual deadline time remains user-owned on re-sync");
  a.env.DB.raw.prepare("UPDATE items SET deleted_at='2026-11-25T20:00:00Z' WHERE id=?").run(id);
  assert.equal((await a.sync([item("fourth")])).added, 0);
  assert.equal(a.rows().length, 1);
  assert.ok(a.rows()[0].deleted_at);
});

test("same titles in different classes, dates or descriptions stay separate; identical simultaneous events retain multiplicity", async () => {
  const a = setup();
  const entries = [item("one"), item("two"), item("three", { title: "Math - 2: Worksheet" }), item("four", { date: "20261127" }), item("five", { notes: "Different instructions" })];
  assert.equal((await a.sync(entries)).added, 5);
  const ids = a.rows().map(row => row.id);
  assert.equal((await a.sync(entries.map((row, i) => ({ ...row, uid: "new-" + i })).reverse())).added, 0);
  assert.deepEqual(a.rows().map(row => row.id), ids);
  assert.equal(a.rows().length, 5);
});

test("known UID aliases track changed source fields and old/reordered aliases do not create copies", async () => {
  const a = setup();
  await a.sync([item("first")]);
  await a.sync([item("second")]);
  await a.sync([item("second", { title: "Science - 2: Revised worksheet", date: "20261128" })]);
  assert.equal(a.rows().length, 1);
  assert.equal(a.rows()[0].title, "Revised worksheet");
  assert.equal(a.rows()[0].due_date, "2026-11-28");
  assert.equal((await a.sync([item("first"), item("second")])).added, 0);
  assert.equal(a.rows().length, 1);
});

test("legacy copies are not deleted; changing UIDs stop adding more copies and other owners stay independent", async () => {
  const a = setup();
  await a.sync([item("legacy")]);
  a.env.DB.raw.exec("DELETE FROM axis_assignment_keys");
  const row = a.rows()[0];
  a.env.DB.raw.prepare("INSERT INTO items (id,user_id,class_id,title,type,notes,due_date,due_time,source,axis_uid) VALUES (?,?,?,?,?,?,?,?,?,?)").run(crypto.randomUUID(), a.owner, row.class_id, row.title, row.type, row.notes, row.due_date, row.due_time, "axis", "legacy-copy");
  assert.equal((await a.sync([item("fresh")])).added, 0);
  assert.equal(a.rows().length, 2, "cleanup needs separate review; no existing task is deleted");
  assert.equal((await a.sync([item("other-fresh")], a.other)).added, 1);
  assert.equal(a.rows(a.other).length, 1);
  assert.throws(() => a.env.DB.raw.prepare("INSERT INTO axis_assignment_keys VALUES (?,?,?)").run(a.other, "foreign", row.id), /another user/);
});

test("concurrent new-class imports with different UIDs create one row and report actual inserts", async () => {
  const a = setup();
  const results = await Promise.all([a.sync([item("a")]), a.sync([item("b")])]);
  assert.equal(a.rows().length, 1);
  assert.equal(results.reduce((sum, result) => sum + result.added, 0), 1);
  assert.equal(results.reduce((sum, result) => sum + result.classesAdded, 0), 1);
  assert.equal(a.env.DB.raw.prepare("SELECT SUM(added) AS n FROM sync_runs").get().n, 1);
  assert.equal((await a.sync([item("a"), item("b")])).added, 0);
  assert.equal(a.rows().length, 1);
});

test("failed imports roll back identity aliases as well as tasks and retry safely", async () => {
  const a = setup();
  a.env.DB.raw.exec("CREATE TRIGGER fail_axis_keys BEFORE UPDATE OF status ON sync_runs WHEN NEW.status='ok' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;");
  await assert.rejects(a.sync([item("failure")]), /Sync failed/);
  assert.equal(a.rows().length, 0);
  assert.equal(a.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM axis_assignment_keys").get().n, 0);
  a.env.DB.raw.exec("DROP TRIGGER fail_axis_keys");
  assert.equal((await a.sync([item("retry")])).added, 1);
  assert.equal((await a.sync([item("again")])).added, 0);
});

test("a legacy backlog of 9,716 imported rows stops growing without deleting existing copies", async () => {
  const a = setup();
  const entries = Array.from({ length: 347 }, (_, i) => item("initial-" + i, { title: "Math - 1: Assignment " + i }));
  await a.sync(entries);
  a.env.DB.raw.exec(`DELETE FROM axis_assignment_keys;
    WITH RECURSIVE copies(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM copies WHERE n<27)
    INSERT INTO items (id,user_id,class_id,title,type,notes,due_date,due_time,source,axis_uid)
    SELECT lower(hex(randomblob(16))),user_id,class_id,title,type,notes,due_date,due_time,source,axis_uid||'-copy-'||n FROM items,copies;`);
  assert.equal(a.rows().length, 9716);
  for (let run = 0; run < 2; run += 1) assert.equal((await a.sync(entries.map((row, i) => ({ ...row, uid: `fresh-${run}-${i}` })))).added, 0);
  assert.equal(a.rows().length, 9716);
});
