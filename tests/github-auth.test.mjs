import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { handleRequest } from "../cloudflare/src/index.js";
import { findOrCreateGoogleUser } from "../cloudflare/src/auth.js";
import { githubNextPath } from "../cloudflare/src/github-auth.js";
import { sha256, sha256Base64Url } from "../cloudflare/src/http.js";
import { ORIGIN, createFakeEnv, createCtx } from "./support/fake-cloudflare.mjs";

function setup(overrides = {}) {
  const fixture = createFakeEnv({ GITHUB_CLIENT_ID: "test-github-client", GITHUB_CLIENT_SECRET: "test-only-secret", ...overrides });
  const ctx = createCtx();
  async function call(path, { method = "GET", cookie = "", body, origin = ORIGIN } = {}) {
    const headers = { Cookie: cookie };
    if (method !== "GET" && origin) headers.Origin = origin;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return handleRequest(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), fixture.env, ctx);
  }
  async function begin(options = {}) {
    const response = await call("/api/auth/github?next=" + encodeURIComponent(options.next || "/#calendar"), options);
    assert.ok([200, 302].includes(response.status));
    const url = new URL(response.status === 200 ? (await response.json()).url : response.headers.get("Location"));
    const cookie = response.headers.getSetCookie()[0].split(";")[0];
    return { response, url, cookie, state: url.searchParams.get("state") };
  }
  const finish = (start, options = {}) => call(`/api/auth/github/callback?state=${start.state}&code=fixture-code`, { cookie: start.cookie, ...options });
  async function password(email) {
    const response = await call("/api/auth/sign-up", { method: "POST", body: { email, password: "isolated test password" } });
    assert.equal(response.status, 201);
    return { user: (await response.json()).user, cookie: response.headers.getSetCookie()[0].split(";")[0] };
  }
  return { ...fixture, call, begin, finish, password };
}
const errorOf = response => new URL(response.headers.get("Location")).searchParams.get("sign_in_error");
const sessionCookie = response => response.headers.getSetCookie().find(value => value.startsWith("duckplan_session="))?.split(";")[0];
function provider(t, { id = 123456, email = "github-user@example.test", verified = true, name = "GitHub Student", failAt = "" } = {}) {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url, init });
    if (url.includes(failAt) && failAt) throw new Error("fixture provider token must never be reflected");
    if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "fixture-token-never-log", token_type: "bearer" });
    if (url === "https://api.github.com/user") return Response.json({ id, login: "fixture-login", name, email: "untrusted-public-profile@example.test" });
    if (url === "https://api.github.com/user/emails?per_page=100") return Response.json([{ email, verified, primary: true }]);
    throw Error("Unexpected provider URL");
  });
  return requests;
}

