// The Cloudflare Worker backend (cloudflare/src) against a real SQLite copy of the D1 schema.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { handleRequest } from "../cloudflare/src/index.js";
import { syncDueConnections } from "../cloudflare/src/axis.js";
import { ORIGIN, createCtx, createFakeEnv, repoRoot } from "./support/fake-cloudflare.mjs";

const require = createRequire(import.meta.url);
const Store = require("../landing/planner-store.js");
const Model = require("../landing/planner-model.js");
const fixture = fs.readFileSync(path.join(repoRoot, "tests/fixtures/axis-feed.ics"), "utf8");
const FEED_LINK = "webcal://example.myschoolapp.com/podium/feed/iCal.aspx?z=made-up-test-token";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function setup(overrides) {
  const fake = createFakeEnv(overrides);
  const ctx = createCtx();
  let feedText = fixture;
  const feedRequests = [];
  const fetchImpl = async (url, init) => { feedRequests.push({ url, init }); return new Response(feedText, { status: 200, headers: { "Content-Type": "text/calendar" } }); };
  async function call(pathname, { method = "GET", body, cookie, origin = ORIGIN, headers = {} } = {}) {
    const init = { method, headers: { ...headers } };
    if (cookie) init.headers.Cookie = cookie;
    if (origin && method !== "GET") init.headers.Origin = origin;
    if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    const response = await handleRequest(new Request(`${ORIGIN}${pathname}`, init), fake.env, ctx, { fetchImpl });
    await ctx.settle();
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, headers: response.headers };
  }
  async function signIn(email) {
    const sent = await call("/api/auth/email", { method: "POST", body: { email, next: "/" } });
    assert.equal(sent.status, 200);
    const link = new URL(fake.emails.at(-1).text.match(/https:\/\/\S+/)[0]);
    const verified = await call("/api/auth/email/verify", { method: "POST", body: { token: link.searchParams.get("login_token") } });
    assert.equal(verified.status, 200);
    return { cookie: verified.headers.get("set-cookie").split(";")[0], user: verified.data.user, link };
  }
  return { ...fake, ctx, call, signIn, feedRequests, fetchImpl, setFeed: (text) => { feedText = text; } };
}

test("magic links sign in once, set an HttpOnly session cookie, and are rate limited", async () => {
  const app = setup();
  const { cookie, user, link } = await app.signIn("Duck@School.test");
  assert.equal(user.email, "duck@school.test");
  assert.equal(link.origin, ORIGIN);
  assert.equal(app.emails[0].to, "duck@school.test");
  assert.equal(app.emails[0].from, "sign-in@duckplan.test");
  assert.match(cookie, /^duckplan_session=/);
  const session = await app.call("/api/session", { cookie });
  assert.equal(session.data.user.id, user.id);
  assert.equal(session.data.providers.google, false);

  const reused = await app.call("/api/auth/email/verify", { method: "POST", body: { token: link.searchParams.get("login_token") } });
  assert.equal(reused.status, 400, "a sign-in link works only once");
  const stored = app.env.DB.raw.prepare("SELECT token_hash FROM sessions").all();
  assert.ok(stored.every((row) => !cookie.includes(row.token_hash)), "only a hash of the session token is stored");

  // Links that were used to sign in don't count toward the limit; only unused ones do.
  await app.signIn("duck@school.test");
  await app.signIn("duck@school.test");
  for (let sent = 0; sent < 3; sent += 1) assert.equal((await app.call("/api/auth/email", { method: "POST", body: { email: "duck@school.test" } })).status, 200);
  const limited = await app.call("/api/auth/email", { method: "POST", body: { email: "duck@school.test" } });
  assert.equal(limited.status, 429);
  assert.match(limited.data.error, /already sent 3 sign-in links.*try again in 15 minutes/);
  assert.equal((await app.call("/api/auth/email", { method: "POST", body: { email: "other@school.test" } })).status, 200, "the limit is per address");

  const signedOut = await app.call("/api/auth/sign-out", { method: "POST", cookie });
  assert.match(signedOut.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await app.call("/api/session", { cookie })).data.user, null);
});

