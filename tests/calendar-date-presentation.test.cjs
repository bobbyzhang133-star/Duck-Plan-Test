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

test("the date-only band starts folded with accurate per-day counts and an accessible whole-row toggle", () => {
  const tasks = [task("one", { dueTime: null }), task("two", { dueTime: "" }), task("timed"),
    task("completed", { dueTime: null, completed: true }), task("deleted", { dueTime: null, deleted: true }),
    task("next", { dueDate: "2030-05-03", dueTime: null })];
  const before = structuredClone(tasks), ui = setup();
  const html = ui.deadlineRow(tasks, ["2030-05-02", "2030-05-03"]);
  assert.match(html, /aria-expanded="false" aria-controls="calendar-date-only-deadlines" aria-label="Expand 3 date-only deadlines"/);
  assert.match(html, />2 due</); assert.match(html, />1 due</);
  assert.doesNotMatch(html, /data-select-task|deadline-chip-list/);
  assertNoNestedButtons(html);
  assert.deepEqual(tasks, before);
});

test("expanding the whole Due row retains per-day overflow and keeps timed deadlines out", () => {
  const tasks = Array.from({ length: 5 }, (_, n) => task(`date-${n}`, { dueTime: null }));
  tasks.push(task("timed"));
  const ui = setup(), dates = ["2030-05-02"];
  const expanded = ui.deadlineRow(tasks, dates, { expanded: true });
  assert.match(expanded, /aria-label="Collapse 5 date-only deadlines"/);
  assert.equal((expanded.match(/data-select-task=/g) || []).length, 3);
  assert.match(expanded, /\+2 more/);
  assert.doesNotMatch(expanded, /data-select-task="timed"/);
  const all = ui.deadlineRow(tasks, dates, { expanded: true, expandedDates: new Set(dates) });
  assert.equal((all.match(/data-select-task=/g) || []).length, 5);
  assert.match(all, /Show fewer/); assertNoNestedButtons(all);
  assert.equal(ui.deadlineRow([task("timed")], dates), "");
  assert.equal(ui.deadlineRow([], dates), "");
});

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

test("date-only strip option removes timed milestones while retaining undated-time and invalid legacy fallbacks", () => {
  const ui = Presentation.create({ formatTime: value => { assert.match(value, /^([01]\d|2[0-3]):[0-5]\d$/); return value; } });
  const tasks = [task("timed"), task("date-only", { dueTime: "" }), task("invalid-time", { dueTime: "25:70" })];
  const defaultHtml = ui.deadlineChips(tasks, "2030-05-02", { expanded: true });
  assert.match(defaultHtml, /data-edit-task="timed"/);
  const dateOnly = ui.deadlineChips(tasks, "2030-05-02", { dateOnly: true });
  assert.doesNotMatch(dateOnly, /data-edit-task="timed"/);
  assert.match(dateOnly, /data-edit-task="date-only"/); assert.match(dateOnly, /End of day/);
  assert.match(dateOnly, /data-edit-task="invalid-time"/); assert.match(dateOnly, /Time unavailable/);
});

test("timed deadline groups use only explicit valid active deadlines without deriving work sessions or end-of-day markers", () => {
  const ui = setup();
  const tasks = [task("timed", { dueTime: "17:00", scheduledStart: "2030-05-01T09:00" }),
    task("date-only", { dueTime: "" }), task("done", { completed: true }), task("deleted", { deleted_at: "2030-05-02" }),
    task("invalid-hour", { dueTime: "24:00" }), task("invalid-minute", { dueTime: "12:60" }), task("invalid-shape", { dueTime: "9:00" }),
    task("different-date", { dueDate: "2030-05-03" }), task("work-only", { dueDate: "", dueTime: "", scheduledStart: "2030-05-02T15:00" })];
  const before = structuredClone(tasks), groups = ui.timedDeadlineGroups(tasks, "2030-05-02");
  assert.deepEqual(groups.flatMap(group => group.tasks.map(item => item.id)), ["timed"]);
  assert.equal(groups[0].minutes, 17 * 60); assert.equal(groups[0].key, "2030-05-02-1020");
  assert.deepEqual(tasks, before, "presentation must not modify deadline, work or alert fields");
  assert.deepEqual(ui.timedDeadlineGroups([task("bad-date", { dueDate: "2030-02-30" })], "2030-02-30"), []);
});

