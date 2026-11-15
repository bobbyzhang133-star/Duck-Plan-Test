const test = require("node:test");
const assert = require("node:assert/strict");
const Presentation = require("../landing/calendar-date-presentation.js");
const Model = require("../landing/planner-model.js");

function setup(selectedTaskId = null) {
  const model = { ...Model, taskTiming: task => ({ overdue: Boolean(!task.completed && task.dueDate < "2030-05-02"), plannedAfterDeadline: task.id === "late-work" }) };
  return Presentation.create({ model, classInfo: () => ({ name: "Calculus", color: "#538fc5", soft: "#e3eef7" }),
    formatTime: time => time, formatLongDate: date => date, nowKey: () => "2030-05-02", selectedTaskId: () => selectedTaskId });
}
function task(id, changes = {}) {
  return { id, title: `Task ${id}`, dueDate: "2030-05-02", dueTime: "12:00", durationMinutes: 45, completed: false, scheduledStart: null, ...changes };
}
function assertNoNestedButtons(html) {
  let depth = 0;
  for (const match of html.matchAll(/<\/?button\b[^>]*>/g)) {
    if (match[0].startsWith("</")) depth -= 1;
    else { assert.equal(depth, 0, "an interactive task must not be nested inside a date button"); depth += 1; }
    assert.ok(depth >= 0);
  }
  assert.equal(depth, 0);
}

