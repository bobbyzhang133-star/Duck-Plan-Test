// Planner data API. D1 has no row-level security, so **every statement here is scoped by the
// signed-in user's id** — that is the rule that replaces Postgres RLS. Rows go to and from the
// browser with the snake_case column names that planner-store.js's rowToTask/rowToClass expect.
import { HttpError, json, nowIso, readJson } from "./http.js";
import { broadcast } from "./live.js";
import { loadOrganization, organizationImportStatements } from "./organization.js";
import { loadPersonal, personalImportPlan } from "./personal.js";

const ITEM_TYPES = new Set(["assignment", "test", "task", "event"]);
const PRIORITIES = new Set(["low", "medium", "high"]);
const IMPORTANCE = new Set(["important", "not_important"]);
const URGENCY = new Set(["auto", "urgent", "not_urgent"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const MAX_IMPORT_CLASSES = 200;
const MAX_IMPORT_ITEMS = 2000;
const IMPORT_KEY = /^[0-9a-f]{64}$/i;

const bit = (value) => (value ? 1 : 0);
function text(value, { max, field, required = false }) {
  if (value === null || value === undefined || value === "") {
    if (required) throw new HttpError(400, `${field} is required.`);
    return null;
  }
  const result = String(value).trim();
  if (required && !result) throw new HttpError(400, `${field} is required.`);
  if (result.length > max) throw new HttpError(400, `${field} is too long.`);
  return result || null;
}
function matching(value, pattern, field) {
  if (value === null || value === undefined || value === "") return null;
  if (!pattern.test(String(value))) throw new HttpError(400, `${field} isn't valid.`);
  return String(value);
}
export function assertId(id, what = "id") {
  if (!UUID.test(String(id || ""))) throw new HttpError(400, `That ${what} isn't valid.`);
  return String(id).toLowerCase();
}

// Only these columns are writable from the browser. Axis bookkeeping (source, axis_uid,
// axis_missing), ownership, and timestamps are always set by the server.
export function cleanItem(row, id = row?.id) {
  if (!row || typeof row !== "object") throw new HttpError(400, "Send a task.");
  const type = row.type || "task";
  const priority = String(row.priority || "medium").toLowerCase();
  if (!ITEM_TYPES.has(type)) throw new HttpError(400, "Task type isn't valid.");
  if (!PRIORITIES.has(priority)) throw new HttpError(400, "Priority isn't valid.");
  const duration = Number(row.duration_minutes ?? 45);
  if (!Number.isInteger(duration) || duration < 5 || duration > 1440) throw new HttpError(400, "Duration must be between 5 minutes and 24 hours.");
  const importance = row.importance ?? null;
  const urgency = row.urgency === undefined ? "auto" : row.urgency;
  if (importance !== null && !IMPORTANCE.has(importance)) throw new HttpError(400, "Task importance isn't valid.");
  if (!URGENCY.has(urgency)) throw new HttpError(400, "Task urgency isn't valid.");
  return {
    id: assertId(id, "task id"),
    class_id: row.class_id ? assertId(row.class_id, "class id") : null,
    type,
    title: text(row.title, { max: 300, field: "Title", required: true }),
    notes: text(row.notes, { max: 20_000, field: "Notes" }) || "",
    priority,
    importance,
    urgency,
    due_date: matching(row.due_date, DATE, "Due date"),
    due_time: matching(row.due_time, TIME, "Due time")?.slice(0, 5) ?? null,
    scheduled_start: matching(row.scheduled_start, DATETIME, "Scheduled start")?.slice(0, 16) ?? null,
    duration_minutes: duration,
    completed: bit(row.completed),
  };
}

export function cleanClass(row, id = row?.id) {
  if (!row || typeof row !== "object") throw new HttpError(400, "Send a class.");
  const color = matching(row.color || "#c48b34", COLOR, "Color");
  return {
    id: assertId(id, "class id"),
    name: text(row.name, { max: 120, field: "Class name", required: true }),
    teacher: text(row.teacher, { max: 120, field: "Teacher" }),
    period: text(row.period, { max: 60, field: "Period" }),
    color,
    code: text(row.code, { max: 4, field: "Short code" }),
    archived: bit(row.archived),
  };
}

// Turns trigger and constraint failures into readable 400s instead of 500s.
export async function runDb(work) {
  try { return await work(); } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("checkin habit")) throw new HttpError(400, "That habit isn't in your planner.");
    if (message.includes("class belongs to another user") || message.includes("FOREIGN KEY")) throw new HttpError(400, "That class isn't in your planner.");
    if (message.includes("CHECK constraint") || message.includes("NOT NULL constraint")) throw new HttpError(400, "Some of those details aren't valid.");
    if (message.includes("UNIQUE constraint")) throw new HttpError(409, "That already exists.");
    throw error;
  }
}

