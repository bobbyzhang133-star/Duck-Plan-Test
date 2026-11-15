// Saved personal planning. Ownership is always server-selected, including dependent check-ins.
import { HttpError, json, nowIso, readJson } from "./http.js";
import { broadcast } from "./live.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value, name) {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(400, `That ${name} id isn't valid.`);
  return value.toLowerCase();
}
function object(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new HttpError(400, "Send personal planner details.");
}
function text(value, field, max, required = false, trim = true) {
  if (value !== undefined && value !== null && typeof value !== "string") throw new HttpError(400, `${field} isn't valid.`);
  const clean = trim ? (value || "").trim() : value || "";
  if (required && !clean) throw new HttpError(400, `${field} is required.`);
  if (clean.length > max) throw new HttpError(400, `${field} is too long.`);
  return clean;
}
function integer(value, fallback, min, max, field) {
  const number = value === undefined ? fallback : value;
  if (!Number.isInteger(number) || number < min || number > max) throw new HttpError(400, `${field} must be a whole number from ${min} to ${max}.`);
  return number;
}
export function validPersonalDate(value, optional = false) {
  if (optional && (value === undefined || value === null || value === "")) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, "Choose a valid calendar date.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new HttpError(400, "Choose a valid calendar date.");
  return value;
}
export function cleanGoal(row, rowId = row?.id) {
  object(row);
  return {
    id: id(rowId, "goal"), title: text(row.title, "Goal title", 100, true), notes: text(row.notes, "Goal notes", 5000),
    target_count: integer(row.target_count, 5, 1, 100000, "Goal target"),
    current_count: integer(row.current_count, 0, 0, 100000, "Goal progress"),
    unit: text(row.unit === undefined ? "sessions" : row.unit, "Goal unit", 30, true),
    deadline_date: validPersonalDate(row.deadline_date, true),
  };
}
export function cleanHabit(row, rowId = row?.id) {
  object(row);
  let days = row.repeat_days === undefined ? [0, 1, 2, 3, 4, 5, 6] : row.repeat_days;
  if (typeof days === "string") { try { days = JSON.parse(days); } catch { throw new HttpError(400, "Choose valid repeat days."); } }
  if (!Array.isArray(days) || !days.length || days.length > 7 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || new Set(days).size !== days.length) throw new HttpError(400, "Choose one or more different repeat days from 0 to 6.");
  return { id: id(rowId, "habit"), title: text(row.title, "Habit title", 100, true), notes: text(row.notes, "Habit notes", 2000), repeat_days: JSON.stringify([...days].sort((a, b) => a - b)) };
}
export function cleanNote(row, rowId = row?.id) {
  object(row);
  return { id: id(rowId, "note"), title: text(row.title, "Note title", 100, true), category: text(row.category, "Category", 60) || "Personal", body: text(row.body, "Note", 5000, false, false) };
}
function cleanCheckin(row) {
  object(row);
  if (row.completed !== undefined && typeof row.completed !== "boolean" && row.completed !== 0 && row.completed !== 1) throw new HttpError(400, "Send completed: true or false.");
  const completed = row.completed === undefined ? true : Boolean(row.completed);
  return { habit_id: id(row.habit_id, "habit"), date: validPersonalDate(row.date), completed: completed ? 1 : 0, deleted_at: completed ? null : nowIso() };
}
async function runDb(work) {
  try { return await work(); } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("checkin habit") || message.includes("FOREIGN KEY")) throw new HttpError(400, "That habit isn't in your planner.");
    if (message.includes("CHECK constraint") || message.includes("NOT NULL constraint") || message.includes("repeat days")) throw new HttpError(400, "Some of those details aren't valid.");
    if (message.includes("UNIQUE constraint")) throw new HttpError(409, "That already exists.");
    throw error;
  }
}
export async function loadPersonal(env, userId) {
  const results = await env.DB.batch([
    ...["goals", "habits", "notes"].map((table) => env.DB.prepare(`SELECT * FROM ${table} WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at, id`).bind(userId)),
    env.DB.prepare("SELECT c.* FROM habit_checkins c JOIN habits h ON h.id = c.habit_id AND h.user_id = c.user_id WHERE c.user_id = ? AND c.deleted_at IS NULL AND c.completed = 1 AND h.deleted_at IS NULL ORDER BY c.date, c.habit_id").bind(userId),
  ]);
  return { goals: results[0].results, habits: results[1].results, notes: results[2].results, habit_checkins: results[3].results };
}
export function personalImportPlan(db, userId, body) {
  const statements = [], counts = {};
  let present = false;
  for (const [field, table, clean, count] of [
    ["goalRows", "goals", cleanGoal, "goalsAdded"], ["habitRows", "habits", cleanHabit, "habitsAdded"],
    ["noteRows", "notes", cleanNote, "notesAdded"], ["habitCheckinRows", "habit_checkins", cleanCheckin, "habitCheckinsAdded"],
  ]) {
    if (body[field] !== undefined) present = true;
    if (body[field] !== undefined && !Array.isArray(body[field])) throw new HttpError(400, `Send ${field} as a list.`);
    const rows = body[field] || [];
    if (rows.length > 2000) throw new HttpError(413, "That's too much personal planner data to import at once.");
    counts[count] = rows.length;
    if (!rows.length) continue;
    const cleaned = rows.map((row) => clean(row));
    const columns = Object.keys(cleaned[0]);
    statements.push(db.prepare(`INSERT INTO ${table} (user_id, ${columns.join(", ")}, updated_at)
      SELECT ?1, ${columns.map((column) => `json_extract(value, '$.${column}')`).join(", ")}, ?3 FROM json_each(?2)`)
      .bind(userId, JSON.stringify(cleaned), nowIso()));
  }
  return { statements, counts, present };
}
export async function handlePersonal(request, env, ctx, path, user) {
  const notify = (table, row) => ctx.waitUntil(broadcast(env, user.id, { table, row }));
  const checkinMatch = /^\/api\/habit-checkins\/([^/]+)\/([^/]+)$/.exec(path);
  if (checkinMatch && request.method === "PUT") {
    let habitId, date;
    try { habitId = id(decodeURIComponent(checkinMatch[1]), "habit"); date = validPersonalDate(decodeURIComponent(checkinMatch[2])); } catch (error) {
      throw error instanceof HttpError ? error : new HttpError(400, "Choose a valid habit and calendar date.");
    }
    const body = await readJson(request);
    if (!body || typeof body.completed !== "boolean") throw new HttpError(400, "Send completed: true or false.");
    const habit = await env.DB.prepare("SELECT id FROM habits WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(habitId, user.id).first();
    if (!habit) throw new HttpError(404, "That habit isn't in your planner.");
    const now = nowIso();
    const saved = body.completed
      ? await runDb(() => env.DB.prepare(`INSERT INTO habit_checkins (user_id, habit_id, date, completed, updated_at) VALUES (?1, ?2, ?3, 1, ?4)
        ON CONFLICT (user_id, habit_id, date) DO UPDATE SET completed = 1, deleted_at = NULL, updated_at = excluded.updated_at RETURNING *`).bind(user.id, habitId, date, now).first())
      : await env.DB.prepare("UPDATE habit_checkins SET completed = 0, deleted_at = ?1, updated_at = ?1 WHERE user_id = ?2 AND habit_id = ?3 AND date = ?4 AND deleted_at IS NULL RETURNING *").bind(now, user.id, habitId, date).first();
    if (saved) notify("habit_checkins", saved);
    return json({ checkin: saved });
  }
  const match = /^\/api\/(goals|habits|notes)\/([^/]+)$/.exec(path);
  if (!match) return null;
  const table = match[1], noun = { goals: "goal", habits: "habit", notes: "note" }[table];
  let rowId;
  try { rowId = id(decodeURIComponent(match[2]), noun); } catch (error) { throw error instanceof HttpError ? error : new HttpError(400, `That ${noun} id isn't valid.`); }
  if (request.method === "PUT") {
    const clean = { goals: cleanGoal, habits: cleanHabit, notes: cleanNote }[table];
    const row = clean(await readJson(request), rowId), columns = Object.keys(row);
    const saved = await runDb(() => env.DB.prepare(`INSERT INTO ${table} (user_id, ${columns.join(", ")}, updated_at)
      VALUES (?1, ${columns.map((_, index) => `?${index + 2}`).join(", ")}, ?${columns.length + 2})
      ON CONFLICT (id) DO UPDATE SET ${columns.filter((column) => column !== "id").map((column) => `${column} = excluded.${column}`).join(", ")}, updated_at = excluded.updated_at
      WHERE ${table}.user_id = excluded.user_id AND ${table}.deleted_at IS NULL RETURNING *`).bind(user.id, ...Object.values(row), nowIso()).first());
    if (!saved) throw new HttpError(404, `That ${noun} isn't in your planner.`);
    notify(table, saved);
    return json({ [noun]: saved });
  }
  if (request.method === "DELETE") {
    const now = nowIso(), statements = [];
    if (table === "habits") statements.push(env.DB.prepare("UPDATE habit_checkins SET completed = 0, deleted_at = ?1, updated_at = ?1 WHERE habit_id = ?2 AND user_id = ?3 AND deleted_at IS NULL RETURNING *").bind(now, rowId, user.id));
    statements.push(env.DB.prepare(`UPDATE ${table} SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NULL RETURNING *`).bind(now, rowId, user.id));
    const results = await env.DB.batch(statements);
    if (table === "habits") for (const row of results[0].results) notify("habit_checkins", row);
    const saved = results.at(-1).results[0] || null;
    if (saved) notify(table, saved);
    return json({ [noun]: saved });
  }
  return null;
}
