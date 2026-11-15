const test = require("node:test");
const assert = require("node:assert/strict");
const Alerts = require("../landing/work-alerts.js");

const zone = "UTC";
const work = "2026-11-15T09:00";
const base = { id: "task-1", title: "Study", scheduledStart: work, dueDate: "2026-11-20", dueTime: "17:00", completed: false };
const options = { timeZone: zone };
const now = Date.UTC(2026, 10, 14);
const configured = (task = base) => Alerts.forSave(task, options);

test("new work defaults both channels on and resolves the explicit work → alarm → notification chain", () => {
  const task = configured();
  assert.deepEqual(task.workAlerts, {
    version: 1, timeZone: "UTC",
    alarm: { enabled: true, mode: "work", at: null, sound: "system", snoozeMinutes: 5 },
    notification: { enabled: true, mode: "alarm", at: null },
  });
  assert.deepEqual(Alerts.resolve(task), { alarmAt: work, notificationAt: work, timeZone: "UTC" });
  assert.deepEqual(Alerts.resolve({ ...task, scheduledStart: "2026-11-15T23:00" }), { alarmAt: "2026-11-15T23:00", notificationAt: "2026-11-15T23:00", timeZone: "UTC" });
  assert.equal(task.dueDate, base.dueDate); assert.equal(task.dueTime, base.dueTime);
  assert.equal(base.workAlerts, undefined);
});

test("editing a time severs only that explicit link even when its value currently matches", () => {
  let prefs = Alerts.editTime(Alerts.defaults(options), "alarm", work);
  assert.equal(prefs.alarm.mode, "manual");
  let task = { ...base, scheduledStart: "2026-11-16T10:00", workAlerts: prefs };
  assert.deepEqual(Alerts.resolve(task), { alarmAt: work, notificationAt: work, timeZone: "UTC" });
  prefs = Alerts.editTime(prefs, "notification", "2026-11-15T08:45");
  prefs = Alerts.editTime(prefs, "alarm", "2026-11-15T08:30");
  task = { ...task, workAlerts: prefs };
  assert.deepEqual(Alerts.resolve(task), { alarmAt: "2026-11-15T08:30", notificationAt: "2026-11-15T08:45", timeZone: "UTC" });
  prefs = Alerts.follow(prefs, "alarm");
  assert.deepEqual(Alerts.resolve(task, prefs), { alarmAt: "2026-11-16T10:00", notificationAt: "2026-11-15T08:45", timeZone: "UTC" });
  prefs = Alerts.follow(prefs, "notification");
  assert.deepEqual(Alerts.resolve(task, prefs), { alarmAt: "2026-11-16T10:00", notificationAt: "2026-11-16T10:00", timeZone: "UTC" });
});

test("separate enabled switches retain manual times and banner timing when the alarm is off", () => {
  const manual = Alerts.editTime(Alerts.defaults(options), "alarm", "2026-11-15T08:30");
  const off = Alerts.setEnabled(manual, "alarm", false);
  const task = { ...base, scheduledStart: "2026-11-16T10:00", workAlerts: off };
  assert.equal(Alerts.resolve(task).notificationAt, "2026-11-15T08:30");
  const result = Alerts.deliveries(task, { now });
  assert.equal(result.alarm.status, "disabled");
  assert.equal(result.notification.eligible, true);
  assert.equal(Alerts.setEnabled(off, "alarm", true).alarm.at, "2026-11-15T08:30");
  assert.equal(manual.alarm.enabled, true, "Switch helpers do not mutate their source preferences");
});

test("clearing a manual field is an explicit off state and enabling an empty channel restores its default link", () => {
  const initial = Alerts.defaults(options);
  const blank = Alerts.editTime(initial, "notification", "");
  assert.deepEqual(blank.notification, { enabled: false, mode: "manual", at: null });
  assert.equal(Alerts.resolve({ ...base, workAlerts: blank }).notificationAt, null);
  assert.deepEqual(Alerts.setEnabled(blank, "notification", true).notification, { enabled: true, mode: "alarm", at: null });
  assert.deepEqual(initial.notification, { enabled: true, mode: "alarm", at: null });
  const noWork = { ...base, scheduledStart: null, workAlerts: initial };
  assert.deepEqual(Alerts.resolve(noWork), { alarmAt: null, notificationAt: null, timeZone: "UTC" });
  assert.equal(Alerts.deliveries(noWork, { now }).alarm.status, "missing-time");
});

