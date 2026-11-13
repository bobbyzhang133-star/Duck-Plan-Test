import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { handleRequest } from "../cloudflare/src/index.js";
import { syncUser } from "../cloudflare/src/axis.js";
import { ORIGIN, createCtx, createFakeEnv, repoRoot } from "./support/fake-cloudflare.mjs";

const uuid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function setup() {
  const fake = createFakeEnv();
  const ctx = createCtx();
  async function call(route, { method = "GET", cookie, body, origin = ORIGIN } = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (method !== "GET" && origin) headers.Origin = origin;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await handleRequest(new Request(`${ORIGIN}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), fake.env, ctx);
    await ctx.settle();
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function account(email) {
    const created = await call("/api/auth/sign-up", { method: "POST", body: { email, password: "planner test password" } });
    assert.equal(created.status, 201);
    return { cookie: created.headers.get("set-cookie").split(";")[0], user: created.data.user };
  }
  async function addClass(cookie, number = 1) {
    const response = await call(`/api/classes/${uuid(number)}`, { method: "PUT", cookie, body: { name: `Class ${number}`, color: "#ffcc44" } });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return uuid(number);
  }
  return { ...fake, ctx, call, account, addClass };
}

test("organization routes require authentication, same-origin writes and valid identifiers", async () => {
  const app = setup();
  for (const [route, body] of [
    [`/api/task-templates/${uuid(10)}`, { title: "Read" }],
    [`/api/class-resources/${uuid(20)}`, { class_id: uuid(1), title: "Book", url: "https://school.test" }],
    ["/api/organization-preferences", { urgency_days: 2 }],
  ]) assert.equal((await app.call(route, { method: "PUT", body })).status, 401);
  const { cookie } = await app.account("a@planner.test");
  assert.equal((await app.call(`/api/task-templates/${uuid(10)}`, { method: "PUT", cookie, origin: "https://other.test", body: { title: "Read" } })).status, 403);
  assert.equal((await app.call("/api/task-templates/not-an-id", { method: "PUT", cookie, body: { title: "Read" } })).status, 400);
  assert.equal((await app.call("/api/class-resources/not-an-id", { method: "DELETE", cookie })).status, 400);
  assert.equal((await app.call("/api/task-templates/%FF", { method: "DELETE", cookie })).status, 400);
});

test("templates save complete reusable fields, broadcast changes and soft-delete without resurrection", async () => {
  const app = setup();
  const { cookie, user } = await app.account("a@planner.test");
  const classId = await app.addClass(cookie);
  const route = `/api/task-templates/${uuid(10)}`;
  const saved = await app.call(route, { method: "PUT", cookie, body: { title: " Lab report ", class_id: classId, duration_minutes: 90, priority: "high", notes: "Use the rubric", reminder_choice: "1440", user_id: "spoof" } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.deepEqual([saved.data.template.title, saved.data.template.class_id, saved.data.template.duration_minutes, saved.data.template.priority, saved.data.template.notes, saved.data.template.reminder_choice], ["Lab report", classId, 90, "high", "Use the rubric", "1440"]);
  assert.equal(saved.data.template.user_id, user.id);
  assert.deepEqual(app.broadcasts.at(-1), { userId: user.id, message: { table: "task_templates", row: saved.data.template } });
  const updated = await app.call(route, { method: "PUT", cookie, body: { ...saved.data.template, title: "Independent reading", class_id: null, reminder_choice: "off" } });
  assert.equal(updated.data.template.class_id, null);
  assert.equal(updated.data.template.created_at, saved.data.template.created_at);
  assert.equal((await app.call("/api/planner", { cookie })).data.templates[0].title, "Independent reading");
  const deleted = await app.call(route, { method: "DELETE", cookie });
  assert.ok(deleted.data.template.deleted_at);
  assert.equal(app.broadcasts.at(-1).message.table, "task_templates");
  assert.deepEqual((await app.call("/api/planner", { cookie })).data.templates, []);
  assert.equal((await app.call(route, { method: "DELETE", cookie })).data.template, null);
  assert.equal((await app.call(route, { method: "PUT", cookie, body: { title: "Revive" } })).status, 404);
});

test("resources retain class/category/order, validate safe links and broadcast soft-deletes", async () => {
  const app = setup();
  const { cookie, user } = await app.account("a@planner.test");
  const classId = await app.addClass(cookie);
  const route = `/api/class-resources/${uuid(20)}`;
  const saved = await app.call(route, { method: "PUT", cookie, body: { class_id: classId, title: "Study guide", url: "https://school.test/guide?q=unit#one", description: "For Friday", category: "Revision", sort_order: 3 } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.deepEqual([saved.data.resource.class_id, saved.data.resource.category, saved.data.resource.sort_order, saved.data.resource.url], [classId, "Revision", 3, "https://school.test/guide?q=unit#one"]);
  assert.deepEqual(app.broadcasts.at(-1), { userId: user.id, message: { table: "class_resources", row: saved.data.resource } });
  await app.call(`/api/class-resources/${uuid(21)}`, { method: "PUT", cookie, body: { class_id: classId, title: "Class home", url: "http://school.test", sort_order: 0 } });
  assert.deepEqual((await app.call("/api/planner", { cookie })).data.resources.map((row) => row.sort_order), [0, 3]);
  for (const url of ["javascript:alert(1)", "data:text/html,test", "ftp://school.test", "//school.test", "https://user:pass@school.test", "https://%75ser@school.test", "not a link"]) {
    assert.equal((await app.call(route, { method: "PUT", cookie, body: { class_id: classId, title: "Unsafe", url } })).status, 400, url);
  }
  assert.equal((await app.call(route, { method: "PUT", cookie, body: { title: "No class", url: "https://school.test" } })).status, 400);
  const removed = await app.call(route, { method: "DELETE", cookie });
  assert.ok(removed.data.resource.deleted_at);
  assert.equal((await app.call("/api/planner", { cookie })).data.resources.length, 1);
  assert.equal((await app.call(route, { method: "DELETE", cookie })).data.resource, null);
  assert.equal((await app.call(route, { method: "PUT", cookie, body: { class_id: classId, title: "Revive", url: "https://school.test" } })).status, 404);
});

test("organization rows and linked classes are isolated across accounts, including schema enforcement", async () => {
  const app = setup();
  const a = await app.account("a@planner.test"), b = await app.account("b@planner.test");
  const classA = await app.addClass(a.cookie, 1), classB = await app.addClass(b.cookie, 2);
  await app.call(`/api/task-templates/${uuid(10)}`, { method: "PUT", cookie: a.cookie, body: { title: "Private template", class_id: classA } });
  await app.call(`/api/class-resources/${uuid(20)}`, { method: "PUT", cookie: a.cookie, body: { title: "Private link", class_id: classA, url: "https://school.test" } });
  const bPlanner = (await app.call("/api/planner", { cookie: b.cookie })).data;
  assert.deepEqual([bPlanner.templates, bPlanner.resources, bPlanner.organization], [[], [], { urgency_days: 2 }]);
  for (const [kind, rowId, body] of [
    ["task-templates", 10, { title: "Taken over", class_id: classB }],
    ["class-resources", 20, { title: "Taken over", class_id: classB, url: "https://other.test" }],
  ]) {
    assert.equal((await app.call(`/api/${kind}/${uuid(rowId)}`, { method: "PUT", cookie: b.cookie, body })).status, 404);
    const deleted = await app.call(`/api/${kind}/${uuid(rowId)}`, { method: "DELETE", cookie: b.cookie });
    assert.equal(deleted.data[kind === "task-templates" ? "template" : "resource"], null);
    assert.equal((await app.call(`/api/${kind}/${uuid(rowId + 1)}`, { method: "PUT", cookie: b.cookie, body: { ...body, class_id: classA } })).status, 400);
  }
  assert.equal((await app.call("/api/planner", { cookie: a.cookie })).data.templates[0].title, "Private template");
  const db = app.env.DB.raw;
  assert.throws(() => db.prepare("INSERT INTO task_templates (id,user_id,class_id,title) VALUES (?,?,?,'bad')").run(uuid(90), b.user.id, classA), /another user/);
  assert.throws(() => db.prepare("INSERT INTO class_resources (id,user_id,class_id,title,url) VALUES (?,?,?,'bad','https://school.test')").run(uuid(91), b.user.id, classA), /another user/);
  assert.throws(() => db.prepare("UPDATE task_templates SET user_id = ? WHERE id = ?").run(b.user.id, uuid(10)), /cannot change owner/);
  assert.throws(() => db.prepare("UPDATE class_resources SET user_id = ? WHERE id = ?").run(b.user.id, uuid(20)), /cannot change owner/);
});

test("organization preferences default to two days and persist only for the signed-in account", async () => {
  const app = setup();
  const a = await app.account("a@planner.test"), b = await app.account("b@planner.test");
  assert.deepEqual((await app.call("/api/planner", { cookie: a.cookie })).data.organization, { urgency_days: 2 });
  for (const urgency_days of [0, 30, 5]) {
    const saved = await app.call("/api/organization-preferences", { method: "PUT", cookie: a.cookie, body: { urgency_days, user_id: b.user.id } });
    assert.deepEqual(saved.data.preferences, { urgency_days });
    assert.deepEqual((await app.call("/api/planner", { cookie: a.cookie })).data.organization, { urgency_days });
    assert.equal(app.broadcasts.at(-1).message.table, "planner_preferences");
    assert.equal(app.broadcasts.at(-1).message.row.user_id, a.user.id);
  }
  assert.deepEqual((await app.call("/api/planner", { cookie: b.cookie })).data.organization, { urgency_days: 2 });
  for (const urgency_days of [-1, 31, 2.5, "2", null]) assert.equal((await app.call("/api/organization-preferences", { method: "PUT", cookie: a.cookie, body: { urgency_days } })).status, 400);
});

test("template and resource limits reject invalid details without changing saved data", async () => {
  const app = setup();
  const { cookie } = await app.account("a@planner.test");
  const classId = await app.addClass(cookie);
  for (const fields of [{ title: "" }, { title: "x".repeat(81) }, { duration_minutes: 4 }, { duration_minutes: 1441 }, { duration_minutes: 5.5 }, { priority: "critical" }, { reminder_choice: "7" }, { notes: "x".repeat(5001) }]) {
    assert.equal((await app.call(`/api/task-templates/${uuid(10)}`, { method: "PUT", cookie, body: { title: "Template", ...fields } })).status, 400, JSON.stringify(fields).slice(0, 100));
  }
  for (const fields of [{ title: "x".repeat(121) }, { description: "x".repeat(2001) }, { category: "x".repeat(61) }, { sort_order: -1 }, { sort_order: 10001 }, { sort_order: 1.2 }]) {
    assert.equal((await app.call(`/api/class-resources/${uuid(20)}`, { method: "PUT", cookie, body: { title: "Resource", class_id: classId, url: "https://school.test", ...fields } })).status, 400);
  }
  assert.deepEqual((await app.call("/api/planner", { cookie })).data.templates, []);
  assert.deepEqual((await app.call("/api/planner", { cookie })).data.resources, []);
});

test("task importance and urgency survive completion, older clients and Axis refresh", async () => {
  const app = setup();
  const { cookie, user } = await app.account("a@planner.test");
  const route = `/api/items/${uuid(30)}`;
  const saved = await app.call(route, { method: "PUT", cookie, body: { title: "Read", importance: "important", urgency: "not_urgent" } });
  assert.equal(saved.status, 200);
  const done = await app.call(route, { method: "PATCH", cookie, body: { completed: true } });
  assert.deepEqual([done.data.item.importance, done.data.item.urgency], ["important", "not_urgent"]);
  const legacy = await app.call(route, { method: "PUT", cookie, body: { title: "Older client edit" } });
  assert.deepEqual([legacy.data.item.importance, legacy.data.item.urgency], ["important", "not_urgent"]);
  const cleared = await app.call(route, { method: "PUT", cookie, body: { title: "Clear overrides", importance: null, urgency: "auto" } });
  assert.deepEqual([cleared.data.item.importance, cleared.data.item.urgency], [null, "auto"]);
  for (const fields of [{ importance: "yes" }, { urgency: "soon" }, { urgency: null }]) assert.equal((await app.call(route, { method: "PUT", cookie, body: { title: "Invalid", ...fields } })).status, 400);

  const fixture = fs.readFileSync(path.join(repoRoot, "tests/fixtures/axis-feed.ics"), "utf8");
  const fetchFeed = (text) => async () => new Response(text, { headers: { "Content-Type": "text/calendar" } });
  const feedLink = "https://example.myschoolapp.com/podium/feed/iCal.aspx?made-up-test-token";
  await syncUser(app.env, user.id, feedLink, { fetchImpl: fetchFeed(fixture) });
  const axisTask = (await app.call("/api/planner", { cookie })).data.items.find((row) => row.axis_uid === "6f1c2a9e-0d4b-4c7e-9a51-1b2c3d4e5f60");
  await app.call(`/api/items/${axisTask.id}`, { method: "PUT", cookie, body: { ...axisTask, importance: "not_important", urgency: "urgent" } });
  await syncUser(app.env, user.id, feedLink, { fetchImpl: fetchFeed(fixture.replace("Unit 1 Quiz", "Updated Quiz")) });
  const refreshed = (await app.call("/api/planner", { cookie })).data.items.find((row) => row.id === axisTask.id);
  assert.match(refreshed.title, /Updated Quiz/);
  assert.deepEqual([refreshed.importance, refreshed.urgency], ["not_important", "urgent"]);
});

test("imports atomically add classes before templates/resources and retain task metadata/preferences", async () => {
  const app = setup();
  const a = await app.account("a@planner.test"), b = await app.account("b@planner.test");
  const imported = await app.call("/api/import", { method: "POST", cookie: a.cookie, body: {
    classRows: [{ id: uuid(1), name: "Chemistry", color: "#ffcc44" }],
    itemRows: [{ id: uuid(30), title: "Review", class_id: uuid(1), importance: "important", urgency: "urgent" }],
    templateRows: [{ id: uuid(10), title: "Weekly lab", class_id: uuid(1), reminder_choice: "60" }],
    resourceRows: [{ id: uuid(20), title: "Textbook", class_id: uuid(1), url: "https://school.test/book" }],
    organization: { urgency_days: 4 },
  } });
  assert.equal(imported.status, 200, JSON.stringify(imported.data));
  assert.deepEqual(imported.data, { imported: 1, classesAdded: 1, templatesAdded: 1, resourcesAdded: 1 });
  const planner = (await app.call("/api/planner", { cookie: a.cookie })).data;
  assert.deepEqual([planner.templates[0].class_id, planner.resources[0].class_id], [uuid(1), uuid(1)]);
  assert.deepEqual([planner.items[0].importance, planner.items[0].urgency, planner.organization.urgency_days], ["important", "urgent", 4]);
  assert.deepEqual(app.broadcasts.at(-1).message, { reload: true });
  const collision = await app.call("/api/import", { method: "POST", cookie: b.cookie, body: {
    classRows: [{ id: uuid(2), name: "New", color: "#ffcc44" }], itemRows: [{ id: uuid(31), title: "New", class_id: uuid(2) }],
    templateRows: [{ id: uuid(10), title: "ID collision", class_id: uuid(2) }], organization: { urgency_days: 10 },
  } });
  assert.equal(collision.status, 409);
  assert.deepEqual((await app.call("/api/planner", { cookie: b.cookie })).data, { classes: [], items: [], templates: [], resources: [], organization: { urgency_days: 2 }, goals: [], habits: [], habit_checkins: [], notes: [] });
  const foreignClass = await app.call("/api/import", { method: "POST", cookie: b.cookie, body: {
    classRows: [{ id: uuid(2), name: "New", color: "#ffcc44" }], resourceRows: [{ id: uuid(21), title: "Foreign class", class_id: uuid(1), url: "https://school.test" }],
  } });
  assert.equal(foreignClass.status, 400);
  assert.deepEqual((await app.call("/api/planner", { cookie: b.cookie })).data.classes, []);
  assert.equal((await app.call("/api/import", { method: "POST", cookie: b.cookie, body: { itemRows: [{ id: uuid(32), title: "Old import" }] } })).status, 200);
  const old = (await app.call("/api/planner", { cookie: b.cookie })).data.items[0];
  assert.deepEqual([old.importance, old.urgency], [null, "auto"]);
  assert.equal((await app.call("/api/import", { method: "POST", cookie: b.cookie, body: { templateRows: "wrong" } })).status, 400);
  assert.equal((await app.call("/api/import", { method: "POST", cookie: b.cookie, body: null })).status, 400);
});

function keyedImport(offset, idempotencyKey) {
  const classId = uuid(offset + 1);
  return {
    idempotencyKey,
    classRows: [{ id: classId, name: "Saved class", color: "#ffcc44" }],
    itemRows: [{ id: uuid(offset + 30), title: "Saved task", class_id: classId, importance: "important", urgency: "urgent" }],
    templateRows: [{ id: uuid(offset + 10), title: "Saved template", class_id: classId }],
    resourceRows: [{ id: uuid(offset + 20), title: "Saved resource", class_id: classId, url: "https://school.test/resource" }],
    organization: { urgency_days: 7 },
  };
}

test("keyed import retries return the original receipt despite fresh row IDs, scoped separately to each user", async () => {
  const app = setup();
  const a = await app.account("a@planner.test"), b = await app.account("b@planner.test");
  const key = "ab".repeat(32);
  const first = await app.call("/api/import", { method: "POST", cookie: a.cookie, body: keyedImport(100, key) });
  const repeated = await app.call("/api/import", { method: "POST", cookie: a.cookie, body: keyedImport(200, key.toUpperCase()) });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal(repeated.status, 200, JSON.stringify(repeated.data));
  assert.deepEqual(repeated.data, first.data);
  const planner = (await app.call("/api/planner", { cookie: a.cookie })).data;
  assert.deepEqual([planner.classes.length, planner.items.length, planner.templates.length, planner.resources.length], [1, 1, 1, 1]);
  assert.equal(planner.items[0].id, uuid(130));
  assert.equal((await app.call("/api/import", { method: "POST", cookie: b.cookie, body: keyedImport(300, key) })).status, 200);
  assert.equal((await app.call("/api/planner", { cookie: b.cookie })).data.items[0].id, uuid(330));
  assert.equal(app.env.DB.raw.prepare("SELECT count(*) AS n FROM planner_imports").get().n, 2);
});

test("concurrent duplicate import keys roll back the duplicate transaction before any second copy is inserted", async () => {
  const app = setup();
  const { cookie } = await app.account("a@planner.test");
  let receiptTransactions = 0;
  // Hold the first two receipt reads until both have seen the missing key, reproducing the
  // race that is otherwise hidden by the in-memory database's synchronous transaction work.
  const prepare = app.env.DB.prepare.bind(app.env.DB);
  let initialReads = 0, releaseReads;
  const bothRead = new Promise((resolve) => { releaseReads = resolve; });
  app.env.DB.prepare = (sql) => {
    const statement = prepare(sql);
    if (!sql.startsWith("SELECT imported, classes_added")) return statement;
    const bind = statement.bind.bind(statement);
    statement.bind = (...params) => {
      const bound = bind(...params), first = bound.first.bind(bound);
      bound.first = async () => {
        const row = await first();
        initialReads += 1;
        if (initialReads <= 2) {
          if (initialReads === 2) releaseReads();
          await bothRead;
        }
        return row;
      };
      return bound;
    };
    return statement;
  };
  const batch = app.env.DB.batch.bind(app.env.DB);
  app.env.DB.batch = async (statements) => {
    if (statements[0]?.sql.startsWith("INSERT INTO planner_imports")) receiptTransactions += 1;
    return batch(statements);
  };
  const key = "c".repeat(64);
  const responses = await Promise.all([400, 500].map((offset) => app.call("/api/import", { method: "POST", cookie, body: keyedImport(offset, key) })));
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.deepEqual(responses[0].data, responses[1].data);
  assert.equal(receiptTransactions, 2, "both requests reached their receipt-first transactions");
  const planner = (await app.call("/api/planner", { cookie })).data;
  assert.deepEqual([planner.classes.length, planner.items.length, planner.templates.length, planner.resources.length], [1, 1, 1, 1]);
  assert.equal(app.env.DB.raw.prepare("SELECT count(*) AS n FROM planner_imports").get().n, 1);
});

test("invalid import keys are rejected and failed batches do not consume their key", async () => {
  const app = setup();
  const { cookie } = await app.account("a@planner.test");
  for (const idempotencyKey of [null, 123, "", "a".repeat(63), "a".repeat(65), "g".repeat(64)]) {
    assert.equal((await app.call("/api/import", { method: "POST", cookie, body: { idempotencyKey } })).status, 400);
  }
  const key = "d".repeat(64), invalid = keyedImport(600, key);
  invalid.resourceRows[0].class_id = uuid(999);
  assert.equal((await app.call("/api/import", { method: "POST", cookie, body: invalid })).status, 400);
  assert.equal(app.env.DB.raw.prepare("SELECT count(*) AS n FROM planner_imports").get().n, 0);
  assert.equal((await app.call("/api/import", { method: "POST", cookie, body: keyedImport(600, key) })).status, 200);
  assert.equal(app.env.DB.raw.prepare("SELECT count(*) AS n FROM planner_imports").get().n, 1);
  assert.equal((await app.call("/api/planner", { cookie })).data.items.length, 1);
});
