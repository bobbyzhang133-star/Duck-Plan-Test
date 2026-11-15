// Saved task templates, class links and task-organization preferences. Every read/write is
// scoped to the authenticated user; schema triggers also enforce ownership of linked classes.
import { HttpError, json, nowIso, readJson } from "./http.js";
import { broadcast } from "./live.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITIES = new Set(["low", "medium", "high"]);
const REMINDERS = new Set(["default", "off", "15", "60", "1440"]);
const MAX_IMPORT_ROWS = 2000;

function id(value, field) {
  if (!UUID.test(String(value || ""))) throw new HttpError(400, `That ${field} isn't valid.`);
  return String(value).toLowerCase();
}
function text(value, field, max, required = false) {
  if (value !== undefined && value !== null && typeof value !== "string") throw new HttpError(400, `${field} isn't valid.`);
  const clean = (value || "").trim();
  if (required && !clean) throw new HttpError(400, `${field} is required.`);
  if (clean.length > max) throw new HttpError(400, `${field} is too long.`);
  return clean;
}
function object(row, field) {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new HttpError(400, `Send ${field}.`);
}

export function cleanTemplate(row, rowId = row?.id) {
  object(row, "a task template");
  const duration = Number(row.duration_minutes ?? 45);
  const priority = String(row.priority ?? "medium").toLowerCase();
  const reminder = String(row.reminder_choice ?? "default");
  if (!Number.isInteger(duration) || duration < 5 || duration > 1440) throw new HttpError(400, "Duration must be between 5 minutes and 24 hours.");
  if (!PRIORITIES.has(priority)) throw new HttpError(400, "Template priority isn't valid.");
  if (!REMINDERS.has(reminder)) throw new HttpError(400, "Template reminder isn't valid.");
  return {
    id: id(rowId, "template id"), class_id: row.class_id === undefined || row.class_id === null || row.class_id === "" ? null : id(row.class_id, "class id"),
    title: text(row.title, "Title", 80, true), duration_minutes: duration, priority,
    notes: text(row.notes, "Notes", 5000), reminder_choice: reminder,
  };
}

export function cleanResource(row, rowId = row?.id) {
  object(row, "a class resource");
  const rawUrl = text(row.url, "URL", 2048, true);
  let url;
  try { url = new URL(rawUrl); } catch { throw new HttpError(400, "Enter a complete HTTP or HTTPS link."); }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new HttpError(400, "Use an HTTP or HTTPS link without a username or password.");
  if (url.href.length > 2048) throw new HttpError(400, "URL is too long.");
  const sortOrder = row.sort_order ?? 0;
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) throw new HttpError(400, "Resource order must be between 0 and 10000.");
  return {
    id: id(rowId, "resource id"), class_id: id(row.class_id, "class id"),
    title: text(row.title, "Title", 120, true), url: url.href,
    description: text(row.description, "Description", 2000), category: text(row.category, "Category", 60), sort_order: sortOrder,
  };
}

export function cleanOrganizationPreferences(row) {
  object(row, "organization preferences");
  if (!Number.isInteger(row.urgency_days) || row.urgency_days < 0 || row.urgency_days > 30) throw new HttpError(400, "Urgency window must be between 0 and 30 days.");
  return { urgency_days: row.urgency_days };
}

export async function loadOrganization(env, userId) {
  const [templates, resources, preferences] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM task_templates WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at, id").bind(userId),
    env.DB.prepare("SELECT * FROM class_resources WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, created_at, id").bind(userId),
    env.DB.prepare("SELECT urgency_days FROM planner_preferences WHERE user_id = ?").bind(userId),
  ]);
  return { templates: templates.results, resources: resources.results, organization: preferences.results[0] || { urgency_days: 2 } };
}

async function runDb(work) {
  try { return await work(); } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("class belongs to another user") || message.includes("FOREIGN KEY")) throw new HttpError(400, "That class isn't in your planner.");
    if (message.includes("CHECK constraint") || message.includes("NOT NULL constraint")) throw new HttpError(400, "Some of those details aren't valid.");
    if (message.includes("UNIQUE constraint")) throw new HttpError(409, "That already exists.");
    throw error;
  }
}

