import test from "node:test";
import assert from "node:assert/strict";
import { checkServerCompatibility } from "../tools/check-server-compatibility.mjs";
import { handleRequest } from "../cloudflare/src/index.js";
import { ORIGIN, createCtx, createFakeEnv } from "./support/fake-cloudflare.mjs";

const origin = "https://duckplan.example";
const complete = { classes: [], items: [], templates: [], resources: [], organization: {}, goals: [], habits: [], habit_checkins: [], notes: [] };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

test("old signed-in server data fails the release gate instead of treating core tasks as full compatibility", async () => {
  const result = await checkServerCompatibility({ origin, cookie: "session=fixture", fetchImpl: async () => response({ classes: [], items: [] }) });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "incompatible-planner");
  assert.equal(result.features.tasks, true);
  assert.equal(result.features.templates, false);
  assert.equal(result.features.notes, false);
  assert.ok(result.missing.includes("organization"));
});

test("anonymous auth protection is blocked evidence, never a feature pass", async () => {
  const result = await checkServerCompatibility({ origin, fetchImpl: async () => response({ error: "Sign in" }, 401) });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "authentication-required");
  assert.equal(result.features, undefined);
});

test("malformed, failed and unreachable snapshots never pass", async () => {
  for (const fetchImpl of [async () => response({}, 500), async () => new Response("not json", { headers: { "Content-Type": "application/json" } }), async () => response(null), async () => { throw new TypeError("network"); }]) {
    assert.equal((await checkServerCompatibility({ origin, fetchImpl })).ok, false);
  }
});

test("a complete snapshot with wrong or missing content type cannot pass the native contract gate", async () => {
  for (const headers of [{ "Content-Type": "text/plain" }, {}]) {
    const result = await checkServerCompatibility({ origin, fetchImpl: async () => new Response(new TextEncoder().encode(JSON.stringify(complete)), { headers }) });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "invalid-content-type");
  }
});

test("native response size and UTF-8 requirements reject otherwise readable snapshots", async () => {
  const large = await checkServerCompatibility({ origin, fetchImpl: async () => response({ ...complete, padding: "x".repeat(8_000_000) }) });
  assert.equal(large.ok, false);
  assert.equal(large.reason, "response-too-large");
  const invalid = new Uint8Array([...new TextEncoder().encode('{"padding":"'), 0xff, ...new TextEncoder().encode('","classes":[]}')]);
  const utf8 = await checkServerCompatibility({ origin, fetchImpl: async () => new Response(invalid, { headers: { "Content-Type": "application/json" } }) });
  assert.equal(utf8.ok, false);
  assert.equal(utf8.reason, "invalid-json");
});

test("partial library/personal contracts match the frontend's group availability gates", async () => {
  const result = await checkServerCompatibility({ origin, fetchImpl: async () => response({ ...complete, resources: null, notes: null }) });
  assert.equal(result.features.templates, false);
  assert.equal(result.features.goals, false);
  assert.equal(result.features.habits, false);
  assert.deepEqual(result.missing, ["resources", "notes"]);
});

test("compatibility check is GET-only, refuses redirects, and emits no records or session values", async () => {
  const calls = [];
  const result = await checkServerCompatibility({ origin, cookie: "session=private-fixture", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return response({ ...complete, items: [{ title: "private title" }] });
  } });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${origin}/api/planner`);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers.Cookie, "session=private-fixture");
  assert.doesNotMatch(JSON.stringify(result), /private-fixture|private title/);
  await assert.rejects(checkServerCompatibility({ origin: "https://user:secret@host.example" }), /without credentials/);
  await assert.rejects(checkServerCompatibility({ origin: "http://host.example" }), /loopback/);
});

test("current authenticated Worker contract passes with an isolated account and no release-gate writes", async () => {
  const fake = createFakeEnv(), ctx = createCtx();
  const account = await handleRequest(new Request(`${ORIGIN}/api/auth/sign-up`, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ email: "compatibility@fixture.test", password: "isolated compatibility password" }) }), fake.env, ctx);
  assert.equal(account.status, 201);
  const cookie = account.headers.get("set-cookie").split(";")[0];
  const methods = [];
  const result = await checkServerCompatibility({ origin: ORIGIN, cookie, fetchImpl: async (url, options) => {
    methods.push(options.method);
    return handleRequest(new Request(url, options), fake.env, ctx);
  } });
  await ctx.settle();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(Object.values(result.features).every(Boolean));
  assert.deepEqual(methods, ["GET"]);
});