test("deadline strip orders precise times and exposes all overflow without creating calendar navigation ancestors", () => {
  const ui = setup("early");
  const tasks = [task("all-day", { dueTime: "" }), task("late", { dueTime: "20:00" }), task("early", { dueTime: "08:30" }), task("middle"), task("completed", { completed: true })];
  const before = structuredClone(tasks);
  const collapsed = ui.deadlineChips(tasks, "2030-05-02");
  assert.deepEqual([...collapsed.matchAll(/data-edit-task="([^"]+)"/g)].map(match => match[1]), ["early", "middle", "late"]);
  assert.match(collapsed, /data-deadline-overflow="2030-05-02" aria-expanded="false"/);
  assert.match(collapsed, /Show 1 more deadline for 2030-05-02/);
  assert.match(collapsed, /\+1 more/);
  assert.match(collapsed, /class="deadline-chip calendar-deadline-marker selected"/);
  assert.doesNotMatch(collapsed, /\bdata-date=/);
  assert.doesNotMatch(collapsed, /data-calendar-drag-task=/);
  const expanded = ui.deadlineChips(tasks, "2030-05-02", { expanded: true });
  assert.deepEqual([...expanded.matchAll(/data-edit-task="([^"]+)"/g)].map(match => match[1]), ["early", "middle", "late", "all-day"]);
  assert.match(expanded, /End of day/);
  assert.match(expanded, /aria-expanded="true"/);
  assert.match(expanded, /Show fewer/);
  assertNoNestedButtons(expanded);
  assert.deepEqual(tasks, before, "presentation must not rewrite task data");
});

test("deadline warnings use text and icon semantics, exclude deleted/completed tasks, and escape attributes", () => {
  const ui = setup();
  const html = ui.deadlineChips([task('x" onclick="bad', { title: '<img src=x onerror="bad">', dueDate: "2030-05-01" }), task("done", { dueDate: "2030-05-01", completed: true }), task("deleted", { dueDate: "2030-05-01", deleted: true })], "2030-05-01");
  assert.match(html, /is-overdue/);
  assert.match(html, /Overdue/);
  assert.match(html, /aria-label="Deadline:/);
  assert.match(html, /data-calendar-kind="deadline"/);
  assert.match(html, /&lt;img src=x onerror=&quot;bad&quot;&gt;/);
  assert.match(html, /data-edit-task="x&quot; onclick=&quot;bad"/);
  assert.doesNotMatch(html, /<img| onclick="bad|data-edit-task="done"|data-edit-task="deleted"/);
  assert.equal(ui.deadlineChips([], "2030-05-01"), "");
});

test("Month represents one task's work and deadline as separate occurrences while reporting one task", () => {
  const ui = setup();
  const tasks = [task("same", { scheduledStart: "2030-05-02T09:00", dueTime: "15:00" })];
  const html = ui.month(tasks, ["2030-05-02"], "2030-05-02");
  assert.match(html, /1 deadline · 1 work session, 1 task/);
  const entries = html.slice(html.indexOf('<div class="month-entries">'), html.indexOf('<small class="month-entry-counts">'));
  assert.equal((entries.match(/data-edit-task="same"/g) || []).length, 2);
  assert.match(entries, /data-calendar-kind="deadline"/);
  assert.match(entries, /data-calendar-kind="work"/);
  assert.match(html, /aria-current="date"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /<div class="month-day selected today" data-date="2030-05-02">/);
  assertNoNestedButtons(html);
});

test("Month overflow points at its own day, compact markers count all entries, and selected-day agenda includes the full title", () => {
  const ui = setup();
  const tasks = Array.from({ length: 5 }, (_, index) => task(String(index), { title: `Long full assignment title number ${index}`, scheduledStart: index < 2 ? `2030-05-02T${10 + index}:00` : null }));
  const before = structuredClone(tasks);
  const html = ui.month(tasks, ["2030-05-01", "2030-05-02"], "2030-05-02");
  assert.match(html, /data-calendar-open-day="2030-05-02"/);
  assert.match(html, /\+4 more/);
  assert.match(html, /5 deadlines · 2 work sessions, 5 tasks/);
  const agenda = html.slice(html.indexOf('<section class="month-selected-agenda"'));
  for (const item of tasks) assert.ok(agenda.includes(item.title));
  assert.equal((agenda.match(/data-calendar-kind="deadline"/g) || []).length, 5);
  assert.equal((agenda.match(/data-calendar-kind="work"/g) || []).length, 2);
  assertNoNestedButtons(html);
  assert.deepEqual(tasks, before);
});

test("selected-day agenda separates work from deadlines and reflects work ending after its deadline", () => {
  const ui = setup();
  const html = ui.agenda([task("late-work", { scheduledStart: "2030-05-02T11:45" }), task("done", { completed: true })], "2030-05-02");
  assert.match(html, /1 work session/);
  assert.match(html, /2 deadlines/);
  assert.match(html, /Work ends after deadline/);
  assert.match(html, /data-edit-task="done"/);
  assert.match(html, /✓ Completed/);
  assertNoNestedButtons(html);
  assert.match(ui.agenda([], "2030-05-02"), /No work sessions or deadlines for this day/);
});

test("presentation rejects unsafe class color text without changing valid calendar class colors", () => {
  const taskValue = task("a");
  assert.match(setup().deadlineChips([taskValue], taskValue.dueDate), /--course-color:#538fc5;--course-soft:#e3eef7/);
  const ui = Presentation.create({ classInfo: () => ({ color: 'red;" onclick="bad', soft: "url(javascript:bad)" }), nowKey: () => "2030-05-02" });
  const html = ui.deadlineChips([taskValue], taskValue.dueDate);
  assert.match(html, /--course-color:#8f8a7d;--course-soft:#efede7/);
  assert.doesNotMatch(html, /onclick|javascript/);
});

test("completed Month work and deadlines remain visible and counted once per task without urgency warnings", () => {
  const ui = setup();
  const completed = task("late-work", { completed: true, dueDate: "2030-05-01", scheduledStart: "2030-05-01T13:00" });
  const deleted = task("deleted", { completed: true, dueDate: "2030-05-01", scheduledStart: "2030-05-01T13:00", deleted: true });
  const html = ui.month([completed, deleted], ["2030-05-01"], "2030-05-01");
  assert.match(html, /1 deadline · 1 work session, 1 task/);
  const entries = html.slice(html.indexOf('<div class="month-entries">'), html.indexOf('<small class="month-entry-counts">'));
  assert.equal((entries.match(/data-edit-task="late-work"/g) || []).length, 2);
  assert.equal((entries.match(/is-completed/g) || []).length, 2);
  assert.equal((entries.match(/✓ Completed/g) || []).length, 2);
  assert.match(entries, /aria-label="Completed\. Deadline:/);
  assert.match(entries, /aria-label="Completed\. Work session:/);
  const agenda = ui.agenda([completed, deleted], "2030-05-01");
  assert.equal((agenda.match(/is-completed/g) || []).length, 2);
  assert.equal((agenda.match(/✓ Completed/g) || []).length, 2);
  assert.doesNotMatch(html + agenda, /is-overdue|calendar-agenda-warning|Work ends after|data-edit-task="deleted"/);
  assert.equal(ui.deadlineChips([completed], "2030-05-01"), "", "Day/Week deadline strip still contains unfinished tasks only");
  assertNoNestedButtons(html);
});

test("completed Month occurrences cannot hide unfinished work within the three-item preview", () => {
  const ui = setup();
  const tasks = [task("done-a", { completed: true }), task("done-b", { completed: true }),
    ...[1, 2, 3].map(index => task(`active-${index}`, { dueDate: "2030-05-03", scheduledStart: `2030-05-02T1${index}:00` }))];
  const html = ui.month(tasks, ["2030-05-02"], "2030-05-02");
  const entries = html.slice(html.indexOf('<div class="month-entries">'), html.indexOf('<small class="month-entry-counts">'));
  assert.deepEqual([...entries.matchAll(/data-edit-task="([^"]+)"/g)].map(match => match[1]), ["active-1", "active-2", "active-3"]);
  assert.match(entries, /\+2 more/);
  assert.match(html, /2 deadlines · 3 work sessions, 5 tasks/);
});