test("GitHub is unavailable until both credentials and its additive schema are present", async () => {
  for (const overrides of [{ GITHUB_CLIENT_ID: "" }, { GITHUB_CLIENT_SECRET: "" }]) {
    const app = setup(overrides);
    assert.equal((await (await app.call("/api/session")).json()).providers.github, false);
    assert.equal((await app.call("/api/auth/github")).status, 503);
  }
  const app = setup(); app.env.DB.raw.exec("DROP TABLE github_oauth_transactions");
  assert.equal((await (await app.call("/api/session")).json()).providers.github, false);
});
test("GitHub uses opaque provider-specific browser state, server PKCE, limited scopes and safe return paths", async () => {
  const app = setup(); app.env.DB.raw.exec("DROP TABLE oauth_transactions"); // Google draft is not a dependency.
  const start = await app.begin({ next: "/?view=week#calendar" });
  assert.equal(start.url.origin, "https://github.com");
  assert.equal(start.url.searchParams.get("redirect_uri"), ORIGIN + "/api/auth/github/callback");
  assert.equal(start.url.searchParams.get("scope"), "read:user user:email");
  const transaction = app.env.DB.raw.prepare("SELECT * FROM github_oauth_transactions").get();
  assert.equal(start.url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(start.url.searchParams.get("code_challenge"), await sha256Base64Url(transaction.verifier));
  assert.equal(transaction.state_hash, await sha256(start.state));
  assert.equal(transaction.next_path, "/?view=week#calendar");
  assert(!start.cookie.includes(transaction.verifier));
  assert.match(start.response.headers.get("Set-Cookie"), /Path=\/api\/auth\/github; SameSite=Lax; Max-Age=600; HttpOnly; Secure/);
  assert.equal(start.response.headers.get("Cache-Control"), "no-store");
  for (const value of ["//evil.test", "/\\evil.test", "/%2f%2fevil.test", "/%5cevil.test", "/api/auth/github", "/%61pi/auth/github", "/\nfoo", "https://evil.test", "/%ZZ"]) assert.equal(githubNextPath(value), "/", value);
});
test("successful GitHub callback verifies API identity/email, issues a hashed session and rejects replay", async t => {
  const app = setup(), requests = provider(t), start = await app.begin();
  const response = await app.finish(start); assert.equal(errorOf(response), null);
  assert.equal(response.headers.get("Location"), ORIGIN + "/#calendar");
  const cookie = sessionCookie(response), session = await (await app.call("/api/session", { cookie })).json();
  assert.equal(session.user.displayName, "GitHub Student"); assert.equal(session.user.email, "github-user@example.test"); assert.equal(session.user.hasGitHub, true);
  assert.equal(session.user.hasPassword, false); assert(!JSON.stringify(session).includes("fixture-token"));
  const tokenBody = new URLSearchParams(requests[0].init.body); assert(tokenBody.get("code_verifier")); assert.equal(tokenBody.get("client_secret"), "test-only-secret");
  assert.equal(app.env.DB.raw.prepare("SELECT token_hash FROM sessions").get().token_hash, await sha256(decodeURIComponent(cookie.split("=")[1])));
  assert.equal(app.env.DB.raw.prepare("SELECT count(*) AS n FROM github_oauth_transactions").get().n, 0);
  assert.match(errorOf(await app.finish(start)), /timed out/); assert.equal(requests.length, 3);
});
test("expired, wrong-state, wrong-origin, duplicate and cross-provider cookies fail before provider access", async t => {
  t.mock.method(globalThis, "fetch", () => { throw Error("must not call GitHub"); });
  for (const scenario of ["expired", "state", "origin", "duplicate", "google", "session"]) {
    const app = setup(), start = await app.begin();
    if (scenario === "expired") app.env.DB.raw.exec("UPDATE github_oauth_transactions SET expires_at='2000-01-01T00:00:00Z'");
    if (scenario === "origin") app.env.DB.raw.exec("UPDATE github_oauth_transactions SET origin='https://other.test'");
    if (scenario === "state") start.state = "invalid-state";
    if (scenario === "duplicate") start.cookie += "; " + start.cookie;
    if (scenario === "google") start.cookie = start.cookie.replace("duckplan_github_oauth", "duckplan_oauth");
    if (scenario === "session") start.cookie += "; duckplan_session=changed";
    const result = await app.finish(start); assert.match(errorOf(result), /timed out/, scenario);
    assert(!sessionCookie(result)); assert.match(result.headers.get("Set-Cookie"), /Max-Age=0/);
  }
});
test("denial consumes the transaction and clears its cookie without changing accounts", async () => {
  const app = setup(), start = await app.begin();
  const response = await app.call(`/api/auth/github/callback?state=${start.state}&error=access_denied`, { cookie: start.cookie });
  assert.match(errorOf(response), /cancelled/); assert.equal(app.env.DB.raw.prepare("SELECT count(*) AS n FROM users").get().n, 0);
  assert.match(errorOf(await app.finish(start)), /timed out/);
});
test("unverified email and upstream failures never issue a session or reflect provider details", async t => {
  const app = setup(); provider(t, { verified: false });
  const response = await app.finish(await app.begin()); assert.match(errorOf(response), /Verify an email/); assert(!sessionCookie(response));
  t.mock.restoreAll(); provider(t, { failAt: "access_token" });
  const failed = await app.finish(await app.begin()); assert.match(errorOf(failed), /couldn't finish/); assert(!errorOf(failed).includes("fixture")); assert(!sessionCookie(failed));
});
test("email equality cannot merge GitHub with password or Google accounts, in either direction", async t => {
  for (const existingProvider of ["password", "google"]) {
    const app = setup();
    if (existingProvider === "password") await app.password("github-user@example.test");
    else await findOrCreateGoogleUser(app.env, { email: "github-user@example.test", googleSub: "existing-google", name: "Original" });
    provider(t); const response = await app.finish(await app.begin()); assert.match(errorOf(response), /existing method/); assert(!sessionCookie(response));
    assert.equal(app.env.DB.raw.prepare("SELECT github_sub FROM users").get().github_sub, null); t.mock.restoreAll();
  }
  const app = setup(); provider(t); await app.finish(await app.begin());
  await assert.rejects(findOrCreateGoogleUser(app.env, { email: "github-user@example.test", googleSub: "another-google" }), /existing method/);
});
test("explicit linking preserves existing ID/data, rotates the session and supports later GitHub sign-in", async t => {
  const app = setup(), original = await app.password("original@example.test");
  const task = await app.call("/api/items/00000000-0000-4000-8000-000000000999", { method: "PUT", cookie: original.cookie, body: { title: "Preserved planner task" } });
  assert.equal(task.status, 200); provider(t, { email: "different-verified@example.test" });
  const start = await app.begin({ method: "POST", cookie: original.cookie, body: { next: "/#settings" } });
  const response = await app.finish(start, { cookie: start.cookie + "; " + original.cookie }); assert.equal(errorOf(response), null);
  const session = await (await app.call("/api/session", { cookie: sessionCookie(response) })).json();
  assert.equal(session.user.id, original.user.id); assert.equal(session.user.email, "original@example.test"); assert.equal(session.user.hasGitHub, true);
  assert.equal((await (await app.call("/api/session", { cookie: original.cookie })).json()).user, null, "old session revoked");
  const later = await app.finish(await app.begin());
  const same = await (await app.call("/api/session", { cookie: sessionCookie(later) })).json(); assert.equal(same.user.id, original.user.id);
  assert.equal(app.env.DB.raw.prepare("SELECT title FROM items WHERE user_id=?").get(original.user.id).title, "Preserved planner task");
});
test("linking requires an authenticated same-origin POST and the same live session after return", async t => {
  const app = setup(), original = await app.password("original@example.test");
  assert.equal((await app.call("/api/auth/github", { method: "POST", body: {} })).status, 401);
  for (const origin of [null, "https://evil.test", "null"]) assert.equal((await app.call("/api/auth/github", { method: "POST", cookie: original.cookie, origin, body: {} })).status, 403);
  provider(t);
  for (const changed of [true, false]) {
    const start = await app.begin({ method: "POST", cookie: original.cookie, body: {} });
    if (!changed) app.env.DB.raw.prepare("DELETE FROM sessions WHERE user_id=?").run(original.user.id);
    const result = await app.finish(start, { cookie: start.cookie + "; " + (changed ? "duckplan_session=other" : original.cookie) });
    assert(errorOf(result)); assert(!sessionCookie(result)); assert.equal(app.env.DB.raw.prepare("SELECT github_sub FROM users").get().github_sub, null);
  }
});
test("a GitHub identity bound to one user cannot be linked to a second account", async t => {
  const app = setup(); provider(t); const first = await app.finish(await app.begin());
  const firstUser = (await (await app.call("/api/session", { cookie: sessionCookie(first) })).json()).user;
  const second = await app.password("second@example.test");
  const start = await app.begin({ method: "POST", cookie: second.cookie, body: {} });
  const result = await app.finish(start, { cookie: start.cookie + "; " + second.cookie });
  assert.match(errorOf(result), /another DuckPlan account/); assert(!sessionCookie(result));
  assert.equal(app.env.DB.raw.prepare("SELECT id FROM users WHERE github_sub='123456'").get().id, firstUser.id);
});
test("revoking the original session during GitHub's response prevents linking", async t => {
  const app = setup(), original = await app.password("mid-flight@example.test");
  const start = await app.begin({ method: "POST", cookie: original.cookie, body: {} });
  provider(t);
  const providerFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const response = await providerFetch(url, init);
    if (url === "https://api.github.com/user") app.env.DB.raw.prepare("DELETE FROM sessions WHERE user_id=?").run(original.user.id);
    return response;
  });
  const result = await app.finish(start, { cookie: start.cookie + "; " + original.cookie });
  assert.match(errorOf(result), /account changed/); assert(!sessionCookie(result));
  assert.equal(app.env.DB.raw.prepare("SELECT github_sub FROM users WHERE id=?").get(original.user.id).github_sub, null);
});
test("GitHub accounts retain stable ownership when profile email changes; logout revokes the session", async t => {
  const app = setup(); provider(t); const first = await app.finish(await app.begin());
  const cookie = sessionCookie(first), user = (await (await app.call("/api/session", { cookie })).json()).user;
  t.mock.restoreAll(); provider(t, { email: "new@example.test" }); const second = await app.finish(await app.begin());
  assert.equal((await (await app.call("/api/session", { cookie: sessionCookie(second) })).json()).user.id, user.id);
  const logout = await app.call("/api/auth/sign-out", { method: "POST", cookie }); assert.equal(logout.status, 200);
  assert.equal((await (await app.call("/api/session", { cookie })).json()).user, null);
});
test("GitHub-authenticated users cannot read or modify another planner", async t => {
  const app = setup(); provider(t); const response = await app.finish(await app.begin()), github = sessionCookie(response);
  const other = await app.password("other-owner@example.test"), id = "00000000-0000-4000-8000-000000000555";
  assert.equal((await app.call(`/api/items/${id}`, { method: "PUT", cookie: other.cookie, body: { title: "Other owner's task" } })).status, 200);
  const listed = await (await app.call("/api/items", { cookie: github })).json(); assert(!JSON.stringify(listed).includes("Other owner's task"));
  assert.equal((await app.call(`/api/items/${id}`, { method: "PUT", cookie: github, body: { title: "forged", user_id: other.user.id } })).status, 404);
  assert.equal((await app.call(`/api/items/${id}`, { method: "PATCH", cookie: github, body: { completed: true } })).status, 404);
  await app.call(`/api/items/${id}`, { method: "DELETE", cookie: github });
  assert.equal(app.env.DB.raw.prepare("SELECT deleted_at FROM items WHERE id=?").get(id).deleted_at, null);
});
test("migration 0010 preserves populated legacy accounts, sessions and tasks without Google draft 0009", () => {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON");
  const directory = new URL("../cloudflare/migrations/", import.meta.url);
  for (const name of fs.readdirSync(directory).filter(n => /^000[1-8]_/.test(n)).sort()) db.exec(fs.readFileSync(new URL(name, directory), "utf8"));
  db.exec("INSERT INTO users (id,email,google_sub,display_name) VALUES ('legacy','legacy@example.test','google-legacy','Original'); INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ('digest','legacy','2099-01-01T00:00:00Z'); INSERT INTO items(id,user_id,title) VALUES ('saved','legacy','Saved planner');");
  db.exec(fs.readFileSync(new URL("0010_github_sign_in.sql", directory), "utf8"));
  assert.equal(db.prepare("SELECT google_sub FROM users WHERE id='legacy'").get().google_sub, "google-legacy");
  assert.equal(db.prepare("SELECT user_id FROM sessions WHERE token_hash='digest'").get().user_id, "legacy");
  assert.equal(db.prepare("SELECT title FROM items WHERE id='saved'").get().title, "Saved planner");
  db.close();
});