// One INSERT … SELECT FROM json_each(?) writes any number of rows in a single statement. Column
// names come from server-built rows (never from the request), and are checked anyway.
export function jsonInsert(db, table, userId, rows, conflict = "") {
  const columns = Object.keys(rows[0]);
  if (!columns.every((column) => /^[a-z_]+$/.test(column))) throw new Error("bad column name");
  const extracts = columns.map((column) => `json_extract(value, '$.${column}')`).join(", ");
  const sql = `INSERT INTO ${table} (user_id, ${columns.join(", ")}, updated_at) SELECT ?1, ${extracts}, ?3 FROM json_each(?2) WHERE true ${conflict}`;
  return db.prepare(sql).bind(userId, JSON.stringify(rows), nowIso());
}

const ITEM_UPSERT = `
INSERT INTO items (id, user_id, class_id, type, title, notes, priority, due_date, due_time, scheduled_start, duration_minutes, completed, completed_at, updated_at, importance, urgency)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, CASE WHEN ?12 = 1 THEN ?13 END, ?13, ?14, ?15)
ON CONFLICT (id) DO UPDATE SET
  class_id = excluded.class_id, type = excluded.type, title = excluded.title, notes = excluded.notes,
  priority = excluded.priority, due_date = excluded.due_date, due_time = excluded.due_time,
  scheduled_start = excluded.scheduled_start, duration_minutes = excluded.duration_minutes, completed = excluded.completed,
  importance = CASE WHEN ?16 THEN excluded.importance ELSE items.importance END,
  urgency = CASE WHEN ?17 THEN excluded.urgency ELSE items.urgency END,
  completed_at = CASE WHEN excluded.completed = 0 THEN NULL WHEN items.completed = 1 THEN items.completed_at ELSE excluded.completed_at END,
  updated_at = excluded.updated_at
WHERE items.user_id = excluded.user_id AND items.deleted_at IS NULL
RETURNING *`;

const CLASS_UPSERT = `
INSERT INTO classes (id, user_id, name, teacher, period, color, code, archived, updated_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name, teacher = excluded.teacher, period = excluded.period, color = excluded.color,
  code = excluded.code, archived = excluded.archived, updated_at = excluded.updated_at
WHERE classes.user_id = excluded.user_id
RETURNING *`;

export async function loadPlanner(env, userId) {
  const [[classes, items], organization, personal] = await Promise.all([
    env.DB.batch([
      env.DB.prepare("SELECT * FROM classes WHERE user_id = ? ORDER BY created_at, id").bind(userId),
      env.DB.prepare("SELECT * FROM items WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at, id").bind(userId),
    ]),
    loadOrganization(env, userId),
    loadPersonal(env, userId),
  ]);
  return { classes: classes.results, items: items.results, ...organization, ...personal };
}

async function loadImportReceipt(db, userId, key) {
  const row = await db.prepare("SELECT imported, classes_added AS classesAdded, templates_added AS templatesAdded, resources_added AS resourcesAdded, goals_added AS goalsAdded, habits_added AS habitsAdded, habit_checkins_added AS habitCheckinsAdded, notes_added AS notesAdded, personal_present FROM planner_imports WHERE user_id = ? AND import_key = ?")
    .bind(userId, key).first();
  if (!row) return null;
  const { personal_present, goalsAdded, habitsAdded, habitCheckinsAdded, notesAdded, ...existing } = row;
  return personal_present ? { ...existing, goalsAdded, habitsAdded, habitCheckinsAdded, notesAdded } : existing;
}

