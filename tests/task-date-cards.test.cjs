const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Model = require("../landing/planner-model.js");

const source = fs.readFileSync("landing/app.js", "utf8");
const functions = ["formatShortDate", "formatTime", "taskScheduleText", "taskCardDateText", "taskDateIcon", "taskDateMarkup", "taskRescheduleMarkup", "priorityBadge", "taskStatusTone", "taskCardMarkup", "allTaskMarkup"]
  .map(name => source.match(new RegExp(`^function ${name}\\(.*\\) \\{[\\s\\S]*?^\\}`, "m"))?.[0]);
assert.ok(functions.every(Boolean), "Exercise the actual shared app card/date functions");
const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const task = (values = {}) => ({ id: "assignment", title: "Practice set", classId: "calculus", priority: "Medium", dueDate: "2026-11-20", dueTime: "17:00", scheduledStart: "2026-11-20T07:45", durationMinutes: 45, completed: false, ...values });
function fixture({ now = "2026-11-20T12:00", selectedDate = "2026-11-21", selectedTaskId = null, className = "Calculus" } = {}) {
  let reference = now;
  const context = vm.createContext({
    Model: { ...Model, taskTiming: value => Model.taskTiming(value, reference) },
    nowKey: () => reference.slice(0, 10), selectedDate, selectedTaskId,
    dateObject: Model.fromDateKey, safeText: escape, safeAttribute: escape,
    classInfo: () => ({ name: className, color: "#538fc5", soft: "#e3eef7" }),
    Intl: { DateTimeFormat: function (_locale, options) { return new Intl.DateTimeFormat("en-US", options); } }, Date,
  });
  vm.runInContext(functions.join("\n"), context);
  return { date: context.taskDateMarkup, card: context.taskCardMarkup, all: context.allTaskMarkup,
    setNow(value) { reference = value; } };
}
function assertNoNestedButtons(html) {
  let depth = 0;
  for (const match of html.matchAll(/<\/?button\b[^>]*>/g)) {
    if (match[0].startsWith("</")) depth -= 1;
    else { assert.equal(depth, 0); depth += 1; }
  }
  assert.equal(depth, 0);
}

