import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../cloudflare/src/index.js";
import { nativePushAuthorization, nativeSyncStatus, dispatchNativeSync, NATIVE_SYNC_INTERVAL } from "../cloudflare/src/native-sync.js";
import { createFakeEnv, createCtx, ORIGIN } from "./support/fake-cloudflare.mjs";

const uuid = n => `80000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const deviceToken = n => n.toString(16).padStart(64, "0");
const devicePath = n => `/api/native-sync/devices/${uuid(n)}`;
const keyPair = crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
async function configuration() {
  const pair = await keyPair;
  const bytes = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const key = `-----BEGIN PRIVATE KEY-----\n${bytes.toString("base64")}\n-----END PRIVATE KEY-----`;
  return { APNS_TEAM_ID: "FIXTURE001", APNS_KEY_ID: "FIXTURE002", APNS_PRIVATE_KEY: key,
    APNS_SANDBOX_KEY_ID: "FIXTURE003", APNS_SANDBOX_PRIVATE_KEY: key, APNS_TOPIC: "com.duckplan.fixture" };
}
function app(overrides = {}) {
  const fixture = createFakeEnv(overrides), ctx = createCtx();
  async function call(path, { method = "GET", cookie, body, origin = ORIGIN } = {}) {
    const headers = { Origin: origin };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await handleRequest(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), fixture.env, ctx);
    await ctx.settle();
    return { status: response.status, data: response.status === 204 ? null : await response.clone().json(), headers: response.headers };
  }
  async function account(label) {
    const r = await call("/api/auth/sign-up", { method: "POST", body: { email: `${label}@example.test`, password: "synthetic account password" } });
    assert.equal(r.status, 201); return { cookie: r.headers.get("set-cookie").split(";")[0], id: r.data.user.id };
  }
  const register = (owner, n, environment = "sandbox") => call(devicePath(n), { method: "PUT", cookie: owner.cookie, body: { token: deviceToken(n), environment } });
  const row = user => fixture.env.DB.raw.prepare("SELECT * FROM native_sync_outbox WHERE user_id = ?").get(user.id);
  const mutate = (owner, id = 30) => call(`/api/items/${uuid(id)}`, { method: "PUT", cookie: owner.cookie, body: { title: `Task ${id}`, scheduled_start: "2028-11-20T14:00" } });
  return { ...fixture, ctx, call, account, register, row, mutate };
}

test("native registration is authenticated, owner scoped, strict and never returns a push token", async () => {
  const a = app(), first = await a.account("native-a"), second = await a.account("native-b");
  assert.equal((await a.call("/api/native-sync/status")).status, 401);
  const status = await a.call("/api/native-sync/status", { cookie: first.cookie });
  assert.equal(status.data.enabled, false); assert.equal(status.data.generation, 0);
  assert.match(status.data.reason, /activation/);
  const saved = await a.register(first, 1);
  assert.deepEqual(saved.data, { registered: true, enabled: false, reason: "Background sync is awaiting server activation for this app build." });
  for (const body of [{ token: "invalid", environment: "sandbox" }, { token: deviceToken(1), environment: "https://evil.test" },
    { token: deviceToken(1), environment: "sandbox", topic: "evil" }]) {
    assert.equal((await a.call(devicePath(1), { method: "PUT", cookie: first.cookie, body })).status, 400);
  }
  assert.equal((await a.call(devicePath(1), { method: "PUT", cookie: first.cookie, body: { token: deviceToken(1), environment: "sandbox" }, origin: "https://elsewhere.test" })).status, 403);
  await a.call(devicePath(1), { method: "DELETE", cookie: second.cookie });
  assert.equal(a.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM native_push_devices").get().n, 1);
  const unregistered = await a.call(devicePath(1) + "/ack", { method: "POST", cookie: second.cookie, body: { generation: 1 } });
  assert.equal(unregistered.status, 200);
  assert.deepEqual(unregistered.data, { acknowledged: false });
  assert.equal(a.env.DB.raw.prepare("SELECT last_ack_generation FROM native_push_devices WHERE user_id = ?").get(first.id).last_ack_generation, 0);
  assert.equal(a.row(second), undefined, "An unregistered acknowledgement must not create or consume an account queue");
  assert.equal((await a.call(devicePath(1) + "/ack", { method: "POST", cookie: first.cookie, body: { generation: 10000 } })).status, 409);
  await a.call(devicePath(1), { method: "DELETE", cookie: first.cookie });
  assert.equal(a.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM native_push_devices").get().n, 0);
});

test("APNs authorization is verifiable ES256 and refreshes within Apple's token window", async () => {
  const env = await configuration(), now = Date.now();
  const token = await nativePushAuthorization(env, "production", now);
  const [header, claims, signature] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { alg: "ES256", kid: env.APNS_KEY_ID });
  assert.deepEqual(JSON.parse(Buffer.from(claims, "base64url")), { iss: env.APNS_TEAM_ID, iat: Math.floor(now / 1000) });
  assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, (await keyPair).publicKey,
    Buffer.from(signature, "base64url"), new TextEncoder().encode(`${header}.${claims}`)), true);
  assert.equal(await nativePushAuthorization(env, "production", now + 60000), token);
  assert.notEqual(await nativePushAuthorization(env, "production", now + 46 * 60000), token);
  assert.equal(JSON.parse(Buffer.from((await nativePushAuthorization(env, "sandbox", now)).split(".")[0], "base64url")).kid, env.APNS_SANDBOX_KEY_ID);
  assert.deepEqual(nativeSyncStatus(env).environments, ["sandbox", "production"]);
  assert.equal(nativeSyncStatus({ ...env, APNS_TOPIC: "bad\nheader" }).enabled, false);
});

test("account writes durably queue exactly one revision change under either SQLite recursion mode", async () => {
  for (const recursive of [false, true]) {
    const a = app(), user = await a.account(`triggers-${recursive}`);
    a.env.DB.raw.exec(`PRAGMA recursive_triggers = ${recursive ? "ON" : "OFF"}`);
    await a.mutate(user); const before = a.row(user).generation;
    const result = await a.mutate(user);
    assert.equal(result.data.item.sync_revision, 1);
    assert.equal(a.row(user).generation, before + 1);
    a.env.DB.raw.prepare("UPDATE items SET title = 'Axis-style update' WHERE id = ?").run(uuid(30));
    assert.equal(a.row(user).generation, before + 2);
    a.env.DB.raw.prepare("DELETE FROM items WHERE id = ?").run(uuid(30));
    assert.equal(a.row(user).generation, before + 3);
    a.env.DB.raw.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    assert.equal(a.row(user), undefined, "User deletion must cascade rather than create orphan hints");
  }
});

test("one account fans out payload-free hints to both devices and retries until both acknowledge", async () => {
  const a = app(await configuration()), user = await a.account("fanout"), other = await a.account("isolation");
  await a.register(user, 1, "sandbox"); await a.register(user, 2, "production"); await a.register(other, 3);
  await a.mutate(user);
  const sent = [], now = Date.now() + 100;
  const transport = async (url, init) => { sent.push({ url, init }); return new Response(null, { status: 200 }); };
  // Suppress the unrelated user's independently registered test device for this case.
  a.env.DB.raw.prepare("UPDATE native_sync_outbox SET next_attempt_at = ? WHERE user_id = ?").run(Number.MAX_SAFE_INTEGER, other.id);
  const result = await dispatchNativeSync(a.env, { now, fetchImpl: transport });
  assert.equal(result.accepted, 2);
  assert.equal(sent.length, 2);
  assert.ok(sent.some(x => x.url.startsWith("https://api.sandbox.push.apple.com/")));
  assert.ok(sent.some(x => x.url.startsWith("https://api.push.apple.com/")));
  for (const { init } of sent) {
    assert.deepEqual(JSON.parse(init.body), { aps: { "content-available": 1 }, duckplan_sync: 1 });
    assert.equal(init.headers["apns-push-type"], "background"); assert.equal(init.headers["apns-priority"], "5");
    assert.equal(init.headers["apns-topic"], "com.duckplan.fixture"); assert.equal(init.redirect, "error");
    assert.ok(!init.body.includes("Task") && !init.body.includes(user.id));
  }
  const gen = a.row(user).generation;
  assert.notEqual(a.row(user).next_attempt_at, Number.MAX_SAFE_INTEGER, "APNs acceptance is not device acknowledgment");
  assert.equal((await dispatchNativeSync(a.env, { now: now + 60000, fetchImpl: transport })).accepted, 0);
  await a.call(devicePath(1) + "/ack", { method: "POST", cookie: user.cookie, body: { generation: gen } });
  const retry = await dispatchNativeSync(a.env, { now: now + NATIVE_SYNC_INTERVAL + 1, fetchImpl: transport });
  assert.equal(retry.accepted, 1, "Only the unacknowledged peer receives a retry");
  await a.call(devicePath(2) + "/ack", { method: "POST", cookie: user.cookie, body: { generation: gen } });
  await dispatchNativeSync(a.env, { now: now + NATIVE_SYNC_INTERVAL + 2, fetchImpl: transport });
  assert.equal(a.row(user).next_attempt_at, Number.MAX_SAFE_INTEGER);
});

test("an old acknowledgment cannot consume a newer generation, and dispatch leases prevent duplicate workers", async () => {
  const a = app(await configuration()), user = await a.account("lease"); await a.register(user, 1); await a.mutate(user);
  const now = Date.now() + 100, gen = a.row(user).generation;
  let release, started;
  const wait = new Promise(resolve => { release = resolve; }), entry = new Promise(resolve => { started = resolve; });
  const running = dispatchNativeSync(a.env, { now, fetchImpl: async () => { started(); await wait; return new Response(null, { status: 200 }); } });
  await entry;
  const peer = await dispatchNativeSync(a.env, { now, fetchImpl: () => { throw new Error("Duplicate send"); } });
  assert.equal(peer.accepted, 0);
  await a.mutate(user, 31); release(); await running;
  assert.equal(a.row(user).generation, gen + 1);
  await a.call(devicePath(1) + "/ack", { method: "POST", cookie: user.cookie, body: { generation: gen } });
  assert.equal(a.row(user).next_attempt_at, 0);
  const next = await dispatchNativeSync(a.env, { now: now + NATIVE_SYNC_INTERVAL + 1, fetchImpl: async () => new Response(null, { status: 200 }) });
  assert.equal(next.accepted, 1, "The newer mutation stays eligible after old-hint acceptance and acknowledgment");
});

test("token ownership changes reset acknowledgments and late invalid-token results cannot remove a replacement", async () => {
  const a = app(await configuration()), first = await a.account("binding-a"), second = await a.account("binding-b");
  await a.register(first, 1);
  const gen = a.row(first).generation;
  await a.call(devicePath(1) + "/ack", { method: "POST", cookie: first.cookie, body: { generation: gen } });
  await a.register(second, 1);
  let device = a.env.DB.raw.prepare("SELECT * FROM native_push_devices WHERE token = ?").get(deviceToken(1));
  assert.equal(device.user_id, second.id); assert.equal(device.last_ack_generation, 0);
  const now = Date.now() + 100;
  await dispatchNativeSync(a.env, { now, fetchImpl: async () => {
    await a.call(devicePath(1), { method: "PUT", cookie: second.cookie, body: { token: deviceToken(99), environment: "sandbox" } });
    return new Response(JSON.stringify({ reason: "Unregistered" }), { status: 410 });
  } });
  device = a.env.DB.raw.prepare("SELECT * FROM native_push_devices WHERE user_id = ?").get(second.id);
  assert.equal(device.token, deviceToken(99), "The stale response only targets the token actually sent");
});

test("transient APNs failures retain work without logging or storing raw exception content", async () => {
  const a = app(await configuration()), user = await a.account("retry"); await a.register(user, 1);
  const result = await dispatchNativeSync(a.env, { now: Date.now() + 100, fetchImpl: async () => { throw new Error("secret network URL and bearer contents"); } });
  assert.equal(result.rejected, 1);
  assert.equal(a.env.DB.raw.prepare("SELECT last_error FROM native_push_devices WHERE user_id = ?").get(user.id).last_error, "TransportError");
  assert.ok(a.row(user).attempts > 0);
});

test("concurrent device admission is atomic at the cap and replacement preserves an already over-cap registration", async () => {
  const a = app(), user = await a.account("atomic-device-cap");
  const seed = n => a.env.DB.raw.prepare("INSERT INTO native_push_devices(user_id, installation_id, token, environment, created_at, updated_at) VALUES (?, ?, ?, 'sandbox', 1, 1)")
    .run(user.id, uuid(n), deviceToken(n));
  for (let n = 1; n <= 63; n += 1) seed(n);
  const count = () => a.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM native_push_devices WHERE user_id = ?").get(user.id).n;
  const device = n => a.env.DB.raw.prepare("SELECT * FROM native_push_devices WHERE user_id = ? AND installation_id = ?").get(user.id, uuid(n));

  // Let both preflight reads observe 63, as two overlapping D1 requests can.
  // The write transaction, rather than promise scheduling, must enforce 64.
  const prepare = a.env.DB.prepare.bind(a.env.DB);
  let reads = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  a.env.DB.prepare = sql => {
    const statement = prepare(sql);
    if (sql !== "SELECT COUNT(*) AS count FROM native_push_devices WHERE user_id = ?") return statement;
    return { bind(...args) {
      const bound = statement.bind(...args);
      return { async first() {
        const result = await bound.first();
        reads += 1; if (reads === 2) release();
        await barrier;
        return result;
      } };
    } };
  };
  let admissions;
  try { admissions = await Promise.all([a.register(user, 64), a.register(user, 65)]); }
  finally { a.env.DB.prepare = prepare; }
  assert.equal(reads, 2);
  assert.deepEqual(admissions.map(result => result.status).sort(), [200, 409]);
  assert.equal(count(), 64);

  const rotated = await a.call(devicePath(1), { method: "PUT", cookie: user.cookie, body: { token: deviceToken(99), environment: "sandbox" } });
  assert.equal(rotated.status, 200, "An existing installation can rotate its token at capacity");
  assert.equal(count(), 64); assert.equal(device(1).token, deviceToken(99));
  assert.equal(a.env.DB.raw.prepare("SELECT token FROM native_push_devices WHERE token = ?").get(deviceToken(1)), undefined);

  // Preserve data from an older release that might already have exceeded its
  // cap: rejecting a replacement must not first delete its working old token.
  seed(66); assert.equal(count(), 65);
  const before = { ...device(1) }, generation = a.row(user).generation;
  const rejected = await a.call(devicePath(1), { method: "PUT", cookie: user.cookie, body: { token: deviceToken(100), environment: "sandbox" } });
  assert.equal(rejected.status, 409); assert.equal(count(), 65);
  assert.deepEqual({ ...device(1) }, before);
  assert.equal(a.row(user).generation, generation, "Rejected admission must not queue a sync generation");
});
