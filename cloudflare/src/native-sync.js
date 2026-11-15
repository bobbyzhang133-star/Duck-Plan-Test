import { HttpError, json, readJson } from "./http.js";

// Apple treats background updates as best effort and recommends at most 2–3/hour.
// One accepted hint downloads the newest snapshot, including coalesced changes.
export const NATIVE_SYNC_INTERVAL = 20 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^(?:[0-9a-f]{2}){16,256}$/i;
const identifier = /^[A-Z0-9]{10}$/;
const tokens = new Map();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const segment = value => b64(new TextEncoder().encode(JSON.stringify(value)));

function configuration(env, environment) {
  const prefix = environment === "sandbox" ? "APNS_SANDBOX_" : "APNS_";
  const keyId = env[`${prefix}KEY_ID`], privateKey = env[`${prefix}PRIVATE_KEY`];
  const teamId = env.APNS_TEAM_ID, topic = env.APNS_TOPIC;
  if (!identifier.test(keyId || "") || !identifier.test(teamId || "") ||
      !/^[A-Za-z0-9][A-Za-z0-9.-]{2,179}$/.test(topic || "") ||
      typeof privateKey !== "string" || !privateKey.includes("-----BEGIN PRIVATE KEY-----")) return null;
  return { keyId, privateKey, teamId, topic };
}
export function nativeSyncStatus(env) {
  const environments = ["sandbox", "production"].filter(name => configuration(env, name));
  return { enabled: environments.length > 0, environments, minimumIntervalSeconds: NATIVE_SYNC_INTERVAL / 1000,
    ...(environments.length ? {} : { reason: "Background sync is awaiting server activation. Open DuckPlan to refresh account settings." }) };
}