const PREFERENCES_UPSERT = `INSERT INTO planner_preferences (user_id, urgency_days, updated_at) VALUES (?1, ?2, ?3)
ON CONFLICT (user_id) DO UPDATE SET urgency_days = excluded.urgency_days, updated_at = excluded.updated_at RETURNING *`;

// Imports use server-built columns, then share the caller's classes-first transaction. A plain
// insert rejects collisions instead of changing another account's row or reviving deleted rows.
export function organizationImportStatements(db, userId, body) {
  const statements = [];
  for (const [key, table, clean] of [["templateRows", "task_templates", cleanTemplate], ["resourceRows", "class_resources", cleanResource]]) {
    if (body[key] !== undefined && !Array.isArray(body[key])) throw new HttpError(400, `Send ${key} as a list.`);
    const rows = body[key] || [];
    if (rows.length > MAX_IMPORT_ROWS) throw new HttpError(413, "That's too much planner data to import at once.");
    if (!rows.length) continue;
    const cleaned = rows.map((row) => clean(row));
    const columns = Object.keys(cleaned[0]);
    statements.push(db.prepare(`INSERT INTO ${table} (user_id, ${columns.join(", ")}, updated_at)
      SELECT ?1, ${columns.map((column) => `json_extract(value, '$.${column}')`).join(", ")}, ?3 FROM json_each(?2)`)
      .bind(userId, JSON.stringify(cleaned), nowIso()));
  }
  if (body.organization !== undefined) {
    const preferences = cleanOrganizationPreferences(body.organization);
    statements.push(db.prepare(PREFERENCES_UPSERT).bind(userId, preferences.urgency_days, nowIso()));
  }
  return statements;
}

export async function handleOrganization(request, env, ctx, path, user) {
  const method = request.method;
  const notify = (table, row) => ctx.waitUntil(broadcast(env, user.id, { table, row }));
  if (path === "/api/organization-preferences" && method === "PUT") {
    const row = cleanOrganizationPreferences(await readJson(request));
    const saved = await env.DB.prepare(PREFERENCES_UPSERT).bind(user.id, row.urgency_days, nowIso()).first();
    notify("planner_preferences", saved);
    return json({ preferences: { urgency_days: saved.urgency_days } });
  }
  const match = /^\/api\/(task-templates|class-resources)\/([^/]+)$/.exec(path);
  if (!match) return null;
  const template = match[1] === "task-templates";
  const table = template ? "task_templates" : "class_resources";
  const envelope = template ? "template" : "resource";
  let decodedId;
  try { decodedId = decodeURIComponent(match[2]); } catch { throw new HttpError(400, `That ${envelope} id isn't valid.`); }
  const rowId = id(decodedId, `${envelope} id`);
  if (method === "PUT") {
    const row = (template ? cleanTemplate : cleanResource)(await readJson(request), rowId);
    const columns = Object.keys(row);
    const saved = await runDb(() => env.DB.prepare(`INSERT INTO ${table} (user_id, ${columns.join(", ")}, updated_at)
      VALUES (?1, ${columns.map((_, index) => `?${index + 2}`).join(", ")}, ?${columns.length + 2})
      ON CONFLICT (id) DO UPDATE SET ${columns.filter((column) => column !== "id").map((column) => `${column} = excluded.${column}`).join(", ")}, updated_at = excluded.updated_at
      WHERE ${table}.user_id = excluded.user_id AND ${table}.deleted_at IS NULL RETURNING *`)
      .bind(user.id, ...Object.values(row), nowIso()).first());
    if (!saved) throw new HttpError(404, `That ${envelope} isn't in your planner.`);
    notify(table, saved);
    return json({ [envelope]: saved });
  }
  if (method === "DELETE") {
    const now = nowIso();
    const saved = await env.DB.prepare(`UPDATE ${table} SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NULL RETURNING *`).bind(now, rowId, user.id).first();
    if (saved) notify(table, saved);
    return json({ [envelope]: saved });
  }
  return null;
}
