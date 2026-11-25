// Axis sync: imports a student's Axis (Blackbaud Podium) iCal feed into classes and items.
// Replaces the Supabase axis-sync Edge Function and its pg_cron job.
//
//   GET    /api/axis                       connection status (never the link itself)
//   POST   /api/axis { mode: "connect", icalUrl }   save the feed link, then sync
//   POST   /api/axis { mode: "sync" }               "Sync now" (rate limited)
//   DELETE /api/axis                       forget the feed link; imported items stay
//   Cron Trigger                           re-syncs connections older than AXIS_SYNC_INTERVAL_HOURS
//
// The feed link works like a password: it is only stored in axis_connections and is never echoed
// back in responses, errors, or logs.
import Ical from "../../landing/ical-parser.js";
import { HttpError, json, nowIso, readJson } from "./http.js";
import { jsonInsert } from "./planner.js";
import { broadcast } from "./live.js";
import { overdueImportIds } from "./axis-completion.js";
import { resolveAxisIdentities } from "./axis-identity.js";

const MAX_FEED_BYTES = 5_000_000;
const MIN_SYNC_INTERVAL_MS = 60_000;

async function fetchFeed(icalUrl, fetchImpl = fetch) {
  const url = Ical.normalizeFeedUrl(icalUrl);
  let response;
  try {
    // No redirects: a redirect could point outside myschoolapp.com and get around the host check.
    response = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { Accept: "text/calendar" } });
  } catch {
    throw new HttpError(502, "Couldn't reach Axis. Try again in a few minutes.");
  }
  if (!response.ok) throw new HttpError(502, `Axis answered with status ${response.status}. Check that the feed link is still valid.`);
  if (Number(response.headers.get("Content-Length") || 0) > MAX_FEED_BYTES) throw new HttpError(502, "The Axis feed is unexpectedly large.");
  const text = await response.text();
  if (text.length > MAX_FEED_BYTES) throw new HttpError(502, "The Axis feed is unexpectedly large.");
  if (!text.includes("BEGIN:VCALENDAR")) throw new HttpError(502, "That link didn't return an Axis calendar feed.");
  return text;
}

// Axis only rewrites the fields it owns (title, due date, class, notes) and never touches
// completed or deleted items; planAxisSync in landing/ical-parser.js decides what changes.
const ITEM_UPDATES = `
UPDATE items SET title = j.title, due_date = j.due_date,
class_id = (SELECT id FROM classes WHERE user_id=?2 AND axis_key=j.class_key), notes = j.notes, axis_missing = 0, updated_at = ?3
FROM (
  SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.title') AS title, json_extract(value, '$.due_date') AS due_date,
         json_extract(value, '$.class_key') AS class_key, json_extract(value, '$.notes') AS notes
  FROM json_each(?1)
) AS j
WHERE items.id = j.id AND items.user_id = ?2 AND items.completed = 0 AND items.deleted_at IS NULL`;

