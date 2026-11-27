const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("landing/task-editor.js", "utf8");
function fixture() {
  const events = {}, observers = [], microtasks = [], nodes = new Map();
  const elements = { dueDate: { value: "" }, dueTime: { value: "" }, scheduledDate: { value: "" }, scheduledTime: { value: "" }, scheduledEndDate: { value: "" }, scheduledEndTime: { value: "" }, durationMinutes: { value: "45" },
    classId: { selectedOptions: [{ textContent: "Calculus" }] }, priority: { value: "Medium" }, actualMinutes: { value: "" },
    alarmEnabled: { checked: true }, notificationEnabled: { checked: true } };
  const form = { elements, addEventListener(name, callback) { events[name] = callback; } }, modal = {};
  const section = () => ({ open: false, addEventListener() {}, querySelector() { return { setAttribute() {} }; } });
  const work = section(), deadline = section();
  const context = vm.createContext({ Date, window: {},
    Intl: { DateTimeFormat: function(_, options) { return new Intl.DateTimeFormat("en-US", options); } },
    queueMicrotask(callback) { microtasks.push(callback); },
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe(target, options) { observers.push({ target, options, callback: this.callback }); } },
    document: { querySelector: selector => selector === "#task-form" ? form : selector === "#task-schedule-options" ? work : selector === "#task-deadline-options" ? deadline : modal,
      getElementById(id) { if (!nodes.has(id)) nodes.set(id, { textContent: "" }); return nodes.get(id); } } });
  vm.runInContext(source, context);
  return { events, observers, microtasks, elements, form, modal, work, deadline, node: id => nodes.get(id), text: id => nodes.get(id).textContent };
}

test("editor summaries are read-only and distinguish unscheduled work and zero logged minutes", () => {
  const f = fixture(), before = JSON.stringify(f.elements);
  assert.equal(f.text("task-work-summary"), "Optional");
  assert.equal(f.text("task-work-label"), "Add work time");
  assert.equal(f.text("task-deadline-label"), "Add due date");
  assert.equal(f.text("task-detail-summary"), "Calculus · Medium");
  assert.equal(f.text("task-time-summary"), "No time logged");
  assert.equal(f.text("task-alert-summary"), "Alarm and notification");
  f.events.input(); assert.equal(JSON.stringify(f.elements), before);
  f.elements.actualMinutes.value = "0"; f.events.change(); assert.equal(f.text("task-time-summary"), "0 minutes logged");
});

test("work summaries show the start/end range without using the deadline", () => {
  const f = fixture(); Object.assign(f.elements.scheduledDate, { value: "2030-05-02" });
  f.events.input(); assert.equal(f.text("task-work-summary"), "May 2 · Choose a start time");
  f.elements.scheduledTime.value = "13:15"; f.events.input();
  assert.equal(f.text("task-work-summary"), "May 2 · 1:15 PM · Choose an end time");
  f.elements.scheduledEndDate.value = "2030-05-02"; f.elements.scheduledEndTime.value = "14:30"; f.events.input();
  assert.equal(f.text("task-work-summary"), "May 2 · 1:15 PM–2:30 PM");
  f.elements.scheduledEndDate.value = "2030-05-03"; f.elements.scheduledEndTime.value = "01:00"; f.events.input();
  assert.equal(f.text("task-work-summary"), "May 2 · 1:15 PM–May 3 · 1:00 AM");
  f.elements.scheduledDate.value = ""; f.events.input(); assert.equal(f.text("task-work-summary"), "Choose a work date");
});

test("late programmatic hydration refreshes alert summaries without changing saved preferences", () => {
  const f = fixture(), listener = f.observers.find(o => o.target === f.node("alarm-link-status"));
  f.elements.notificationEnabled.checked = false; listener.callback(); assert.equal(f.text("task-alert-summary"), "Alarm only");
  f.elements.alarmEnabled.checked = false; listener.callback(); assert.equal(f.text("task-alert-summary"), "Off");
  f.elements.notificationEnabled.checked = true; listener.callback(); assert.equal(f.text("task-alert-summary"), "Notification only");
  assert.equal(f.elements.alarmEnabled.checked, false);
});

test("reset summaries wait for the form's new values and labels remain plain text", () => {
  const f = fixture(); f.events.reset();
  f.elements.classId.selectedOptions = [{ textContent: '<img src=x onerror="bad()">' }];f.elements.priority.value = "High";
  f.microtasks.shift()(); assert.equal(f.text("task-detail-summary"), '<img src=x onerror="bad()"> · High');
  assert.equal(f.node("task-detail-summary").innerHTML, undefined);
  f.elements.classId.selectedOptions = [];f.events.change();assert.equal(f.text("task-detail-summary"), "No class · High");
});

test("optional timing labels follow each section independently without inventing dates", () => {
  const f = fixture(); f.work.open = true; f.events.input();
  assert.equal(f.text("task-work-label"), "Work time"); assert.equal(f.text("task-deadline-label"), "Add due date");
  assert.equal(f.elements.scheduledDate.value, ""); assert.equal(f.elements.dueDate.value, "");
  f.elements.dueDate.value = "2030-05-02"; f.events.change();
  assert.equal(f.text("task-deadline-label"), "Due date"); assert.equal(f.text("task-deadline-summary"), "2030-05-02 · End of day");
  f.elements.dueTime.value = "16:15"; f.events.change(); assert.equal(f.text("task-deadline-summary"), "2030-05-02 · 16:15");
  f.work.open = false; f.events.input(); assert.equal(f.text("task-work-label"), "Add work time");
});