test("sign-in links only redirect within the site", async () => {
  const app = setup();
  for (const next of ["https://evil.test/", "//evil.test/", "/api/session"]) {
    await app.call("/api/auth/email", { method: "POST", body: { email: `x${app.emails.length}@a.test`, next } });
    assert.equal(new URL(app.emails.at(-1).text.match(/https:\/\/\S+/)[0]).pathname, "/");
  }
});

test("the API needs a session and refuses cross-site writes", async () => {
  const app = setup();
  assert.equal((await app.call("/api/planner")).status, 401);
  assert.equal((await app.call(`/api/items/${uuid(1)}`, { method: "PUT", body: { title: "x" } })).status, 401);
  const { cookie } = await app.signIn("a@a.test");
  const crossSite = await app.call(`/api/items/${uuid(1)}`, { method: "PUT", cookie, origin: "https://evil.test", body: { title: "x" } });
  assert.equal(crossSite.status, 403);
  const notJson = await handleRequest(new Request(`${ORIGIN}/api/items/${uuid(1)}`, { method: "PUT", headers: { Cookie: cookie, "Content-Type": "text/plain" }, body: "{}" }), app.env, app.ctx);
  assert.equal(notJson.status, 415, "form posts can't reach the JSON API");
});

test("user A can't read or change user B's rows (replaces the Postgres RLS test)", async () => {
  const app = setup();
  const a = await app.signIn("a@a.test");
  const b = await app.signIn("b@b.test");
  assert.equal((await app.call(`/api/classes/${uuid(10)}`, { method: "PUT", cookie: a.cookie, body: { name: "Calc", color: "#538fc5" } })).status, 200);
  assert.equal((await app.call(`/api/items/${uuid(20)}`, { method: "PUT", cookie: a.cookie, body: { title: "A's task", class_id: uuid(10) } })).status, 200);

  const bView = await app.call("/api/planner", { cookie: b.cookie });
  assert.deepEqual(bView.data, { classes: [], items: [] });
  assert.equal((await app.call(`/api/items/${uuid(20)}`, { method: "PUT", cookie: b.cookie, body: { title: "hijack" } })).status, 404);
  assert.equal((await app.call(`/api/items/${uuid(20)}`, { method: "PATCH", cookie: b.cookie, body: { completed: true } })).status, 404);
  assert.equal((await app.call(`/api/items/${uuid(20)}`, { method: "DELETE", cookie: b.cookie })).status, 200);
  assert.equal((await app.call(`/api/classes/${uuid(10)}`, { method: "PUT", cookie: b.cookie, body: { name: "Mine now", color: "#000000" } })).status, 404);
  const linked = await app.call(`/api/items/${uuid(21)}`, { method: "PUT", cookie: b.cookie, body: { title: "Uses A's class", class_id: uuid(10) } });
  assert.equal(linked.status, 400, "an item can only point at its owner's class");

  const aView = await app.call("/api/planner", { cookie: a.cookie });
  assert.deepEqual(aView.data.items.map((row) => [row.title, row.completed, row.deleted_at]), [["A's task", 0, null]]);
  assert.equal(aView.data.classes[0].name, "Calc");

  // The schema refuses the same thing even if Worker code forgot the check.
  assert.throws(() => app.env.DB.raw.prepare("INSERT INTO items (id, user_id, class_id, title) VALUES (?, ?, ?, 'x')").run(uuid(22), b.user.id, uuid(10)), /another user/);
});

