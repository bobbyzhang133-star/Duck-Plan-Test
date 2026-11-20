import test from "node:test";
import assert from "node:assert/strict";
import { overdueImportIds } from "../cloudflare/src/axis-completion.js";
import { syncUser } from "../cloudflare/src/axis.js";
import { handleRequest } from "../cloudflare/src/index.js";
import { createFakeEnv, createCtx, ORIGIN } from "./support/fake-cloudflare.mjs";

const NOW = Date.parse("2026-11-20T20:00:00Z"); // Noon in Los Angeles.
const LINK = "https://fixture.myschoolapp.com/podium/feed/iCal.aspx?z=synthetic-axis-fixture";
const event = (uid, date, time = "", title = uid) => `BEGIN:VEVENT\nUID:${uid}\nDTSTART${time ? ":" : ";VALUE=DATE:"}${date.replaceAll("-", "")}${time ? "T" + time.replace(":", "") + "00" : ""}\nSUMMARY:${title}\nEND:VEVENT`;
const calendar = (...events) => `BEGIN:VCALENDAR\nVERSION:2.0\n${events.join("\n")}\nEND:VCALENDAR`;
const feed = () => calendar(event("old", "2026-11-19"), event("today", "2026-11-20"), event("future", "2026-11-21"), event("earlier", "2026-11-20", "11:59"), event("exact", "2026-11-20", "12:00"), event("later", "2026-11-20", "12:01"));

function setup() {
  const fixture = createFakeEnv(), ctx = createCtx();
  let text = feed(), upstream = null;
  const fetchImpl = async (...args) => upstream ? upstream(...args) : new Response(text);
  async function call(path, { cookie, method = "GET", body } = {}) {
    const headers = { Origin: ORIGIN };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await handleRequest(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), fixture.env, ctx, { fetchImpl, now: () => NOW });
    await ctx.settle();
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function account(name) {
    const result = await call("/api/auth/sign-up", { method: "POST", body: { email: name + "@axis.test", password: "Synthetic test account password" } });
    assert.equal(result.status, 201);
    return { id: result.data.user.id, cookie: result.headers.get("set-cookie").split(";")[0] };
  }
  const connect = user => call("/api/axis", { cookie: user.cookie, method: "POST", body: { mode: "connect", icalUrl: LINK } });
  const rows = user => fixture.env.DB.raw.prepare("SELECT * FROM items WHERE user_id = ? ORDER BY axis_uid").all(user.id);
  const setFeed = value => { text = value; upstream = null; };
  return { ...fixture, ctx, call, account, connect, rows, setFeed, setUpstream: value => { upstream = value; }, sync: user => syncUser(fixture.env, user.id, LINK, { fetchImpl, now: () => NOW }) };
}

test("date-only imports use the account's local day; timed deadlines compare exact instants", () => {
  const rows = [
    { id: "yesterday", due_date: "2026-11-19" }, { id: "today", due_date: "2026-11-20" },
    { id: "future", due_date: "2026-11-21" }, { id: "earlier", due_date: "2026-11-20", due_time: "11:59" },
    { id: "exact", due_date: "2026-11-20", due_time: "12:00" }, { id: "later", due_date: "2026-11-20", due_time: "12:01" },
  ];
  assert.deepEqual(overdueImportIds(rows, { now: NOW }), ["yesterday", "earlier"]);
  const midnight = Date.parse("2026-11-21T01:00:00Z");
  assert.deepEqual(overdueImportIds([rows[1]], { now: midnight, timeZone: "America/Los_Angeles" }), []);
  assert.deepEqual(overdueImportIds([rows[1]], { now: midnight, timeZone: "Asia/Tokyo" }), ["today"]);
  assert.deepEqual(overdueImportIds([rows[1]], { now: Date.parse("2026-11-21T07:59:59Z") }), []);
  assert.deepEqual(overdueImportIds([rows[1]], { now: Date.parse("2026-11-21T08:00:00Z") }), ["today"]);
});

test("DST overlaps follow the existing earlier-instant rule and invalid inputs remain open", () => {
  assert.deepEqual(overdueImportIds([{ id: "fold", due_date: "2026-11-01", due_time: "01:30" }], { now: Date.parse("2026-11-01T09:10:00Z") }), ["fold"]);
  assert.deepEqual(overdueImportIds([{ id: "gap", due_date: "2026-03-08", due_time: "02:30" }], { now: Date.parse("2026-03-08T10:30:00Z") }), []);
  const bad = [{ id: "invalid-day", due_date: "2026-02-30" }, { id: "invalid-month", due_date: "2026-13-01" }, { id: "invalid-time", due_date: "2026-11-19", due_time: "25:00" }, { id: "no-date", due_date: null }];
  assert.deepEqual(overdueImportIds(bad, { now: NOW }), []);
  assert.deepEqual(overdueImportIds([{ id: "old", due_date: "2026-11-19" }], { now: NaN }), []);
  assert.deepEqual(overdueImportIds([{ id: "old", due_date: "2026-11-19" }], { now: NOW, timeZone: "Invalid/Zone" }), []);
});

