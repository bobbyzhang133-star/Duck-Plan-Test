(function workAlertsFactory(root, factory) {
  const reminderDomain = typeof module === "object" && module.exports
    ? require("./reminder-domain.js") : root?.DuckReminderDomain;
  const api = factory(reminderDomain);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckWorkAlerts = api;
})(typeof window !== "undefined" ? window : globalThis, function buildWorkAlerts(ReminderDomain) {
  "use strict";

  const CHANNELS = ["alarm", "notification"];
  const MAX_AHEAD_MS = 366 * 86400000;
  const MIN_AHEAD_MS = 5000;
  const SOUNDS = ["system", "gentle", "bright"];
  const SNOOZE_MINUTES = [0, 5, 10, 15];
  const validZones = new Set();

  function invalid(field, message, code = "invalid-alert") {
    const error = new Error(message);
    error.field = field;
    error.code = code;
    return error;
  }

  function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function timeField(channel) { return channel === "alarm" ? "alarmAt" : "notificationAt"; }
  function validWallTime(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    return year >= 1 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  function timeZone(value) {
    const zone = value ?? ReminderDomain?.browserTimeZone?.() ?? "UTC";
    if (typeof zone !== "string" || !zone || zone.length > 100) throw invalid("workAlertTimeZone", "Choose a valid notification time zone.", "invalid-time-zone");
    if (validZones.has(zone)) return zone;
    try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(0); }
    catch { throw invalid("workAlertTimeZone", "Choose a valid notification time zone.", "invalid-time-zone"); }
    validZones.add(zone);
    return zone;
  }
  function keys(value, allowed, field) {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) throw invalid(field, "Choose valid task alert settings.");
  }
  function channelName(channel) {
    if (!CHANNELS.includes(channel)) throw invalid("workAlerts", "Choose an alarm or notification channel.");
    return channel;
  }

  function defaults({ timeZone: zone } = {}) {
    return {
      version: 1,
      timeZone: timeZone(zone),
      alarm: { enabled: true, mode: "work", at: null, sound: "system", snoozeMinutes: 5 },
      notification: { enabled: true, mode: "alarm", at: null },
    };
  }

  function normalize(value, { timeZone: zone } = {}) {
    if (value == null) return defaults({ timeZone: zone });
    keys(value, ["version", "timeZone", "alarm", "notification"], "workAlerts");
    if (value.version !== 1) throw invalid("workAlerts", "This task uses an unsupported alert version.");
    const result = defaults({ timeZone: value.timeZone ?? zone });
    for (const channel of CHANNELS) {
      const source = value[channel];
      const allowed = channel === "alarm" ? ["enabled", "mode", "at", "sound", "snoozeMinutes"] : ["enabled", "mode", "at"];
      keys(source, allowed, timeField(channel));
      const followMode = channel === "alarm" ? "work" : "alarm";
      if (typeof source.enabled !== "boolean" || ![followMode, "manual"].includes(source.mode)) throw invalid(timeField(channel), "Choose valid task alert settings.");
      const at = source.at ?? null;
      if (at !== null && !validWallTime(at)) throw invalid(timeField(channel), "Choose a valid alert date and time.", "invalid-wall-time");
      if (source.mode === "manual" && source.enabled && at === null) throw invalid(timeField(channel), "Choose an alert time or turn this alert off.", "missing-time");
      result[channel] = { enabled: source.enabled, mode: source.mode, at: source.mode === "manual" ? at : null };
      if (channel === "alarm") {
        const sound = source.sound ?? "system", snoozeMinutes = source.snoozeMinutes ?? 5;
        if (!SOUNDS.includes(sound) || !SNOOZE_MINUTES.includes(snoozeMinutes)) throw invalid("alarmSound", "Choose a valid alarm sound and snooze time.");
        Object.assign(result.alarm, { sound, snoozeMinutes });
      }
    }
    return result;
  }

  function preferences(task = {}, options = {}) {
    if (task.workAlerts != null) return normalize(task.workAlerts, options);
    const result = defaults(options);
    if (options.legacyAlarmAt) {
      if (!validWallTime(options.legacyAlarmAt)) throw invalid("alarmAt", "Choose a valid alarm date and time.", "invalid-wall-time");
      Object.assign(result.alarm, {
        mode: "manual", at: options.legacyAlarmAt,
        sound: options.legacySound ?? "system", snoozeMinutes: options.legacySnoozeMinutes ?? 5,
      });
    }
    if (options.legacyNotificationAt) {
      if (!validWallTime(options.legacyNotificationAt)) throw invalid("notificationAt", "Choose a valid notification date and time.", "invalid-wall-time");
      Object.assign(result.notification, { mode: "manual", at: options.legacyNotificationAt });
    }
    return normalize(result);
  }

  function resolve(task = {}, value = preferences(task)) {
    const prefs = normalize(value);
    const alarmAt = prefs.alarm.mode === "manual" ? prefs.alarm.at : task.scheduledStart || null;
    const notificationAt = prefs.notification.mode === "manual" ? prefs.notification.at : alarmAt;
    return { alarmAt, notificationAt, timeZone: prefs.timeZone };
  }

  function editTime(value, channel, at) {
    channelName(channel);
    const prefs = normalize(value);
    if (at === "" || at == null) Object.assign(prefs[channel], { enabled: false, mode: "manual", at: null });
    else {
      if (!validWallTime(at)) throw invalid(timeField(channel), "Choose a valid alert date and time.", "invalid-wall-time");
      Object.assign(prefs[channel], { mode: "manual", at });
    }
    return prefs;
  }

  function follow(value, channel) {
    channelName(channel);
    const prefs = normalize(value);
    Object.assign(prefs[channel], { mode: channel === "alarm" ? "work" : "alarm", at: null });
    return prefs;
  }

  function setEnabled(value, channel, enabled) {
    channelName(channel);
    if (typeof enabled !== "boolean") throw invalid(timeField(channel), "Choose whether this alert is enabled.");
    const prefs = normalize(value);
    if (enabled && prefs[channel].mode === "manual" && prefs[channel].at === null) {
      Object.assign(prefs[channel], { mode: channel === "alarm" ? "work" : "alarm", at: null });
    }
    prefs[channel].enabled = enabled;
    return prefs;
  }

  function forSave(task, options = {}) {
    return { ...task, workAlerts: preferences(task, options) };
  }

  // resolveWall uses the existing reminder-domain signature (date, time, IANA zone).
  // Loading a task without explicit preferences never activates legacy work automatically.
  function deliveries(task = {}, { now = Date.now(), resolveWall = ReminderDomain?.wallTimeToEpoch } = {}) {
    const prefs = preferences(task);
    const times = resolve(task, prefs);
    const result = {};
    for (const channel of CHANNELS) {
      const wallTime = times[channel === "alarm" ? "alarmAt" : "notificationAt"];
      const state = { status: "pending", eligible: false, wallTime, fireAt: null, timeZone: prefs.timeZone };
      if (channel === "alarm") Object.assign(state, { sound: prefs.alarm.sound, snoozeMinutes: prefs.alarm.snoozeMinutes });
      if (task.workAlerts == null) state.status = "unconfigured";
      else if (task.deleted || task.deleted_at) state.status = "deleted";
      else if (task.completed) state.status = "completed";
      else if (!prefs[channel].enabled) state.status = "disabled";
      else if (!wallTime) state.status = "missing-time";
      else if (!validWallTime(wallTime)) state.status = "invalid-wall-time";
      else if (!Number.isFinite(now)) state.status = "invalid-evaluation-time";
      else {
        const resolved = typeof resolveWall === "function"
          ? resolveWall(wallTime.slice(0, 10), wallTime.slice(11, 16), prefs.timeZone) : { ok: false, reason: "unavailable-resolver" };
        if (!resolved?.ok || !Number.isFinite(resolved.epoch)) state.status = resolved?.reason || "invalid-wall-time";
        else {
          state.fireAt = resolved.epoch;
          state.ambiguousWallTime = Boolean(resolved.ambiguous);
          if (state.fireAt <= now) state.status = "past";
          else if (state.fireAt < now + MIN_AHEAD_MS) state.status = "too-soon";
          else if (state.fireAt > now + MAX_AHEAD_MS) state.status = "too-far";
          else { state.status = "ready"; state.eligible = true; }
        }
      }
      result[channel] = state;
    }
    return result;
  }

  function validate(task, options = {}) {
    const prefs = preferences(task), result = deliveries(task, options);
    for (const channel of CHANNELS) {
      if (!prefs[channel].enabled) continue;
      const source = channel === "notification" && prefs.notification.mode === "alarm" ? "alarm" : channel;
      if (prefs[source].mode !== "manual") continue;
      const status = result[channel].status;
      if (status === "missing-time" && prefs[channel].mode !== "manual") continue;
      if (["ready", "disabled", "completed", "deleted", "unconfigured"].includes(status)) continue;
      const message = status === "past" || status === "too-soon" ? "Choose an alert time at least five seconds in the future."
        : status === "too-far" ? "Choose an alert time within the next year."
        : status === "nonexistent-wall-time" ? "That alert time does not exist in your time zone."
        : "Choose a valid alert date, time and time zone.";
      throw invalid(timeField(source), message, status);
    }
    return result;
  }

  return Object.freeze({ defaults, normalize, preferences, resolve, editTime, follow, setEnabled, forSave, deliveries, validate, validWallTime, MIN_AHEAD_MS, MAX_AHEAD_MS });
});
