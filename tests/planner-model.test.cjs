const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const Model = require("../landing/planner-model.js");

test("date keys stay in local calendar time", () => {
  const date = new Date(2026, 9, 28, 23, 45);
  assert.equal(Model.toDateKey(date), "2026-10-28");
  assert.equal(Model.addDays("2026-10-31", 1), "2026-11-01");
});

test("legacy deadlines are preserved without inventing schedules", () => {
  const [task] = Model.migrateTasks([{ id: "legacy", title: "Essay", dueDate: "2026-10-30", dueTime: "15:30" }]);
  assert.equal(task.dueDate, "2026-10-30");
  assert.equal(task.dueTime, "15:30");
  assert.equal(task.scheduledStart, null);
  assert.equal(task.durationMinutes, 45);
  assert.equal(task.schemaVersion, 2);
});

test("daily groups keep scheduled and deadline-only work separate", () => {
  const tasks = Model.migrateTasks([
    { id: "scheduled", title: "Study", dueDate: "2026-10-30", scheduledStart: "2026-10-28T14:00", completed: false },
    { id: "unscheduled", title: "Submit", dueDate: "2026-10-28", dueTime: "17:00", completed: false },
    { id: "overdue", title: "Late", dueDate: "2026-10-27", completed: false },
    { id: "done", title: "Done", dueDate: "2026-10-28", completed: true },
  ]);
  const groups = Model.groupForDate(tasks, "2026-10-28", "2026-10-28");
  assert.deepEqual(groups.scheduled.map((task) => task.id), ["scheduled"]);
  assert.deepEqual(groups.unscheduled.map((task) => task.id), ["unscheduled"]);
  assert.deepEqual(groups.overdue.map((task) => task.id), ["overdue"]);
  assert.deepEqual(groups.completed.map((task) => task.id), ["done"]);
});

test("the backlog makes undated unfinished copies available on any day without changing daily progress groups", () => {
  const daily = [
    { id: "scheduled", dueDate: "2026-11-15", scheduledStart: "2026-11-14T09:00", completed: false },
    { id: "due-today", dueDate: "2026-11-14", dueTime: "17:00", completed: false },
    { id: "overdue", dueDate: "2026-11-13", completed: false },
    { id: "done-today", dueDate: "2026-11-14", completed: true },
  ];
  const input = [
    ...daily,
    { id: "template-copy", title: "BC Calculus", dueDate: "", dueTime: "", scheduledStart: null, durationMinutes: 45, completed: false },
    { id: "old-copy", title: "Previously added copy", completed: false },
    { id: "null-date-copy", dueDate: null, scheduledStart: null, completed: false },
    { id: "later-deadline", dueDate: "2026-11-16", scheduledStart: null, completed: false },
    { id: "later-scheduled", dueDate: "", scheduledStart: "2026-11-15T23:00", completed: false },
    { id: "completed-copy", dueDate: "", scheduledStart: null, completed: true },
  ];
  const before = structuredClone(input);
  const tasks = Object.freeze(input.map(task => Object.freeze(task)));
  for (const selectedDate of ["2026-11-14", "2026-11-15", "2027-01-01"]) {
    const groups = Model.groupForDate(tasks, selectedDate, "2026-11-14");
    assert.deepEqual(groups.backlog.map(task => task.id), ["template-copy", "old-copy", "null-date-copy"]);
    const expected = Model.groupForDate(tasks.filter(task => task.dueDate || task.scheduledStart), selectedDate, "2026-11-14");
    for (const name of ["overdue", "scheduled", "unscheduled", "completed"]) {
      assert.deepEqual(groups[name], expected[name], `${name} still contains only its date-related tasks`);
    }
  }
  const selected = Model.groupForDate(tasks, "2026-11-14", "2026-11-14");
  assert.deepEqual(selected.unscheduled.map(task => task.id), ["due-today"]);
  assert.deepEqual(selected.scheduled.map(task => task.id), ["scheduled"]);
  assert.deepEqual(selected.overdue.map(task => task.id), ["overdue"]);
  assert.deepEqual(selected.completed.map(task => task.id), ["done-today"]);
  assert.deepEqual(tasks, before, "Grouping neither assigns a date nor mutates/reorders existing copies");
});

test("scheduling or completing an undated task removes it from backlog without inventing a deadline", () => {
  const original = Object.freeze({ id: "copy", title: "BC Calculus", dueDate: "", dueTime: "", scheduledStart: null, durationMinutes: 45, completed: false });
  const scheduled = { ...original, scheduledStart: "2026-11-14T23:00" };
  const scheduledGroups = Model.groupForDate([scheduled], "2026-11-14", "2026-11-14");
  assert.equal(scheduledGroups.backlog.length, 0);
  assert.deepEqual(scheduledGroups.scheduled, [scheduled]);
  assert.equal(scheduled.dueDate, ""); assert.equal(scheduled.dueTime, "");
  const completedGroups = Model.groupForDate([{ ...original, completed: true }], "2026-11-14", "2026-11-14");
  assert.equal(completedGroups.backlog.length, 0);
  assert.equal(completedGroups.unscheduled.length, 0);
  assert.equal(completedGroups.completed.length, 0, "An undated completion is not assigned to the selected day");
  assert.equal(original.scheduledStart, null); assert.equal(original.completed, false);
});

