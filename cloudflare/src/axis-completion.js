import Reminders from "../../landing/reminder-domain.js";

// Only used for brand-new rows in the account's first successful Axis import.
// Date-only assignments remain open for their whole due day in the student's zone.
export function overdueImportIds(rows, { now = Date.now(), timeZone = "America/Los_Angeles" } = {}) {
  if (!Number.isFinite(now)) return [];
  let today;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone, calendar: "gregory", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(now)).map(part => [part.type, part.value]));
    today = `${parts.year}-${parts.month}-${parts.day}`;
  } catch { return []; }
  const deadlines = new Map();
  return rows.filter(row => {
    const date = row.due_date, time = row.due_time;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const probe = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(probe.getTime()) || probe.toISOString().slice(0, 10) !== date) return false;
    if (time != null && time !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
    if (date !== today || !time) return date < today;
    if (!deadlines.has(time)) deadlines.set(time, Reminders.wallTimeToEpoch(date, time, timeZone));
    const deadline = deadlines.get(time);
    return deadline.ok && deadline.epoch < now;
  }).map(row => row.id);
}