test("items keep the deadline/schedule split, track completed_at, soft-delete, and broadcast", async () => {
  const app = setup();
  const { cookie, user } = await app.signIn("a@a.test");
  const id = uuid(30);
  const saved = await app.call(`/api/items/${id}`, { method: "PUT", cookie, body: { title: "Quiz", type: "test", priority: "high", due_date: "2026-11-03", due_time: "08:30", scheduled_start: "2026-11-02T19:00", duration_minutes: 60, completed: false, source: "axis", axis_uid: "spoof" } });
  assert.equal(saved.status, 200);
  assert.deepEqual([saved.data.item.due_date, saved.data.item.due_time, saved.data.item.scheduled_start], ["2026-11-03", "08:30", "2026-11-02T19:00"]);
  assert.deepEqual([saved.data.item.source, saved.data.item.axis_uid], ["manual", null], "the browser can't write Axis bookkeeping");
  assert.deepEqual(app.broadcasts.at(-1), { userId: user.id, message: { table: "items", row: saved.data.item } });

  const done = await app.call(`/api/items/${id}`, { method: "PATCH", cookie, body: { completed: true } });
  assert.ok(done.data.item.completed_at);
  const resaved = await app.call(`/api/items/${id}`, { method: "PUT", cookie, body: { ...saved.data.item, completed: true, title: "Quiz (edited)" } });
  assert.equal(resaved.data.item.completed_at, done.data.item.completed_at, "editing a completed task keeps when it was completed");
  assert.equal((await app.call(`/api/items/${id}`, { method: "PATCH", cookie, body: { completed: false } })).data.item.completed_at, null);

  assert.equal((await app.call(`/api/items/${id}`, { method: "PUT", cookie, body: { title: "x", due_date: "2026-02-30" } })).status, 400);
  assert.equal((await app.call(`/api/items/${id}`, { method: "PUT", cookie, body: { title: "" } })).status, 400);
  assert.equal((await app.call("/api/items/not-a-uuid", { method: "PUT", cookie, body: { title: "x" } })).status, 400);

  await app.call(`/api/items/${id}`, { method: "DELETE", cookie });
  assert.equal((await app.call("/api/planner", { cookie })).data.items.length, 0);
  assert.ok(app.env.DB.raw.prepare("SELECT deleted_at FROM items WHERE id = ?").get(id).deleted_at, "deletes set deleted_at instead of removing the row");
  assert.ok(app.broadcasts.at(-1).message.row.deleted_at, "other devices hear about the deletion");
});

test("schema checks reject bad colors, dates, and times even without the Worker's validation", () => {
  const { env } = createFakeEnv();
  const db = env.DB.raw;
  db.prepare("INSERT INTO users (id, email) VALUES ('u', 'u@a.test')").run();
  const addClass = (id, color) => db.prepare("INSERT INTO classes (id, user_id, name, color) VALUES (?, 'u', 'C', ?)").run(id, color);
  addClass("c-ok", "#A1b2C3");
  for (const color of ["#12345g", "123456", "#12345", "#1234567"]) assert.throws(() => addClass(`c-${color}`, color), /CHECK/, color);
  const addItem = (id, column, value) => db.prepare(`INSERT INTO items (id, user_id, title, ${column}) VALUES (?, 'u', 'x', ?)`).run(id, value);
  addItem("i-ok", "scheduled_start", "2026-11-04T15:30");
  for (const value of ["2026-11-04 15:30", "2026-13-04T15:30", "2026-11-04T99:30", "soon"]) assert.throws(() => addItem(`i-${value}`, "scheduled_start", value), /CHECK/, value);
  assert.throws(() => addItem("i-date", "due_date", "2026-02-30"), /CHECK/);
});

test("the live endpoint requires a session and same-origin, then hands off to the user's Durable Object", async () => {
  const app = setup();
  const { cookie, user } = await app.signIn("a@a.test");
  const upgrade = { Upgrade: "websocket" };
  assert.equal((await app.call("/api/live", { headers: upgrade })).status, 401);
  assert.equal((await app.call("/api/live", { cookie, headers: { ...upgrade, Origin: "https://evil.test" } })).status, 403);
  const ok = await app.call("/api/live", { cookie, headers: upgrade });
  assert.equal(ok.data, `live socket for ${user.id}`);
});

