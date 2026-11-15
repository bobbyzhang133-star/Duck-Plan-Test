import { HttpError } from "./http.js";

const WALL_TIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

function invalid() { throw new HttpError(400, "Work alert settings aren't valid."); }
function keys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(value, key))) invalid();
}
function wallTime(value) {
  if (value === null) return null;
  if (typeof value !== "string" || !WALL_TIME.test(value)) invalid();
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number(value.slice(0, 4)) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) invalid();
  return value;
}

// Preferences only: resolving future instants and DST belongs to the device scheduler.
export function cleanWorkAlerts(value) {
  if (value === null) return null;
  if (typeof value === "string") {
    if (value.length > 2048) invalid();
    try { value = JSON.parse(value); } catch { invalid(); }
  }
  keys(value, ["version", "timeZone", "alarm", "notification"]);
  if (value.version !== 1 || typeof value.timeZone !== "string" || value.timeZone.length > 100) invalid();
  try { new Intl.DateTimeFormat("en", { timeZone: value.timeZone }).format(0); } catch { invalid(); }
  keys(value.alarm, ["enabled", "mode", "at", "sound", "snoozeMinutes"]);
  keys(value.notification, ["enabled", "mode", "at"]);
  const { alarm, notification } = value;
  if (typeof alarm.enabled !== "boolean" || !["work", "manual"].includes(alarm.mode) || !["system", "gentle", "bright"].includes(alarm.sound) || ![0, 5, 10, 15].includes(alarm.snoozeMinutes)) invalid();
  if (typeof notification.enabled !== "boolean" || !["alarm", "manual"].includes(notification.mode)) invalid();
  const alarmAt = wallTime(alarm.at), notificationAt = wallTime(notification.at);
  if ((alarm.mode === "work" && alarmAt !== null) || (alarm.mode === "manual" && alarm.enabled && alarmAt === null)) invalid();
  if ((notification.mode === "alarm" && notificationAt !== null) || (notification.mode === "manual" && notification.enabled && notificationAt === null)) invalid();
  return { version: 1, timeZone: value.timeZone,
    alarm: { enabled: alarm.enabled, mode: alarm.mode, at: alarmAt, sound: alarm.sound, snoozeMinutes: alarm.snoozeMinutes },
    notification: { enabled: notification.enabled, mode: notification.mode, at: notificationAt } };
}