export async function nativePushAuthorization(env, environment, now = Date.now()) {
  const config = configuration(env, environment);
  if (!config) throw new Error("Native background sync is not configured.");
  const identity = b64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(config)))));
  const seconds = Math.floor(now / 1000), previous = tokens.get(identity);
  if (previous && seconds >= previous.issuedAt && seconds - previous.issuedAt < 45 * 60) return previous.token;
  const body = config.privateKey.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  let bytes;
  try { bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0)); } catch { throw new Error("Native push signing key is invalid."); }
  const key = await crypto.subtle.importKey("pkcs8", bytes, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const input = `${segment({ alg: "ES256", kid: config.keyId })}.${segment({ iss: config.teamId, iat: seconds })}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input)));
  const token = `${input}.${b64(signature)}`;
  if (tokens.size >= 8) tokens.delete(tokens.keys().next().value);
  tokens.set(identity, { token, issuedAt: seconds });
  return token;
}

export async function queueNativeSync(env, userId, now = Date.now()) {
  await env.DB.prepare(`INSERT INTO native_sync_outbox(user_id, changed_at) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET generation = generation + 1, changed_at = excluded.changed_at,
      next_attempt_at = 0, attempts = 0`).bind(userId, now).run();
}

export async function handleNativeSync(request, env, path, user) {
  if (!path.startsWith("/api/native-sync/")) return null;
  if (path === "/api/native-sync/status" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT generation FROM native_sync_outbox WHERE user_id = ?").bind(user.id).first();
    return json({ ...nativeSyncStatus(env), generation: row?.generation || 0 });
  }
  const match = path.match(/^\/api\/native-sync\/devices\/([^/]+)(\/ack)?$/);
  if (!match || !(match[2] ? request.method === "POST" : ["PUT", "DELETE"].includes(request.method))) throw new HttpError(404, "Not found.");
  if (!UUID.test(match[1])) throw new HttpError(400, "That device identifier isn't valid.");
  const id = match[1].toLowerCase();
  if (match[2]) {
    const body = await readJson(request, 512);
    if (!body || Object.keys(body).length !== 1 || !Number.isSafeInteger(body.generation) || body.generation < 0) throw new HttpError(400, "That sync acknowledgment isn't valid.");
    const device = await env.DB.prepare("SELECT installation_id FROM native_push_devices WHERE user_id = ? AND installation_id = ?").bind(user.id, id).first();
    // Foreground-only Personal Team builds also consume planner snapshots. An
    // absent push registration has nothing to acknowledge or remove from a queue.
    if (!device) return json({ acknowledged: false });
    const row = await env.DB.prepare("SELECT generation FROM native_sync_outbox WHERE user_id = ?").bind(user.id).first();
    if (body.generation > (row?.generation || 0)) throw new HttpError(409, "Refresh the planner before acknowledging this version.");
    await env.DB.prepare("UPDATE native_push_devices SET last_ack_generation = MAX(last_ack_generation, ?) WHERE user_id = ? AND installation_id = ?")
      .bind(body.generation, user.id, id).run();
    await env.DB.prepare("UPDATE native_sync_outbox SET next_attempt_at = 0 WHERE user_id = ?").bind(user.id).run();
    return json({ acknowledged: true });
  }
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM native_push_devices WHERE user_id = ? AND installation_id = ?").bind(user.id, id).run();
    return new Response(null, { status: 204 });
  }
  const body = await readJson(request, 2048);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["token", "environment"].includes(key)) ||
      typeof body.token !== "string" || !TOKEN.test(body.token) || !["sandbox", "production"].includes(body.environment)) {
    throw new HttpError(400, "That native device registration isn't valid.");
  }
  const existing = await env.DB.prepare("SELECT last_push_at, last_ack_generation FROM native_push_devices WHERE user_id = ? AND installation_id = ?").bind(user.id, id).first();
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM native_push_devices WHERE user_id = ?").bind(user.id).first();
  if (!existing && count.count >= 64) throw new HttpError(409, "This account has too many registered devices. Sign out on an old device first.");
  const now = Date.now();
  // APNs tokens are private unguessable device capabilities. Re-registering the
  // same token after an account change rebinds its hint to the current account.
  const results = await env.DB.batch([
    // Recheck admission inside the transaction: parallel registrations may both
    // pass the friendly preflight count. Preserve any pre-existing over-cap row.
    env.DB.prepare("DELETE FROM native_push_devices WHERE user_id = ? AND installation_id = ? AND (SELECT COUNT(*) FROM native_push_devices WHERE user_id = ?) <= 64").bind(user.id, id, user.id),
    env.DB.prepare(`INSERT INTO native_push_devices(user_id, installation_id, token, environment, created_at, updated_at, last_push_at, last_ack_generation)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
      WHERE (SELECT COUNT(*) FROM native_push_devices WHERE user_id = ?1) < 64
      ON CONFLICT(environment, token) DO UPDATE SET
      last_ack_generation = CASE WHEN native_push_devices.user_id = excluded.user_id THEN native_push_devices.last_ack_generation ELSE 0 END,
      user_id = excluded.user_id, installation_id = excluded.installation_id, updated_at = excluded.updated_at, last_error = NULL`)
      .bind(user.id, id, body.token.toLowerCase(), body.environment, now, now, existing?.last_push_at ?? null, existing?.last_ack_generation ?? 0),
  ]);
  if (!results[1].meta.changes) throw new HttpError(409, "This account has too many registered devices. Sign out on an old device first.");
  await queueNativeSync(env, user.id, now);
  const enabled = Boolean(configuration(env, body.environment));
  return json({ registered: true, enabled, ...(enabled ? {} : { reason: "Background sync is awaiting server activation for this app build." }) });
}

export async function dispatchNativeSync(env, { now = Date.now(), fetchImpl = fetch } = {}) {
  const summary = { configured: nativeSyncStatus(env).enabled, accepted: 0, rejected: 0, removed: 0, deferred: 0 };
  if (!summary.configured) return summary;
  const start = Date.now(), limit = 25;
  let sent = 0;
  const { results: batches } = await env.DB.prepare("SELECT * FROM native_sync_outbox WHERE next_attempt_at <= ? AND lease_until <= ? ORDER BY changed_at LIMIT 25").bind(now, now).all();
  for (const batch of batches) {
    if (sent >= limit || Date.now() - start >= 25000) break;
    const lease = now + 60000;
    const claimed = await env.DB.prepare("UPDATE native_sync_outbox SET lease_until = ? WHERE user_id = ? AND generation = ? AND lease_until <= ?")
      .bind(lease, batch.user_id, batch.generation, now).run();
    if (!claimed.meta.changes) continue;
    let pending = false, retryAt = now + NATIVE_SYNC_INTERVAL;
    try {
      const { results: devices } = await env.DB.prepare("SELECT * FROM native_push_devices WHERE user_id = ? ORDER BY COALESCE(last_push_at, 0) LIMIT 64").bind(batch.user_id).all();
      for (const device of devices) {
        if (device.last_ack_generation >= batch.generation) continue;
        if (sent >= limit || Date.now() - start >= 25000) { pending = true; retryAt = Math.min(retryAt, now + 60000); break; }
        const config = configuration(env, device.environment);
        const eligibleAt = (device.last_push_at ?? (now - NATIVE_SYNC_INTERVAL)) + NATIVE_SYNC_INTERVAL;
        if (!config || eligibleAt > now) {
          pending = true; summary.deferred += 1;
          retryAt = Math.min(retryAt, config ? eligibleAt : now + 5 * 60000);
          continue;
        }
        sent += 1;
        let accepted = false, removed = false, code = "TransportError";
        try {
          const authorization = await nativePushAuthorization(env, device.environment, now);
          const host = device.environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
          const response = await fetchImpl(`https://${host}/3/device/${device.token}`, {
            method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
            headers: { authorization: `bearer ${authorization}`, "apns-topic": config.topic,
              "apns-push-type": "background", "apns-priority": "5", "apns-collapse-id": "duckplan-account-sync",
              "apns-expiration": String(Math.floor((now + 3600000) / 1000)), "content-type": "application/json" },
            body: JSON.stringify({ aps: { "content-available": 1 }, duckplan_sync: 1 }),
          });
          accepted = response.status === 200;
          if (!accepted) {
            const detail = await response.json().catch(() => ({}));
            code = typeof detail.reason === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(detail.reason) ? detail.reason : `HTTP${response.status}`;
            removed = response.status === 410 || (response.status === 400 && code === "BadDeviceToken");
          }
        } catch { /* No exception URL, bearer token or signing material is logged. */ }
        if (accepted) {
          summary.accepted += 1;
          // Acceptance is not delivery. Retry unacknowledged snapshots within
          // Apple's background budget until the native client consumes one.
          pending = true;
          await env.DB.prepare("UPDATE native_push_devices SET last_push_at = ?, last_error = NULL WHERE user_id = ? AND installation_id = ? AND token = ? AND environment = ?")
            .bind(now, device.user_id, device.installation_id, device.token, device.environment).run();
        } else if (removed) {
          summary.removed += 1;
          await env.DB.prepare("DELETE FROM native_push_devices WHERE user_id = ? AND installation_id = ? AND token = ? AND environment = ?")
            .bind(device.user_id, device.installation_id, device.token, device.environment).run();
        } else {
          summary.rejected += 1; pending = true;
          retryAt = Math.min(retryAt, now + Math.min(NATIVE_SYNC_INTERVAL, 60000 * 2 ** Math.min(batch.attempts, 4)));
          await env.DB.prepare("UPDATE native_push_devices SET last_error = ? WHERE user_id = ? AND installation_id = ? AND token = ? AND environment = ?")
            .bind(code, device.user_id, device.installation_id, device.token, device.environment).run();
        }
      }
      if (pending) {
        await env.DB.prepare("UPDATE native_sync_outbox SET next_attempt_at = ?, attempts = attempts + 1 WHERE user_id = ? AND generation = ? AND lease_until = ?")
          .bind(retryAt, batch.user_id, batch.generation, lease).run();
      } else {
        // Keep the generation monotonic, including when no devices are left.
        await env.DB.prepare("UPDATE native_sync_outbox SET next_attempt_at = ?, attempts = 0 WHERE user_id = ? AND generation = ? AND lease_until = ?")
          .bind(Number.MAX_SAFE_INTEGER, batch.user_id, batch.generation, lease).run();
      }
    } finally {
      await env.DB.prepare("UPDATE native_sync_outbox SET lease_until = 0 WHERE user_id = ? AND lease_until = ?").bind(batch.user_id, lease).run();
    }
  }
  return summary;
}
