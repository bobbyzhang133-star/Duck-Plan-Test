const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Alerts = require("../landing/work-alerts.js");

const source = fs.readFileSync("landing/app.js", "utf8");
const hydration = source.match(/^function hydrateTaskAlertEditor\(.*\) \{[\s\S]*?^\}/m)?.[0];
const validation = source.match(/^function validateEditedTaskAlerts\(.*\) \{[\s\S]*?^\}/m)?.[0];
const change = source.match(/els\.form\.addEventListener\("change", event => \{[\s\S]*?^\}\);/m)?.[0];
const click = source.match(/els\.form\.addEventListener\("click", event => \{[\s\S]*?^\}\);/m)?.[0];
const submit = source.slice(source.indexOf('els.form.addEventListener("submit", async (event) => {'), source.indexOf('\nels.deleteTask.addEventListener("click"'));
assert.ok(hydration && validation && change && click && submit);
const future = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 16);
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const settle = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };

function fixture() {
  const work = future(4), legacyAlarm = future(2), legacyNotification = future(1), chosenAlarm = future(5);
  const values = { id: "legacy", title: "Legacy task", scheduledStart: work, dueDate: "", dueTime: "", durationMinutes: 45, completed: false };
  const formValues = { title: values.title, classId: "", priority: "Medium", dueDate: "", dueTime: "", scheduledDate: work.slice(0, 10), scheduledTime: work.slice(11), durationMinutes: "45", notes: "", reminderChoice: "off", actualMinutes: "", importance: "", urgency: "auto", alarmAt: work, notificationAt: work, alarmSound: "system", alarmSnooze: "5" };
  const elements = Object.fromEntries(Object.keys(formValues).map(name => [name, { get value() { return formValues[name]; }, set value(value) { formValues[name] = value; }, focus() {} }]));
  const listeners = {}, writes = [], notices = [], messages = new Map(), pending = deferred();
  let legacy = {}, renders = 0;
  const form = { elements, values: formValues, addEventListener(name, callback) { listeners[name] = callback; } };
  const context = vm.createContext({
    window: { DuckWorkAlerts: Alerts },
    document: { querySelector(selector) { if (!messages.has(selector)) messages.set(selector, { hidden: true, textContent: "" }); return messages.get(selector); } },
    els: { form, modal: { open: true }, saveTask: { disabled: false } },
    taskAlertPreferences: Alerts.preferences(values, { timeZone: "UTC" }),
    taskAlertEditorVersion: 1, plannerOwnerVersion: 10, modalClosing: false, taskAlertHydrationError: null,
    taskAlertHydration: Promise.resolve(), taskAlertTouchedFields: new Set(), taskAlertTimeChanges: new Set(),
    tasks: [values], editingTaskId: "legacy", pendingTaskDraft: null, taskReminderChoices: ["default", "off", "15", "60", "1440"],
    workAlerts: { refresh: () => pending.promise, preferences: task => Alerts.preferences(task, { timeZone: "UTC", ...legacy }) },
    taskAlertDraft: () => ({ scheduledStart: formValues.scheduledDate && formValues.scheduledTime ? `${formValues.scheduledDate}T${formValues.scheduledTime}` : null }),
    renderTaskAlertFields() { renders += 1; },
    FormData: class { constructor(form) { this.values = form.values; } get(name) { return this.values[name] ?? ""; } },
    async saveTaskWithAlerts(task) { writes.push(structuredClone(task)); return task; },
    closeModal() { context.els.modal.open = false; },
    showToast(message) { notices.push(message); },
  });
  for (const code of [hydration, validation, change, click, submit]) vm.runInContext(code, context);
  return {
    context, writes, notices, messages, formValues, values, work, legacyAlarm, legacyNotification, chosenAlarm, pending,
    renders: () => renders,
    begin() { context.taskAlertHydration = vm.runInContext('hydrateTaskAlertEditor(tasks[0], taskAlertEditorVersion, plannerOwnerVersion)', context); return context.taskAlertHydration; },
    loadLegacy() { legacy = { legacyAlarmAt: legacyAlarm, legacyNotificationAt: legacyNotification, legacySound: "gentle", legacySnoozeMinutes: 10 }; pending.resolve(); },
    edit(name, value) { formValues[name] = value; listeners.change({ target: { name, value, checked: value } }); },
    follow(channel) { listeners.click({ target: { closest: () => ({ dataset: { followAlert: channel } }) } }); },
    submit() { return listeners.submit({ preventDefault() {} }); },
  };
}