test("midnight and late-night diamonds stay at their exact minute while only label boxes clamp inside the day", () => {
  const ui = setup(), groups = ui.timedDeadlineGroups([task("midnight", { dueTime: "00:00" }), task("late", { dueTime: "23:59" })], "2030-05-02");
  assert.equal(groups.length, 2);
  assert.equal(groups[0].markerTop, 0); assert.equal(groups[0].top, 0); assert.equal(groups[0].height, 44);
  assert.equal(groups[0].dayHeight, 24 * 62);
  assert.match(ui.timedDeadlineMarker(groups[0]), /timed-deadline-point is-day-start/);
  const last = groups[1]; assert.equal(last.top, 24 * 62 - 44);
  assert.equal(last.entries[0].minutes, 1439); assert.equal(last.markerTop, 1439 * 62 / 60);
  assert.equal(last.bottom, Math.min(last.dayHeight, Math.max(last.top + last.height, last.markerTop + 5)));
  assert.ok(groups.every(group => group.top >= 0 && group.top + group.height <= 24 * 62));
  const html = ui.timedDeadlineMarker(last);
  assert.match(html, /timed-deadline-point is-day-end/);
  assert.match(html, new RegExp(`style="top:${last.markerTop - last.top}px" aria-hidden="true"`));
  assert.match(html, /timed-deadline-time">23:59</);
});

test("nearby deadline groups use one fixed label box and do not chain an entire morning transitively", () => {
  const ui = setup();
  const tasks = ["10:00", "10:30", "11:00", "11:30", "12:00"].map((dueTime, index) => task(String(index), { dueTime }));
  const groups = ui.timedDeadlineGroups(tasks, "2030-05-02");
  assert.deepEqual(groups.map(group => group.tasks.map(item => item.id)), [["0", "1"], ["2", "3"], ["4"]]);
  assert.deepEqual(groups.flatMap(group => group.entries.map(entry => entry.minutes)), [600, 630, 660, 690, 720]);
  for (let index = 1; index < groups.length; index += 1) assert.ok(groups[index].top >= groups[index - 1].top + 44 + 4);
  const edge = ui.timedDeadlineGroups([task("start", { dueTime: "00:00" }), task("near-edge", { dueTime: "00:43" })], "2030-05-02");
  assert.equal(edge.length, 1, "clamped edge label boxes may overlap even when raw anchors are over44px apart");
  assert.equal(edge[0].entries[1].markerTop, 43 * 62 / 60);
});

test("same-instant and nearby late-night group hit spans stay inside the day without moving their timestamp anchors", () => {
  const ui = setup();
  for (const times of [["23:59", "23:59"], ["23:30", "23:59"]]) {
    const tasks = times.map((dueTime, index) => task(`late-${index}`, { dueTime }));
    const before = structuredClone(tasks), groups = ui.timedDeadlineGroups(tasks, "2030-05-02");
    assert.equal(groups.length, 1); const group = groups[0];
    assert.equal(group.bottom, group.dayHeight); assert.ok(group.bottom >= group.top + group.height);
    assert.deepEqual(group.entries.map(entry => entry.markerTop), times.map(time => Model.minutesFromTime(time) * 62 / 60));
    const html = ui.timedDeadlineMarker(group);
    assert.match(html, /timed-deadline-group-trigger/);
    const span = html.match(/class="timed-deadline-anchor[^\"]*"[^>]*style="top:([\d.]+)px;height:([\d.]+)px"/);
    assert.ok(span); assert.equal(Number(span[1]) + Number(span[2]), group.dayHeight);
    assert.match(html, /timed-deadline-point is-day-end/); assert.deepEqual(tasks, before);
  }
});

test("timed milestone geometry follows the supplied hour scale and safe label-height defaults", () => {
  const ui = setup();
  const group = ui.timedDeadlineGroups([task("scaled", { dueTime: "10:00" })], "2030-05-02", { hourHeight: 120, markerHeight: 30 })[0];
  assert.equal(group.markerTop, 1200); assert.equal(group.top, 1185); assert.equal(group.height, 30);
  const fallback = ui.timedDeadlineGroups([task("default", { dueTime: "10:00" })], "2030-05-02", { hourHeight: NaN, markerHeight: -1 })[0];
  assert.equal(fallback.markerTop, 620); assert.equal(fallback.height, 44);
});

test("single timed milestone keeps deadline preview semantics, selected state and escaped text without work drag behavior", () => {
  const id = 'x" onclick="bad', ui = setup(id);
  const group = ui.timedDeadlineGroups([task(id, { title: '<img src=x onerror="bad">', dueTime: "09:00", dueDate: "2030-05-01" })], "2030-05-01")[0];
  const html = ui.timedDeadlineMarker(group, { overlapsWork: true });
  assert.match(html, /timed-deadline-anchor has-work-overlap/); assert.match(html, /data-overlaps-work="true"/);
  assert.match(html, /class="timed-deadline-marker is-overdue selected"/);
  assert.match(html, /data-calendar-kind="deadline"/); assert.match(html, /data-edit-task="x&quot; onclick=&quot;bad"/);
  assert.match(html, /timed-deadline-kind">Deadline</); assert.match(html, /timed-deadline-time">09:00</); assert.match(html, /Overdue/);
  assert.match(html, /&lt;img src=x onerror=&quot;bad&quot;&gt;/);
  assert.doesNotMatch(html, /<img| onclick="bad|data-calendar-drag-task|\bdraggable=|\bdata-date=|data-timed-deadline-group=/);
  assertNoNestedButtons(html);
});

test("same-instant deadlines retain every task, render one counted pin and open a bounded nearby-time group", () => {
  const ui = setup(), tasks = [task("b", { title: "Same title", dueTime: "17:00" }), task("a", { title: "Same title", dueTime: "17:00" }), task("nearby", { dueTime: "17:05" })];
  const before = structuredClone(tasks), groups = ui.timedDeadlineGroups(tasks, "2030-05-02");
  assert.equal(groups.length, 1); assert.deepEqual(groups[0].tasks.map(item => item.id), ["a", "b", "nearby"]);
  const html = ui.timedDeadlineMarker(groups[0]);
  assert.equal((html.match(/class="timed-deadline-point"/g) || []).length, 2);
  assert.match(html, /timed-deadline-point-count">2</); assert.match(html, /timed-deadline-kind">Deadlines</); assert.match(html, /timed-deadline-count">3</); assert.match(html, /17:00–17:05/);
  assert.match(html, /data-timed-deadline-group="2030-05-02-1020" data-deadline-date="2030-05-02" aria-haspopup="dialog" aria-expanded="false"/);
  assert.doesNotMatch(html, /data-select-task|data-edit-task|data-calendar-drag-task|\bdata-date=/);
  assertNoNestedButtons(html); assert.deepEqual(tasks, before);
  assert.equal(ui.timedDeadlineMarker(null), "");
});