test("task dates present calendar Due and clock Work rows with weekday/date and actual Today range", () => {
  const html = fixture().date(task());
  assert.match(html, /task-date-line task-date-due/); assert.match(html, /task-date-label">Due</);
  assert.match(html, /task-date-line task-date-work/); assert.match(html, /task-date-label">Work</);
  assert.match(html, /Fri, Nov 20 · 5:00 PM/); assert.match(html, /Today · 7:45 AM–8:30 AM/);
  assert.equal((html.match(/class="task-date-icon" aria-hidden="true" focusable="false"/g) || []).length, 2);
  assert.doesNotMatch(html, /task-overdue-label|task-plan-warning/);
});

test("a future selected day never becomes Today and cross-year card dates include their year", () => {
  const f = fixture({ selectedDate: "2026-11-21" });
  const future = f.date(task({ dueDate: "2027-01-02", scheduledStart: "2026-11-21T09:00" }));
  assert.match(future, /Sat, Jan 2, 2027/); assert.match(future, /Sat, Nov 21 · 9:00 AM–9:45 AM/);
  assert.doesNotMatch(future, /Today/);
  const today = f.date(task()); assert.match(today, /Today ·/); assert.doesNotMatch(today, /Nov 20, 2026/);
});

test("a due-only task omits an empty Work row while the inbox and Tasks-column fallback remain explicit", () => {
  const f = fixture();
  const dateOnly = f.date(task({ dueTime: "", scheduledStart: null }));
  assert.match(dateOnly, /Fri, Nov 20 · End of day/); assert.doesNotMatch(dateOnly, /task-date-work|Not scheduled/);
  assert.match(dateOnly, /class="task-date-line task-date-due" data-has-deadline/);
  const timedDueOnly = f.date(task({ scheduledStart: null }));
  assert.match(timedDueOnly, /5:00 PM/); assert.doesNotMatch(timedDueOnly, /task-date-work/);
  const inbox = f.date(task({ dueDate: "", dueTime: "", scheduledStart: null }));
  assert.match(inbox, /No deadline/); assert.match(inbox, /task-date-work/); assert.match(inbox, /Not scheduled/);
  assert.doesNotMatch(inbox, /data-has-deadline/);
  const externalDue = f.date(task({ scheduledStart: null }), { showDue: false });
  assert.doesNotMatch(externalDue, /task-date-due/); assert.match(externalDue, /task-date-work/); assert.match(externalDue, /Not scheduled/);
});

test("actual due time controls Past deadline styling independently from selected date and work-after-deadline warning", () => {
  const f = fixture({ selectedDate: "2026-11-19" });
  const overdue = task({ dueTime: "11:59", scheduledStart: "2026-11-20T10:00" });
  const before = structuredClone(overdue), card = f.card(overdue);
  assert.match(card, /daily-task-card[^\"]* is-overdue/); assert.match(card, /Past deadline/);
  assert.doesNotMatch(card, /is-work-after-deadline|Work after deadline|task-reschedule/);
  assert.match(card, /task-status-icon" aria-hidden="true"/);
  f.setNow("2026-11-20T11:59"); assert.doesNotMatch(f.card(overdue), /is-overdue|Past deadline/);
  const lateWork = f.card(task({ dueTime: "17:00", scheduledStart: "2026-11-20T16:45", durationMinutes: 45 }));
  assert.match(lateWork, /is-work-after-deadline/); assert.match(lateWork, /Work after deadline/);
  assert.match(lateWork, /data-reschedule-task="assignment"/); assert.doesNotMatch(lateWork, /is-overdue|Past deadline/);
  assert.deepEqual(overdue, before);
});

test("overnight work retains its ending date and precise full-session deadline comparison", () => {
  const f = fixture(), value = task({ dueDate: "2026-11-21", dueTime: "00:30", scheduledStart: "2026-11-20T23:30", durationMinutes: 90 });
  const before = structuredClone(value), html = f.card(value);
  assert.match(html, /Today · 11:30 PM–1:00 AM \(Nov 21\)/);
  assert.match(html, /Sat, Nov 21 · 12:30 AM/); assert.match(html, /Work after deadline/);
  assert.doesNotMatch(html, /Past deadline/); assert.deepEqual(value, before);
});

test("completed cards retain dates and logged zero minutes but suppress urgency and active drag controls", () => {
  const value = task({ completed: true, dueDate: "2026-11-19", scheduledStart: "2026-11-20T16:45", actualMinutes: 0, priority: "High" });
  for (const render of [fixture().card, fixture().all]) {
    const html = render(value);
    assert.match(html, /completed/); assert.match(html, /priority-high">High</); assert.match(html, /0 min spent/);
    assert.match(html, /task-date-work/); assert.doesNotMatch(html, /is-overdue|is-work-after-deadline|Past deadline|Work after deadline|data-reschedule-task|\bdraggable=|\bdata-drag-task=/);
  }
});

test("All Tasks keeps one separate Due column, one Work row and its existing edit/check/drag affordances", () => {
  const f = fixture(), value = task({ actualMinutes: 0, axisMissing: true }), before = structuredClone(value), html = f.all(value);
  assert.equal((html.match(/class="task-due"/g) || []).length, 1); assert.doesNotMatch(html, /task-date-due/);
  assert.match(html, /class="task-due" data-has-deadline/);
  assert.doesNotMatch(f.all(task({ dueDate: "" })), /data-has-deadline/);
  assert.equal((html.match(/task-date-line task-date-work/g) || []).length, 1);
  assert.match(html, /data-task-id="assignment"/); assert.match(html, /data-edit-task="assignment"/);
  assert.match(html, /draggable="true" data-drag-task="assignment"/); assert.match(html, /class="course-dot"/);
  assert.match(html, /priority-medium">Medium</); assert.match(html, /0 min spent/); assert.match(html, /No longer in Axis/);
  assertNoNestedButtons(html); assert.deepEqual(value, before);
});

test("card text and exact task ids stay escaped, including warning/reschedule controls", () => {
  const id = 'x" onclick="bad', value = task({ id, title: '<img src=x onerror="bad">', dueTime: "11:00", scheduledStart: "2026-11-20T11:30" });
  const f = fixture({ selectedTaskId: id, className: '<script>class</script>' }), before = structuredClone(value);
  for (const render of [f.card, f.all]) {
    const html = render(value);
    assert.match(html, /data-task-id="x&quot; onclick=&quot;bad"/); assert.match(html, /data-edit-task="x&quot; onclick=&quot;bad"/);
    assert.match(html, /data-reschedule-task="x&quot; onclick=&quot;bad"/);
    assert.match(html, /&lt;img src=x onerror=&quot;bad&quot;&gt;/); assert.match(html, /&lt;script&gt;class&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<img|<script>| onclick="bad/); assertNoNestedButtons(html);
  }
  assert.deepEqual(value, before);
});

test("malformed legacy deadline display does not invent a time or normalize an invalid date into another day", () => {
  const html = fixture().date(task({ dueDate: "2026-02-30", dueTime: "25:99", scheduledStart: null }));
  assert.match(html, /Date unavailable · Time unavailable/); assert.doesNotMatch(html, /Mar 2|Today/);
});