test("first connection completes only new overdue Axis rows and returns the actual count", async () => {
  const a = setup(), user = await a.account("first");
  const manual = "00000000-0000-4000-8000-000000000001";
  assert.equal((await a.call("/api/items/" + manual, { cookie: user.cookie, method: "PUT", body: { title: "My overdue task", due_date: "2026-11-01" } })).status, 200);
  const result = await a.connect(user);
  assert.equal(result.status, 200);
  assert.equal(result.data.added, 6);
  assert.equal(result.data.autoCompleted, 2);
  const rows = a.rows(user);
  assert.deepEqual(rows.filter(row => row.completed).map(row => row.axis_uid), ["earlier", "old"]);
  assert.ok(rows.filter(row => row.completed).every(row => row.completed_at && row.source === "axis"));
  assert.equal(rows.find(row => row.id === manual).completed, 0);
  const planner = await a.call("/api/planner", { cookie: user.cookie });
  assert.equal(planner.data.items.filter(row => row.completed).length, 2, "all clients receive the persisted status");
});

test("later syncs preserve reopened work and leave newly appearing overdue assignments open", async () => {
  const a = setup(), user = await a.account("later");
  await a.connect(user);
  const old = a.rows(user).find(row => row.axis_uid === "old");
  await a.call("/api/items/" + old.id, { cookie: user.cookie, method: "PATCH", body: { completed: false } });
  a.setFeed(feed().replace("SUMMARY:old", "SUMMARY:old revised").replace("END:VCALENDAR", event("new-late", "2026-11-01") + "\nEND:VCALENDAR"));
  a.env.DB.raw.prepare("UPDATE axis_connections SET last_attempted_at = '2000-01-01T00:00:00Z'").run();
  const result = await a.call("/api/axis", { cookie: user.cookie, method: "POST", body: { mode: "sync" } });
  assert.equal(result.status, 200);
  assert.equal(result.data.autoCompleted, 0);
  const rows = a.rows(user);
  assert.equal(rows.find(row => row.id === old.id).completed, 0);
  assert.equal(rows.find(row => row.axis_uid === "new-late").completed, 0);
  assert.equal(rows.filter(row => row.axis_uid === "old").length, 1);
});

test("disconnect/reconnect does not repeat completion; an empty successful import also consumes the first connection", async () => {
  const a = setup(), user = await a.account("reconnect");
  a.setFeed(calendar());
  assert.equal((await a.connect(user)).data.autoCompleted, 0);
  await a.call("/api/axis", { cookie: user.cookie, method: "DELETE" });
  a.setFeed(feed());
  const result = await a.connect(user);
  assert.equal(result.data.autoCompleted, 0);
  assert.ok(a.rows(user).every(row => !row.completed));
});

test("failed first imports roll back rows/completion and a successful retry still completes overdue imports", async () => {
  const a = setup(), user = await a.account("retry");
  a.env.DB.raw.exec("CREATE TRIGGER fail_axis_fixture BEFORE UPDATE OF status ON sync_runs WHEN NEW.status='ok' BEGIN SELECT RAISE(ABORT, 'synthetic import failure'); END;");
  const failed = await a.connect(user);
  assert.equal(failed.status, 500);
  assert.equal(a.rows(user).length, 0);
  assert.equal(a.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM sync_runs WHERE user_id=? AND status='ok'").get(user.id).n, 0);
  a.env.DB.raw.exec("DROP TRIGGER fail_axis_fixture");
  const retried = await a.connect(user);
  assert.equal(retried.status, 200);
  assert.equal(retried.data.autoCompleted, 2);
});

test("existing Axis records without sync history are preserved and other accounts have independent first imports", async () => {
  const a = setup(), owner = await a.account("legacy"), other = await a.account("independent");
  a.env.DB.raw.prepare("INSERT INTO items (id,user_id,title,source,axis_uid,due_date) VALUES (?,?,?,?,?,?)").run("00000000-0000-4000-8000-000000000002", owner.id, "Reopened legacy", "axis", "legacy", "2026-11-01");
  assert.equal((await a.connect(owner)).data.autoCompleted, 0);
  assert.ok(a.rows(owner).every(row => !row.completed));
  assert.equal((await a.connect(other)).data.autoCompleted, 2);
  assert.ok(a.rows(owner).every(row => !row.completed), "other owners never enter the completion update");
});

test("concurrent initial imports cannot both auto-complete and conflicting UIDs never change prior rows", async () => {
  const a = setup(), user = await a.account("concurrent");
  let request = 0;
  a.setUpstream(async () => new Response(calendar(event("shared", "2026-11-19"), event("unique-" + (++request), "2026-11-19"))));
  const results = await Promise.all([a.sync(user), a.sync(user)]);
  assert.equal(results.reduce((sum, result) => sum + result.autoCompleted, 0), 2);
  const rows = a.rows(user);
  assert.equal(rows.length, 3);
  assert.equal(rows.filter(row => row.completed).length, 2);
  assert.equal(rows.filter(row => row.axis_uid === "shared").length, 1);
  assert.equal(rows.filter(row => row.axis_uid.startsWith("unique-") && !row.completed).length, 1);
});

// Actual D1 meta.changes includes revision/native-sync trigger writes; row results do not.
test("completion count excludes D1 trigger side effects", async () => {
  const a = setup(), user = await a.account("trigger-count");
  const batch = a.env.DB.batch.bind(a.env.DB);
  a.env.DB.batch = async statements => {
    const results = await batch(statements);
    statements.forEach((statement, index) => {
      if (statement.sql.includes("UPDATE items SET completed = 1")) results[index].meta.changes *= 3;
    });
    return results;
  };
  assert.equal((await a.connect(user)).data.autoCompleted, 2);
  assert.equal(a.rows(user).filter(row => row.completed).length, 2);
});