test("Axis connect imports classes and items, re-syncs without duplicates, and never returns the link", async () => {
  const app = setup();
  const { cookie } = await app.signIn("a@a.test");
  const bad = await app.call("/api/axis", { method: "POST", cookie, body: { mode: "connect", icalUrl: "https://evil.test/podium/feed/iCal.aspx" } });
  assert.equal(bad.status, 400);
  assert.equal(app.feedRequests.length, 0, "links outside myschoolapp.com are never fetched");

  const connected = await app.call("/api/axis", { method: "POST", cookie, body: { mode: "connect", icalUrl: FEED_LINK } });
  assert.equal(connected.status, 200, JSON.stringify(connected.data));
  assert.deepEqual([connected.data.added, connected.data.classesAdded], [5, 4]);
  assert.equal(app.feedRequests[0].url, FEED_LINK.replace("webcal://", "https://"));
  assert.equal(app.feedRequests[0].init.redirect, "manual");
  assert.deepEqual(app.broadcasts.at(-1).message, { reload: true });

  const status = await app.call("/api/axis", { cookie });
  assert.equal(status.data.connected, true);
  assert.ok(!JSON.stringify(status.data).includes("made-up-test-token"), "the feed link never leaves the server");

  const planner = (await app.call("/api/planner", { cookie })).data;
  assert.equal(planner.items.length, 5);
  assert.ok(planner.items.every((row) => row.source === "axis" && row.class_id && row.due_time === null));
  const quiz = planner.items.find((row) => row.title === "Unit 1 Quiz");
  assert.equal(quiz.type, "test");

  // The student completes one item and edits another's priority; then the feed drops an item and renames one.
  await app.call(`/api/items/${quiz.id}`, { method: "PATCH", cookie, body: { completed: true } });
  const proposal = planner.items.find((row) => row.title === "Project Proposal");
  await app.call(`/api/items/${proposal.id}`, { method: "PUT", cookie, body: { ...proposal, priority: "high", scheduled_start: "2026-11-05T15:00" } });
  app.setFeed(fixture.replace("Unit 1 Quiz", "Unit 1 Quiz (moved)").replace("Project Proposal", "Project Proposal v2").replace(/BEGIN:VEVENT(?:(?!END:VEVENT)[\s\S])*Lab Report(?:(?!END:VEVENT)[\s\S])*END:VEVENT\r?\n/, ""));
  app.env.DB.raw.prepare("UPDATE axis_connections SET last_attempted_at = '2000-01-01T00:00:00.000Z'").run();
  const resync = await app.call("/api/axis", { method: "POST", cookie, body: { mode: "sync" } });
  assert.deepEqual([resync.data.added, resync.data.updated, resync.data.removed, resync.data.classesAdded], [0, 1, 1, 0]);

  const after = (await app.call("/api/planner", { cookie })).data.items;
  assert.equal(after.length, 5, "re-syncs never create duplicates and never delete");
  assert.equal(after.find((row) => row.id === quiz.id).title, "Unit 1 Quiz", "completed items are never touched");
  const renamed = after.find((row) => row.id === proposal.id);
  assert.deepEqual([renamed.title, renamed.priority, renamed.scheduled_start], ["Project Proposal v2", "high", "2026-11-05T15:00"], "Axis only rewrites the fields it owns");
  assert.equal(after.find((row) => row.title.startsWith("Lab Report")).axis_missing, 1);

  assert.equal((await app.call("/api/axis", { method: "POST", cookie, body: { mode: "sync" } })).status, 429, "Sync now is rate limited");
  const runs = app.env.DB.raw.prepare("SELECT status FROM sync_runs").all();
  assert.deepEqual(runs.map((row) => row.status), ["ok", "ok"]);

  await app.call("/api/axis", { method: "DELETE", cookie });
  assert.equal((await app.call("/api/axis", { cookie })).data.connected, false);
  assert.equal((await app.call("/api/planner", { cookie })).data.items.length, 5, "disconnecting keeps imported items");
});

