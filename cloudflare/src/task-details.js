import { HttpError } from "./http.js";

const REMINDERS = new Set(["default", "off", "15", "60", "1440"]);

function invalid() { throw new HttpError(400, "Task details aren't valid."); }

// This is shared task data, not a device cache. Keep the versioned payload small and
// explicit so old clients can omit it without erasing a newer client's settings.
export function cleanTaskDetails(value) {
  if (value === null) return null;
  if (typeof value === "string") {
    if (value.length > 512) invalid();
    try { value = JSON.parse(value); } catch { invalid(); }
  }
  const fields = ["version", "actualMinutes", "reminderChoice"];
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !fields.includes(key)) ||
      fields.some(key => !Object.hasOwn(value, key))) invalid();
  if (value.version !== 1 || !REMINDERS.has(value.reminderChoice)) invalid();
  if (value.actualMinutes !== null && (!Number.isInteger(value.actualMinutes) || value.actualMinutes < 0 || value.actualMinutes > 10080)) invalid();
  return { version: 1, actualMinutes: value.actualMinutes, reminderChoice: value.reminderChoice };
}