test("clearing the alarm turns only that channel off and leaves a linked notification waiting for a chosen time", () => {
  const task = configured();
  task.workAlerts = Alerts.editTime(task.workAlerts, "alarm", "");
  assert.deepEqual(task.workAlerts.alarm, { enabled: false, mode: "manual", at: null, sound: "system", snoozeMinutes: 5 });
  assert.deepEqual(task.workAlerts.notification, { enabled: true, mode: "alarm", at: null });
  assert.deepEqual(Alerts.resolve(task), { alarmAt: null, notificationAt: null, timeZone: "UTC" });
  const result = Alerts.validate(task, { now });
  assert.equal(result.alarm.status, "disabled"); assert.equal(result.notification.status, "missing-time");
  assert.equal(result.alarm.eligible, false); assert.equal(result.notification.eligible, false);
  assert.equal(task.scheduledStart, work); assert.equal(task.dueDate, base.dueDate);
  assert.throws(() => Alerts.normalize({ ...task.workAlerts, notification: { enabled: true, mode: "manual", at: null } }), error => error.field === "notificationAt" && error.code === "missing-time");
  const relinked = Alerts.follow(task.workAlerts, "alarm");
  assert.equal(relinked.alarm.enabled, false);
  assert.equal(Alerts.resolve(task, relinked).notificationAt, work);
});

test("legacy native alarms and ordinary notifications seed independent manual settings without inference", () => {
  const legacy = Alerts.preferences(base, {
    timeZone: zone, legacyAlarmAt: work, legacyNotificationAt: "2026-11-15T08:45", legacySound: "gentle", legacySnoozeMinutes: 10,
  });
  assert.equal(legacy.alarm.mode, "manual"); assert.equal(legacy.notification.mode, "manual");
  assert.equal(legacy.alarm.at, work); assert.equal(legacy.alarm.sound, "gentle"); assert.equal(legacy.alarm.snoozeMinutes, 10);
  assert.deepEqual(Alerts.resolve({ ...base, scheduledStart: "2026-11-16T10:00" }, legacy), { alarmAt: work, notificationAt: "2026-11-15T08:45", timeZone: "UTC" });
  const stored = { ...base, workAlerts: Alerts.setEnabled(legacy, "alarm", false) };
  assert.deepEqual(Alerts.preferences(stored, { timeZone: "America/New_York", legacyAlarmAt: "2026-11-17T12:00" }), stored.workAlerts);
  assert.deepEqual(Alerts.preferences({ ...base, workAlerts: null }, options), Alerts.defaults(options));
});

test("loading legacy work never activates alerts before an explicit preference save", () => {
  for (const channel of ["alarm", "notification"]) assert.equal(Alerts.deliveries(base, { now })[channel].status, "unconfigured");
  const saved = configured();
  const result = Alerts.deliveries(saved, { now });
  for (const channel of ["alarm", "notification"]) {
    assert.equal(result[channel].status, "ready");
    assert.equal(result[channel].eligible, true);
    assert.equal(result[channel].fireAt, Date.UTC(2026, 10, 15, 9));
  }
});

test("past linked work, completion, deletion and explicit disabled channels do not schedule or invent dates", () => {
  const past = configured({ ...base, scheduledStart: "2026-11-13T09:00" });
  assert.equal(Alerts.validate(past, { now }).alarm.status, "past");
  assert.equal(Alerts.deliveries({ ...configured(), completed: true }, { now }).notification.status, "completed");
  assert.equal(Alerts.deliveries({ ...configured(), deleted: true }, { now }).alarm.status, "deleted");
  assert.equal(Alerts.deliveries({ ...configured(), deleted_at: "2026-11-13" }, { now }).alarm.status, "deleted");
  const saved = configured();
  saved.workAlerts = Alerts.setEnabled(saved.workAlerts, "notification", false);
  assert.equal(Alerts.deliveries(saved, { now }).notification.status, "disabled");
  assert.equal(Alerts.deliveries(saved, { now }).alarm.eligible, true);
  assert.equal(past.dueDate, base.dueDate);
});

test("manual past or over-range times produce field-specific errors without blocking unrelated linked past work", () => {
  let prefs = Alerts.editTime(Alerts.defaults(options), "notification", "2026-11-13T09:00");
  assert.throws(() => Alerts.validate({ ...base, workAlerts: prefs }, { now }), error => error.field === "notificationAt" && error.code === "past");
  prefs = Alerts.editTime(Alerts.defaults(options), "alarm", "2026-11-13T09:00");
  prefs = Alerts.setEnabled(prefs, "alarm", false);
  assert.throws(() => Alerts.validate({ ...base, workAlerts: prefs }, { now }), error => error.field === "alarmAt" && error.code === "past");
  prefs = Alerts.setEnabled(prefs, "notification", false);
  assert.doesNotThrow(() => Alerts.validate({ ...base, workAlerts: prefs }, { now }));
  prefs = Alerts.editTime(Alerts.defaults(options), "notification", "2028-01-01T12:00");
  assert.throws(() => Alerts.validate({ ...base, workAlerts: prefs }, { now }), error => error.field === "notificationAt" && error.code === "too-far");
});