export async function handlePlanner(request, env, ctx, path, user) {
  const method = request.method;
  const db = env.DB;
  const notify = (message) => ctx.waitUntil(broadcast(env, user.id, message));

  if (path === "/api/planner" && method === "GET") return json(await loadPlanner(env, user.id));

  const itemMatch = /^\/api\/items\/([^/]+)$/.exec(path);
  if (itemMatch) {
    const id = assertId(decodeURIComponent(itemMatch[1]), "task id");
    if (method === "PUT") {
      const body = await readJson(request);
      const row = cleanItem(body, id);
      const saved = await runDb(() => db.prepare(ITEM_UPSERT).bind(row.id, user.id, row.class_id, row.type, row.title, row.notes, row.priority, row.due_date, row.due_time, row.scheduled_start, row.duration_minutes, row.completed, nowIso(), row.importance, row.urgency, bit(Object.hasOwn(body, "importance")), bit(Object.hasOwn(body, "urgency"))).first());
      if (!saved) throw new HttpError(404, "That task isn't in your planner.");
      notify({ table: "items", row: saved });
      return json({ item: saved });
    }
    if (method === "PATCH") {
      const body = await readJson(request);
      if (typeof body.completed !== "boolean") throw new HttpError(400, "Send completed: true or false.");
      const now = nowIso();
      const saved = await db.prepare("UPDATE items SET completed = ?1, completed_at = CASE WHEN ?1 = 0 THEN NULL ELSE coalesce(completed_at, ?2) END, updated_at = ?2 WHERE id = ?3 AND user_id = ?4 AND deleted_at IS NULL RETURNING *")
        .bind(bit(body.completed), now, id, user.id).first();
      if (!saved) throw new HttpError(404, "That task isn't in your planner.");
      notify({ table: "items", row: saved });
      return json({ item: saved });
    }
    if (method === "DELETE") {
      // Soft delete, so the deletion reaches every device. Deleting twice is fine.
      const now = nowIso();
      const saved = await db.prepare("UPDATE items SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NULL RETURNING *").bind(now, id, user.id).first();
      if (saved) notify({ table: "items", row: saved });
      return json({ ok: true });
    }
  }

  const classMatch = /^\/api\/classes\/([^/]+)$/.exec(path);
  if (classMatch && method === "PUT") {
    const row = cleanClass(await readJson(request), decodeURIComponent(classMatch[1]));
    const saved = await runDb(() => db.prepare(CLASS_UPSERT).bind(row.id, user.id, row.name, row.teacher, row.period, row.color, row.code, row.archived, nowIso()).first());
    if (!saved) throw new HttpError(404, "That class isn't in your planner.");
    notify({ table: "classes", row: saved });
    return json({ class: saved });
  }

  // First sign-in: copy this browser's local tasks into the account in one transaction.
  if (path === "/api/import" && method === "POST") {
    const body = await readJson(request, 5_000_000);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Send planner data to import.");
    let importKey = null;
    if (body.idempotencyKey !== undefined) {
      if (typeof body.idempotencyKey !== "string" || !IMPORT_KEY.test(body.idempotencyKey)) throw new HttpError(400, "Import key must be a 64-character hexadecimal value.");
      importKey = body.idempotencyKey.toLowerCase();
      const previous = await loadImportReceipt(db, user.id, importKey);
      if (previous) return json(previous);
    }
    const classRows = Array.isArray(body.classRows) ? body.classRows : [];
    const itemRows = Array.isArray(body.itemRows) ? body.itemRows : [];
    if (classRows.length > MAX_IMPORT_CLASSES || itemRows.length > MAX_IMPORT_ITEMS) throw new HttpError(413, "That's too many tasks to import at once.");
    const classes = classRows.map((row) => cleanClass(row));
    const items = itemRows.map((row) => cleanItem(row));
    const statements = [];
    if (classes.length) statements.push(jsonInsert(db, "classes", user.id, classes));
    if (items.length) statements.push(jsonInsert(db, "items", user.id, items.map((row) => ({ ...row, completed_at: row.completed ? nowIso() : null }))));
    statements.push(...organizationImportStatements(db, user.id, body));
    const personal = personalImportPlan(db, user.id, body);
    statements.push(...personal.statements);
    const receipt = { imported: items.length, classesAdded: classes.length, templatesAdded: body.templateRows?.length || 0, resourcesAdded: body.resourceRows?.length || 0, ...(personal.present ? personal.counts : {}) };
    if (importKey) statements.unshift(db.prepare("INSERT INTO planner_imports (user_id, import_key, imported, classes_added, templates_added, resources_added, goals_added, habits_added, habit_checkins_added, notes_added, personal_present) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(user.id, importKey, receipt.imported, receipt.classesAdded, receipt.templatesAdded, receipt.resourcesAdded, personal.counts.goalsAdded, personal.counts.habitsAdded, personal.counts.habitCheckinsAdded, personal.counts.notesAdded, personal.present ? 1 : 0));
    try {
      if (statements.length) await runDb(() => db.batch(statements));
    } catch (error) {
      // Concurrent requests can both miss the first read. A duplicate receipt aborts the
      // second transaction before dependent rows are inserted; return the committed result.
      const previous = importKey && await loadImportReceipt(db, user.id, importKey);
      if (previous) return json(previous);
      throw error;
    }
    notify({ reload: true });
    return json(receipt);
  }

  return null;
}