test("calendar views and duration helpers are stable", () => {
  assert.equal(Model.datesForView("week", "2026-10-28")[0], "2026-10-26");
  assert.equal(Model.datesForView("month", "2026-10-28").length, 42);
  assert.equal(Model.shiftView("month", "2026-10-31", 1), "2026-11-30");
  assert.equal(Model.scheduledEnd({ scheduledStart: "2026-10-28T23:00", durationMinutes: 30 }), "23:30");
});

test("each selected-day task has one primary section while both due and work dates remain intact", () => {
  const tasks = [
    { id: "late-today", dueDate: "2026-11-13", scheduledStart: "2026-11-14T15:00" },
    { id: "due-today-later-work", dueDate: "2026-11-14", dueTime: "17:00", scheduledStart: "2026-11-15T09:00" },
    { id: "late-future", dueDate: "2026-11-13", scheduledStart: "2026-11-15T10:00" },
    { id: "due-today-earlier-work", dueDate: "2026-11-14", dueTime: "09:00", scheduledStart: "2026-11-13T08:00" },
    { id: "work-today-due-later", dueDate: "2026-11-15", scheduledStart: "2026-11-14T08:00" },
    { id: "same-date", dueDate: "2026-11-14", scheduledStart: "2026-11-14T12:00" },
    { id: "done-today", dueDate: "2026-11-13", scheduledStart: "2026-11-14T10:00", completed: true },
    { id: "done-other-day", dueDate: "2026-11-13", scheduledStart: "2026-11-15T10:00", completed: true },
    { id: "backlog", dueDate: "", scheduledStart: null },
    { id: "future-deadline", dueDate: "2026-11-20", scheduledStart: null },
  ].map(task => Object.freeze(task));
  const before = structuredClone(tasks);
  const groups = Model.groupForDate(Object.freeze(tasks), "2026-11-14", "2026-11-14");
  assert.deepEqual(groups.scheduled.map(task => task.id), ["work-today-due-later", "same-date", "late-today"]);
  assert.deepEqual(groups.unscheduled.map(task => task.id), ["due-today-earlier-work", "due-today-later-work"]);
  assert.deepEqual(groups.overdue.map(task => task.id), ["late-future"]);
  assert.deepEqual(groups.completed.map(task => task.id), ["done-today"]);
  assert.deepEqual(groups.backlog.map(task => task.id), ["backlog"]);
  const rows = Object.values(groups).flat();
  assert.equal(new Set(rows.map(task => task.id)).size, rows.length, "One task never repeats across primary sections");
  for (const row of rows) assert.equal(row, tasks.find(task => task.id === row.id), "Grouping retains original task objects");
  assert.deepEqual(tasks, before, "Grouping does not change dates, completion, fields or input order");
});

test("a selected past deadline stays visible in the due section rather than appearing twice as overdue", () => {
  const task = { id: "past-due-day", dueDate: "2026-11-13", scheduledStart: "2026-11-16T10:00" };
  const groups = Model.groupForDate([task], "2026-11-13", "2026-11-14");
  assert.deepEqual(groups.unscheduled, [task]);
  assert.deepEqual(groups.overdue, []);
  assert.deepEqual(Model.groupForDate([task], "2026-11-16", "2026-11-14").scheduled, [task]);
});

test("deadline wall times retain precise due times and date-only end-of-day semantics", () => {
  assert.equal(Model.deadlineAt({ dueDate: "2026-11-14", dueTime: "00:00" }), "2026-11-14T00:00");
  assert.equal(Model.deadlineAt({ dueDate: "2026-11-14", dueTime: "17:15" }), "2026-11-14T17:15");
  assert.equal(Model.deadlineAt({ dueDate: "2026-11-14" }), "2026-11-14T23:59");
  for (const task of [{}, { dueDate: "2026-02-30" }, { dueDate: "2026-11-14", dueTime: "25:00" }, { dueDate: "2026-11-14", dueTime: "09:70" }]) {
    assert.equal(Model.deadlineAt(task), null);
  }
});