test("delivery uses the existing IANA-zone resolver for DST gaps, overlaps and UTC offsets", () => {
  const task = Alerts.forSave({ ...base, scheduledStart: "2026-03-08T02:30" }, { timeZone: "America/Los_Angeles" });
  const startOfYear = Date.UTC(2026, 0, 1);
  assert.equal(Alerts.deliveries(task, { now: startOfYear }).alarm.status, "nonexistent-wall-time");
  assert.doesNotThrow(() => Alerts.validate(task, { now: startOfYear }), "A linked work-time gap does not reject the task itself");
  task.workAlerts = Alerts.editTime(task.workAlerts, "alarm", "2026-03-08T02:30");
  assert.throws(() => Alerts.validate(task, { now: startOfYear }), error => error.field === "alarmAt" && error.code === "nonexistent-wall-time");
  task.workAlerts = Alerts.follow(task.workAlerts, "alarm"); task.scheduledStart = "2026-11-01T01:30";
  const overlap = Alerts.deliveries(task, { now: startOfYear });
  assert.equal(overlap.alarm.fireAt, Date.UTC(2026, 10, 1, 8, 30));
  assert.equal(overlap.alarm.ambiguousWallTime, true);
  assert.equal(overlap.notification.fireAt, overlap.alarm.fireAt);
});

test("five-second and 366-day delivery limits match the existing native/backend acceptance window", () => {
  const task = Alerts.forSave({ ...base, scheduledStart: "2027-01-02T00:00" }, options);
  const target = Date.UTC(2027, 0, 2);
  assert.equal(Alerts.deliveries(task, { now: target - 5000 }).alarm.status, "ready");
  assert.equal(Alerts.deliveries(task, { now: target - 4999 }).alarm.status, "too-soon");
  assert.equal(Alerts.deliveries(task, { now: target }).alarm.status, "past");
  assert.equal(Alerts.deliveries(task, { now: target - Alerts.MAX_AHEAD_MS }).alarm.status, "ready");
  assert.equal(Alerts.deliveries(task, { now: target - Alerts.MAX_AHEAD_MS - 1 }).alarm.status, "too-far");
});

test("preferences reject malformed values, invalid dates and unsupported timezone/settings without mutation", () => {
  const valid = Alerts.defaults(options), before = structuredClone(valid);
  for (const value of [[], { ...valid, version: 2 }, { ...valid, extra: true }, { ...valid, timeZone: "Mars/Olympus" },
    { ...valid, alarm: { ...valid.alarm, enabled: "true" } }, { ...valid, alarm: { ...valid.alarm, mode: "notification" } },
    { ...valid, alarm: { ...valid.alarm, sound: "other" } }, { ...valid, alarm: { ...valid.alarm, snoozeMinutes: 7 } },
    { ...valid, notification: { enabled: true, mode: "manual", at: null } },
    { ...valid, notification: { enabled: true, mode: "manual", at: "2026-02-30T12:00" } },
  ]) assert.throws(() => Alerts.normalize(value));
  for (const time of ["2026-02-29T12:00", "2026-13-01T12:00", "2026-11-15T24:00", "2026-11-15T12:60", "2026-11-15T12:00:00", "0000-01-01T12:00", "2026-1-01T12:00"]) assert.equal(Alerts.validWallTime(time), false);
  for (const time of ["2028-02-29T00:00", "2026-11-15T23:59", "0001-01-01T00:00"]) assert.equal(Alerts.validWallTime(time), true);
  assert.throws(() => Alerts.editTime(valid, "message", work));
  assert.throws(() => Alerts.setEnabled(valid, "alarm", "false"));
  assert.deepEqual(valid, before);
});

test("the resolver injection is deterministic and invalid clocks never schedule", () => {
  const task = configured(), calls = [];
  const resolved = Alerts.deliveries(task, { now: 10000, resolveWall(date, time, zone) { calls.push([date, time, zone]); return { ok: true, epoch: 20000 }; } });
  assert.deepEqual(calls, [["2026-11-15", "09:00", "UTC"], ["2026-11-15", "09:00", "UTC"]]);
  assert.equal(resolved.alarm.fireAt, 20000);
  assert.equal(resolved.notification.eligible, true);
  assert.equal(Alerts.deliveries(task, { now: NaN }).alarm.status, "invalid-evaluation-time");
});