export async function syncUser(env, userId, icalUrl, { fetchImpl, now = Date.now } = {}) {
  const db = env.DB;
  const runId = crypto.randomUUID();
  const startedAt = nowIso();
  await db.batch([
    db.prepare("INSERT INTO sync_runs (id, user_id, started_at) VALUES (?, ?, ?)").bind(runId, userId, startedAt),
    db.prepare("UPDATE axis_connections SET last_attempted_at = ?, updated_at = ? WHERE user_id = ?").bind(startedAt, startedAt, userId),
  ]);
  try {
    const feed = Ical.parseAxisFeed(await fetchFeed(icalUrl, fetchImpl));
    const [axisClasses, axisItems, classCount, account, identityKeys] = await db.batch([
      db.prepare("SELECT id, axis_key FROM classes WHERE user_id = ? AND axis_key IS NOT NULL").bind(userId),
      db.prepare("SELECT id, axis_uid, title, type, due_date, due_time, class_id, notes, completed, deleted_at, axis_missing, created_at FROM items WHERE user_id = ? AND axis_uid IS NOT NULL").bind(userId),
      db.prepare("SELECT count(*) AS n FROM classes WHERE user_id = ?").bind(userId),
      db.prepare("SELECT time_zone FROM users WHERE id = ?").bind(userId),
      db.prepare("SELECT identity_key, item_id FROM axis_assignment_keys WHERE user_id = ?").bind(userId),
    ]);
    const existingClasses = axisClasses.results;
    const identities = await resolveAxisIdentities({ feed, existingItems: axisItems.results, existingClasses, existingKeys: identityKeys.results });
    const plan = Ical.planAxisSync({
      feed: identities.feed,
      // Every existing class counts toward the color index, so new Axis classes don't repeat manual colors.
      existingClasses: [...existingClasses, ...Array(Math.max(0, classCount.results[0].n - existingClasses.length)).fill({})],
      existingItems: axisItems.results.map((row) => ({ ...row, completed: Boolean(row.completed), axis_missing: Boolean(row.axis_missing) })),
      newId: () => crypto.randomUUID(),
    });

    const finishedAt = nowIso();
    const statements = [];
    const classKeys = new Map([...existingClasses, ...plan.classInserts].map(row => [row.id, row.axis_key]));
    let completionStatement = -1;
    let insertStatement = -1, classStatement = -1;
    if (plan.classInserts.length) {
      classStatement = statements.length;
      statements.push(jsonInsert(db, "classes", userId, plan.classInserts, "ON CONFLICT (user_id, axis_key) DO NOTHING RETURNING id"));
    }
    if (plan.itemInserts.length) {
      const rows = plan.itemInserts.map(row => ({ ...row, class_key: classKeys.get(row.class_id) ?? null, identity_key: identities.insertKeys.get(row.axis_uid) }));
      insertStatement = statements.length;
      // Check the snapshot inside the write transaction too: concurrent cron/connect
      // requests can see the same old snapshot while receiving different UIDs.
      // Resolve class IDs at write time for concurrent first imports of a new class.
      statements.push(db.prepare(`INSERT INTO items (id, user_id, class_id, title, type, notes, due_date, due_time, source, axis_uid, axis_missing, updated_at)
        SELECT json_extract(j.value,'$.id'), ?2,
          (SELECT id FROM classes WHERE user_id=?2 AND axis_key=json_extract(j.value,'$.class_key')),
          json_extract(j.value,'$.title'), json_extract(j.value,'$.type'), json_extract(j.value,'$.notes'),
          json_extract(j.value,'$.due_date'), json_extract(j.value,'$.due_time'), 'axis', json_extract(j.value,'$.axis_uid'), 0, ?3
        FROM json_each(?1) AS j
        WHERE NOT EXISTS (SELECT 1 FROM axis_assignment_keys WHERE user_id=?2 AND identity_key=json_extract(j.value,'$.identity_key'))
        ON CONFLICT (user_id, axis_uid) DO NOTHING RETURNING id`).bind(JSON.stringify(rows), userId, finishedAt));
      const overdueIds = axisItems.results.length ? [] : overdueImportIds(rows, {
        now: now(), timeZone: account.results[0]?.time_zone || "America/Los_Angeles",
      });
      if (overdueIds.length) {
        completionStatement = statements.length;
        // The successful-run check is inside the same transaction as insertion.
        // Concurrent connects cannot both consume the first-import behavior.
        // Fresh generated IDs exclude pre-existing/conflicting/reopened tasks.
        statements.push(db.prepare(`UPDATE items SET completed = 1, completed_at = ?3, updated_at = ?3
          WHERE user_id = ?1 AND id IN (SELECT value FROM json_each(?2))
            AND source = 'axis' AND completed = 0 AND deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM sync_runs WHERE user_id = ?1 AND status = 'ok')
          RETURNING id`)
          .bind(userId, JSON.stringify(overdueIds), finishedAt));
      }
    }
    if (identities.links.length) statements.push(db.prepare(`INSERT INTO axis_assignment_keys (user_id, identity_key, item_id)
      SELECT ?2, json_extract(j.value,'$.identity_key'),
        coalesce((SELECT item_id FROM axis_assignment_keys WHERE user_id=?2 AND identity_key=json_extract(j.value,'$.snapshot_key')),
                 (SELECT id FROM items WHERE user_id=?2 AND axis_uid=json_extract(j.value,'$.axis_uid')))
      FROM json_each(?1) AS j WHERE true
      ON CONFLICT (user_id, identity_key) DO NOTHING`).bind(JSON.stringify(identities.links), userId));
    if (plan.itemUpdates.length) statements.push(db.prepare(ITEM_UPDATES).bind(JSON.stringify(plan.itemUpdates.map(row => ({ ...row, class_key: classKeys.get(row.class_id) ?? null }))), userId, finishedAt));
    if (plan.itemsMissing.length) {
      statements.push(db.prepare("UPDATE items SET axis_missing = 1, updated_at = ?1 WHERE user_id = ?2 AND id IN (SELECT value FROM json_each(?3))").bind(finishedAt, userId, JSON.stringify(plan.itemsMissing)));
    }
    statements.push(
      db.prepare(`UPDATE sync_runs SET status = 'ok', finished_at = ?1,
        added = (SELECT count(*) FROM items WHERE user_id=?2 AND id IN (SELECT value FROM json_each(?3))),
        updated = ?4, removed = ?5 WHERE id = ?6`).bind(finishedAt, userId, JSON.stringify(plan.itemInserts.map(row => row.id)), plan.counts.updated, plan.counts.removed, runId),
      db.prepare("UPDATE axis_connections SET last_synced_at = ?, last_error = NULL, updated_at = ? WHERE user_id = ?").bind(finishedAt, finishedAt, userId),
    );
    // One transaction: a sync applies completely or not at all.
    const results = await db.batch(statements);
    const autoCompleted = completionStatement < 0 ? 0 : results[completionStatement].results.length;
    await broadcast(env, userId, { reload: true });
    const added = insertStatement < 0 ? 0 : results[insertStatement].results.length;
    const classesAdded = classStatement < 0 ? 0 : results[classStatement].results.length;
    return { ...plan.counts, added, autoCompleted, classesAdded, lastSyncedAt: finishedAt };
  } catch (error) {
    const message = error instanceof HttpError ? error.message : "Sync failed unexpectedly.";
    console.error("axis sync failed", userId, error instanceof HttpError ? error.message : error?.message || error);
    const failedAt = nowIso();
    await db.batch([
      db.prepare("UPDATE sync_runs SET status = 'error', finished_at = ?, error = ? WHERE id = ?").bind(failedAt, message, runId),
      db.prepare("UPDATE axis_connections SET last_error = ?, updated_at = ? WHERE user_id = ?").bind(message, failedAt, userId),
    ]);
    throw error instanceof HttpError ? error : new HttpError(500, message);
  }
}