test("a failing feed records the error without leaking details", async () => {
  const app = setup();
  const { cookie } = await app.signIn("a@a.test");
  await app.call("/api/axis", { method: "POST", cookie, body: { mode: "connect", icalUrl: FEED_LINK } });
  app.setFeed("<html>not a calendar</html>");
  app.env.DB.raw.prepare("UPDATE axis_connections SET last_attempted_at = NULL").run();
  const failed = await app.call("/api/axis", { method: "POST", cookie, body: { mode: "sync" } });
  assert.equal(failed.status, 502);
  assert.match((await app.call("/api/axis", { cookie })).data.lastError, /didn't return an Axis calendar/);
});

test("the cron trigger re-syncs only connections that are due, oldest first", async () => {
  const app = setup({ AXIS_SYNC_INTERVAL_HOURS: "4", AXIS_SYNC_PER_RUN: "1" });
  const a = await app.signIn("a@a.test");
  const b = await app.signIn("b@b.test");
  await app.call("/api/axis", { method: "POST", cookie: a.cookie, body: { mode: "connect", icalUrl: FEED_LINK } });
  await app.call("/api/axis", { method: "POST", cookie: b.cookie, body: { mode: "connect", icalUrl: FEED_LINK } });
  assert.deepEqual(await syncDueConnections(app.env, { fetchImpl: app.fetchImpl }), { ok: 0, failed: 0 }, "nothing is due yet");
  app.env.DB.raw.prepare("UPDATE axis_connections SET last_attempted_at = ? WHERE user_id = ?").run("2000-01-01T00:00:00.000Z", b.user.id);
  app.env.DB.raw.prepare("UPDATE axis_connections SET last_attempted_at = ? WHERE user_id = ?").run("2001-01-01T00:00:00.000Z", a.user.id);
  assert.deepEqual(await syncDueConnections(app.env, { fetchImpl: app.fetchImpl }), { ok: 1, failed: 0 });
  const attempted = app.env.DB.raw.prepare("SELECT user_id, last_attempted_at FROM axis_connections ORDER BY last_attempted_at").all();
  assert.equal(attempted[0].user_id, a.user.id, "B (the oldest) went first; A waits for the next run");
});

test("Google sign-in uses state, nonce, and PKCE and links to an existing email account", async () => {
  const app = setup({ GOOGLE_CLIENT_ID: "client-123", GOOGLE_CLIENT_SECRET: "secret" });
  const existing = await app.signIn("student@school.test");
  const start = await app.call("/api/auth/google?next=/");
  assert.equal(start.status, 302);
  const google = new URL(start.headers.get("location"));
  assert.equal(google.host, "accounts.google.com");
  assert.equal(google.searchParams.get("code_challenge_method"), "S256");
  assert.equal(google.searchParams.get("redirect_uri"), `${ORIGIN}/api/auth/google/callback`);
  const oauthCookie = start.headers.get("set-cookie").split(";")[0];

  const wrongState = await app.call("/api/auth/google/callback?code=c&state=nope", { cookie: oauthCookie });
  assert.match(new URL(wrongState.headers.get("location")).searchParams.get("sign_in_error"), /timed out/);

  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = { iss: "https://accounts.google.com", aud: "client-123", exp: Math.floor(Date.now() / 1000) + 600, nonce: google.searchParams.get("nonce"), sub: "g-1", email: "student@school.test", email_verified: true, name: "Student" };
  const realFetch = globalThis.fetch;
  let tokenRequest = null;
  globalThis.fetch = async (url, init) => { tokenRequest = { url, body: new URLSearchParams(init.body) }; return Response.json({ id_token: `x.${encode(claims)}.sig` }); };
  try {
    const done = await app.call(`/api/auth/google/callback?code=abc&state=${google.searchParams.get("state")}`, { cookie: oauthCookie });
    assert.equal(done.status, 302);
    assert.equal(done.headers.get("location"), `${ORIGIN}/`);
    assert.ok(tokenRequest.body.get("code_verifier"));
    const session = done.headers.getSetCookie().find((value) => value.startsWith("duckplan_session="));
    assert.equal((await app.call("/api/session", { cookie: session.split(";")[0] })).data.user.id, existing.user.id, "same email, same account");

    claims.email_verified = false;
    const unverified = await app.call(`/api/auth/google/callback?code=abc&state=${google.searchParams.get("state")}`, { cookie: oauthCookie });
    assert.match(new URL(unverified.headers.get("location")).searchParams.get("sign_in_error"), /didn't confirm/);
  } finally { globalThis.fetch = realFetch; }
});

test("the Worker serves a cloud-config.js that turns cloud sync on, and passes other paths to static assets", async () => {
  const app = setup({ ASSETS: { fetch: async (request) => new Response(`asset ${new URL(request.url).pathname}`) } });
  const config = await app.call("/cloud-config.js");
  assert.match(config.data, /apiUrl: "\/api"/);
  assert.equal((await app.call("/index.html")).data, "asset /index.html");
  assert.match(fs.readFileSync(path.join(repoRoot, "landing/cloud-config.js"), "utf8"), /apiUrl: ""/, "the static copy stays local-only");
});

// The real browser store, driven against the real Worker ----------------------------------------

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
}
class FakeSocket {
  static sockets = [];
  constructor(url) { this.url = url; FakeSocket.sockets.push(this); }
  send() {}
  close() { this.closed = true; }
  receive(message) { this.onmessage({ data: JSON.stringify(message) }); }
}
function browserStore(app, { cookieJar, storage = memoryStorage(), href = `${ORIGIN}/` } = {}) {
  const location = { href, assign(url) { this.assigned = url; } };
  const history = { state: null, replaceState(state, title, url) { location.href = new URL(url, ORIGIN).href; } };
  const fetchImpl = async (url, init = {}) => {
    const headers = { ...(init.headers || {}), Origin: ORIGIN };
    if (cookieJar.value) headers.Cookie = cookieJar.value;
    const response = await handleRequest(new Request(new URL(url, ORIGIN), { ...init, headers }), app.env, app.ctx, { fetchImpl: app.fetchImpl });
    await app.ctx.settle();
    const setCookie = response.headers.get("set-cookie");
    if (setCookie?.startsWith("duckplan_session=")) cookieJar.value = setCookie.includes("Max-Age=0") ? null : setCookie.split(";")[0];
    return response;
  };
  const store = Store.createPlannerStore({
    storage, model: Model, defaultClasses: () => [{ id: "personal", name: "Personal", color: "#c48b34", code: "★" }],
    defaultTasks: () => [{ id: "demo-1", title: "Local demo", className: "Personal", dueDate: "2026-11-04" }],
    config: { apiUrl: "/api" }, redirectPath: "/", fetchImpl, WebSocketImpl: FakeSocket, locationRef: location, historyRef: history, documentRef: null,
  });
  return { store, location };
}

test("browser store: a magic link signs in, imports local tasks once, and syncs writes to D1", async () => {
  const app = setup();
  const jar = { value: null };
  await app.call("/api/auth/email", { method: "POST", body: { email: "a@a.test", next: "/" } });
  const link = app.emails.at(-1).text.match(/https:\/\/\S+/)[0];
  const { store, location } = browserStore(app, { cookieJar: jar, href: link });
  await store.init();
  assert.equal(store.mode, "cloud");
  assert.equal(store.user.email, "a@a.test");
  assert.ok(!location.href.includes("login_token"), "the token is removed from the address bar");
  assert.equal(FakeSocket.sockets.at(-1).url, "wss://duckplan.test/api/live");

  assert.equal(await store.localImportOffer(), 1);
  assert.equal(await store.importLocalTasks(), 1);
  assert.equal(await store.localImportOffer(), 0, "the offer only appears once per account");
  const [imported] = store.listItems();
  assert.equal(store.classById(imported.classId).name, "Personal");

  const added = await store.upsertItem({ title: "Essay", dueDate: "2026-11-06", dueTime: "23:59", priority: "High", classId: imported.classId });
  await store.toggleComplete(added.id, true);
  await store.deleteItem(imported.id);
  const rows = (await app.call("/api/planner", { cookie: jar.value })).data.items;
  assert.deepEqual(rows.map((row) => [row.title, row.priority, row.due_time, row.completed]), [["Essay", "high", "23:59", 1]]);
});

test("browser store: live messages from another device update the cache, and failed writes roll back", async () => {
  const app = setup();
  const a = await app.signIn("a@a.test");
  const jar = { value: a.cookie };
  const { store } = browserStore(app, { cookieJar: jar });
  await store.init();
  const socket = FakeSocket.sockets.at(-1);
  socket.receive({ table: "items", row: { id: uuid(40), title: "From phone", priority: "medium", completed: 0, deleted_at: null } });
  assert.deepEqual(store.listItems().map((task) => task.title), ["From phone"]);
  socket.receive({ table: "items", row: { id: uuid(40), title: "From phone", priority: "medium", completed: 0, deleted_at: "2026-11-04T00:00:00Z" } });
  assert.equal(store.listItems().length, 0, "a soft delete elsewhere removes the task here");

  const reasons = [];
  store.subscribe(({ reason }) => reasons.push(reason));
  await assert.rejects(store.upsertItem({ title: "" }), /Title is required/);
  assert.equal(store.listItems().length, 0);
  assert.deepEqual(reasons, ["local", "error"]);

  await store.signOut();
  assert.equal(store.mode, "local");
  assert.equal(jar.value, null);
});

test("browser store: an expired sign-in link falls back to local mode with a message", async () => {
  const app = setup();
  const { store } = browserStore(app, { cookieJar: { value: null }, href: `${ORIGIN}/?login_token=expired#settings` });
  await store.init();
  assert.equal(store.mode, "local");
  assert.match(store.takeAuthError(), /expired or was already used/);
  assert.equal(store.takeAuthError(), null);
});