test("full work end dates roll across midnight without changing the existing display helper", () => {
  const overnight = Object.freeze({ scheduledStart: "2026-11-14T23:30", durationMinutes: 90 });
  assert.equal(Model.scheduledEndAt(overnight), "2026-11-15T01:00");
  assert.equal(Model.scheduledEnd(overnight), "23:59", "The existing clamped display helper remains unchanged");
  assert.equal(Model.scheduledEndAt({ scheduledStart: "2026-12-31T23:30", durationMinutes: 60 }), "2027-01-01T00:30");
  assert.equal(Model.scheduledEndAt({ scheduledStart: "2026-11-14T00:00", durationMinutes: 1440 }), "2026-11-15T00:00");
  assert.equal(Model.scheduledEndAt({ scheduledStart: "2026-11-14T23:30", scheduledEnd: "2026-11-15T02:00", durationMinutes: 45 }), "2026-11-15T02:00");
  assert.equal(Model.scheduledEndAt({ scheduledStart: "2026-11-14T09:00", scheduledEnd: "2026-11-13T10:00", durationMinutes: 45 }), "2026-11-14T09:45");
  assert.equal(Model.scheduledEndAt({}), null);
  assert.equal(Model.scheduledEndAt({ scheduledStart: "2026-02-30T10:00" }), null);
  assert.equal(Model.scheduledEndAt({ scheduledStart: "2026-11-14T10:00", durationMinutes: "invalid" }), null);
});

test("deadline conflict checks compare the whole work end, including precise equality and overnight rollover", () => {
  const timing = (task) => Model.taskTiming(task, "2026-11-14T08:00");
  const task = { dueDate: "2026-11-14", dueTime: "16:00", scheduledStart: "2026-11-14T15:30", durationMinutes: 30 };
  assert.equal(timing(task).plannedAfterDeadline, false, "Finishing exactly at the deadline is allowed");
  assert.equal(timing({ ...task, durationMinutes: 31 }).plannedAfterDeadline, true, "A same-day session can still finish late");
  assert.equal(timing({ ...task, dueTime: "15:00" }).plannedAfterDeadline, true);
  assert.equal(timing({ dueDate: "2026-11-14", scheduledStart: "2026-11-14T23:00", durationMinutes: 60 }).plannedAfterDeadline, true);
  assert.equal(timing({ dueDate: "2026-11-15", dueTime: "00:00", scheduledStart: "2026-11-14T23:00", durationMinutes: 60 }).plannedAfterDeadline, false);
  assert.equal(timing({ dueDate: "2026-11-15", dueTime: "09:00", scheduledStart: "2026-11-14T23:00", durationMinutes: 60 }).plannedAfterDeadline, false);
  assert.equal(timing({ dueDate: "2026-11-14" }).plannedAfterDeadline, false);
  assert.equal(timing({ scheduledStart: "2026-11-14T23:00", durationMinutes: 60 }).plannedAfterDeadline, false);
});

test("deadline status is independent of work grouping and completed work never carries urgency warnings", () => {
  const task = Object.freeze({ id: "planned-later", dueDate: "2026-11-14", dueTime: "09:00", scheduledStart: "2026-11-15T10:00", durationMinutes: 45 });
  assert.equal(Model.taskTiming(task, "2026-11-14T09:00").overdue, false);
  assert.equal(Model.taskTiming(task, new Date(2026, 10, 14, 9, 0, 1)).overdue, true);
  const late = Model.taskTiming(task, "2026-11-14T10:00");
  assert.equal(late.plannedAfterDeadline, true);
  assert.equal(late.workEnd, "2026-11-15T10:45");
  assert.equal(late.deadlineAt, "2026-11-14T09:00");
  const completed = Model.taskTiming({ ...task, completed: true }, "2026-11-16T10:00");
  assert.equal(completed.completed, true); assert.equal(completed.overdue, false); assert.equal(completed.plannedAfterDeadline, false);
  assert.equal(completed.workEnd, late.workEnd, "Completed task dates remain available for muted presentation");
  assert.equal(Model.taskTiming({ dueDate: "2026-11-14" }, "2026-11-14T23:58").overdue, false);
  assert.equal(Model.taskTiming({ dueDate: "2026-11-14" }, "2026-11-15T00:00").overdue, true);
});

test("calendar arithmetic stays civil across DST and Date references use each host's local clock", () => {
  const script = `
    const M = require(${JSON.stringify(require.resolve("../landing/planner-model.js"))});
    const spring = M.scheduledEndAt({scheduledStart:"2026-03-08T01:30",durationMinutes:120});
    const autumn = M.scheduledEndAt({scheduledStart:"2026-11-01T00:30",durationMinutes:120});
    const task = {dueDate:"2026-07-01",dueTime:"09:00"};
    const before = M.taskTiming(task,new Date(2026,6,1,8,30)).overdue;
    const after = M.taskTiming(task,new Date(2026,6,1,9,30)).overdue;
    process.stdout.write(JSON.stringify({spring,autumn,before,after}));
  `;
  for (const timeZone of ["UTC", "America/Los_Angeles", "America/New_York"]) {
    const result = JSON.parse(execFileSync(process.execPath, ["-e", script], { env: { ...process.env, TZ: timeZone }, encoding: "utf8" }));
    assert.deepEqual(result, { spring: "2026-03-08T03:30", autumn: "2026-11-01T02:30", before: false, after: true }, timeZone);
  }
});