test("late legacy hydration preserves the edited alarm time and the untouched normal custom time", async () => {
  const f = fixture(), loading = f.begin();
  f.edit("alarmAt", f.chosenAlarm); f.loadLegacy(); await loading;
  const prefs = f.context.taskAlertPreferences;
  assert.equal(prefs.alarm.mode, "manual"); assert.equal(prefs.alarm.at, f.chosenAlarm);
  assert.equal(prefs.alarm.sound, "gentle"); assert.equal(prefs.alarm.snoozeMinutes, 10);
  assert.equal(prefs.notification.mode, "manual"); assert.equal(prefs.notification.at, f.legacyNotification);
});

test("sound-only and snooze-only edits retain that same channel's legacy manual time and other settings", async () => {
  for (const [name, value] of [["alarmSound", "bright"], ["alarmSnooze", "15"]]) {
    const f = fixture(), loading = f.begin();
    f.edit(name, value); f.loadLegacy(); await loading;
    const prefs = f.context.taskAlertPreferences;
    assert.equal(prefs.alarm.mode, "manual"); assert.equal(prefs.alarm.at, f.legacyAlarm);
    assert.equal(prefs.alarm.sound, name === "alarmSound" ? "bright" : "gentle");
    assert.equal(prefs.alarm.snoozeMinutes, name === "alarmSnooze" ? 15 : 10);
    assert.equal(prefs.notification.at, f.legacyNotification);
  }
});

test("an early switch edit preserves its same-channel legacy time and an explicit relink remains intentional", async () => {
  const f = fixture(), loading = f.begin();
  f.edit("notificationEnabled", false); f.edit("notificationEnabled", true); f.loadLegacy(); await loading;
  assert.equal(f.context.taskAlertPreferences.notification.enabled, true);
  assert.equal(f.context.taskAlertPreferences.notification.mode, "manual");
  assert.equal(f.context.taskAlertPreferences.notification.at, f.legacyNotification);
  const relink = fixture(), second = relink.begin();
  relink.edit("notificationAt", relink.chosenAlarm); relink.follow("notification"); relink.loadLegacy(); await second;
  assert.equal(relink.context.taskAlertPreferences.notification.mode, "alarm");
  assert.equal(relink.context.taskAlertPreferences.notification.at, null);
  assert.equal(Alerts.resolve(relink.values, relink.context.taskAlertPreferences).notificationAt, relink.legacyAlarm);
});

test("Save waits for captured hydration and builds its payload from the merged preferences and latest form fields once", async () => {
  const f = fixture(); f.begin(); f.edit("alarmAt", f.chosenAlarm);
  const save = f.submit(), duplicate = f.submit(); await settle();
  assert.equal(f.writes.length, 0); assert.equal(f.context.els.saveTask.disabled, true);
  f.formValues.title = "Edited title while loading";
  f.loadLegacy(); await Promise.all([save, duplicate]);
  assert.equal(f.writes.length, 1); const saved = f.writes[0];
  assert.equal(saved.title, f.formValues.title);
  assert.equal(saved.workAlerts.alarm.at, f.chosenAlarm);
  assert.equal(saved.workAlerts.notification.at, f.legacyNotification);
  assert.equal(saved.workAlerts.notification.mode, "manual");
  assert.equal(saved.dueDate, ""); assert.equal(saved.scheduledStart, f.work);
  assert.equal(f.notices.length, 1);
});

test("late hydration or Save cannot cross an editor close, a new editor or an owner change", async () => {
  for (const leave of [f => { f.context.els.modal.open = false; }, f => { f.context.taskAlertEditorVersion += 1; f.context.els.saveTask.disabled = false; }, f => { f.context.plannerOwnerVersion += 1; }]) {
    const f = fixture(); f.begin(); f.edit("alarmAt", f.chosenAlarm); const save = f.submit(); await settle();
    const before = structuredClone(f.context.taskAlertPreferences), renders = f.renders();
    leave(f); f.loadLegacy(); await save;
    assert.equal(f.writes.length, 0); assert.equal(f.notices.length, 0);
    assert.deepEqual(f.context.taskAlertPreferences, before); assert.equal(f.renders(), renders);
  }
});

test("a failed initial hydration prevents saving defaults over unknown legacy settings", async () => {
  const f = fixture(); f.begin();
  f.context.taskAlertHydration = f.context.taskAlertHydration.catch(error => { f.context.taskAlertHydrationError = error; });
  const save = f.submit(); f.pending.reject(new Error("Could not load existing alarms")); await save;
  assert.equal(f.writes.length, 0); assert.equal(f.context.els.saveTask.disabled, false);
  assert.match(f.messages.get("#task-alarm-save-error").textContent, /Couldn't load your saved alert settings/);
});