export async function axisStatus(env, userId) {
  const row = await env.DB.prepare("SELECT last_synced_at, last_error FROM axis_connections WHERE user_id = ?").bind(userId).first();
  return row ? { connected: true, lastSyncedAt: row.last_synced_at, lastError: row.last_error } : { connected: false, lastSyncedAt: null, lastError: null };
}

export async function handleAxis(request, env, path, user, options = {}) {
  if (path !== "/api/axis") return null;
  const db = env.DB;
  if (request.method === "GET") return json(await axisStatus(env, user.id));
  if (request.method === "DELETE") {
    await db.prepare("DELETE FROM axis_connections WHERE user_id = ?").bind(user.id).run();
    return json({ ok: true });
  }
  if (request.method !== "POST") return null;

  const body = await readJson(request);
  if (body.mode === "connect") {
    let icalUrl;
    try { icalUrl = Ical.normalizeFeedUrl(body.icalUrl); } catch (error) { throw new HttpError(400, error.message); }
    Ical.parseAxisFeed(await fetchFeed(icalUrl, options.fetchImpl)); // prove the link works before saving it
    const now = nowIso();
    await db.prepare(`INSERT INTO axis_connections (user_id, ical_url, updated_at) VALUES (?1, ?2, ?3)
      ON CONFLICT (user_id) DO UPDATE SET ical_url = excluded.ical_url, last_error = NULL, updated_at = excluded.updated_at`).bind(user.id, icalUrl, now).run();
    return json(await syncUser(env, user.id, icalUrl, options));
  }
  if (body.mode === "sync") {
    const connection = await db.prepare("SELECT ical_url, last_attempted_at FROM axis_connections WHERE user_id = ?").bind(user.id).first();
    if (!connection) throw new HttpError(404, "Connect Axis first.");
    if (connection.last_attempted_at && Date.now() - Date.parse(connection.last_attempted_at) < MIN_SYNC_INTERVAL_MS) {
      throw new HttpError(429, "Axis just synced. Try again in a minute.");
    }
    return json(await syncUser(env, user.id, connection.ical_url, options));
  }
  throw new HttpError(400, "Unknown mode.");
}

// Cron Trigger: each run re-syncs the few connections that have waited longest, which keeps every
// run well inside the Workers free plan's per-invocation query and subrequest limits.
export async function syncDueConnections(env, options = {}) {
  const hours = Number(env.AXIS_SYNC_INTERVAL_HOURS || 4);
  const limit = Math.max(1, Math.min(20, Number(env.AXIS_SYNC_PER_RUN || 4)));
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { results } = await env.DB.prepare("SELECT user_id, ical_url FROM axis_connections WHERE coalesce(last_attempted_at, '') < ? ORDER BY coalesce(last_attempted_at, '') LIMIT ?")
    .bind(cutoff, limit).all();
  const summary = { ok: 0, failed: 0 };
  for (const connection of results) {
    try { await syncUser(env, connection.user_id, connection.ical_url, options); summary.ok += 1; } catch { summary.failed += 1; }
  }
  return summary;
}
