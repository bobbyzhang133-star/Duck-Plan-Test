const test = require("node:test");
const assert = require("node:assert/strict");
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
