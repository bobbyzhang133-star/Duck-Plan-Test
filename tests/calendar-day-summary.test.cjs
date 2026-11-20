const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("../landing/planner-model.js");
const Presentation = require("../landing/calendar-date-presentation.js");

test("daily counts independently represent unfinished work starts and timed/date-only deadlines without writes", () => {
  const rows = [
    { id: "different", scheduledStart: "2026-11-18T23:30", durationMinutes: 90, dueDate: "2026-11-20", dueTime: "12:00" },
    { id: "both", scheduledStart: "2026-11-18T09:00", dueDate: "2026-11-18", dueTime: "17:00" },
    { id: "date-only", dueDate: "2026-11-18", dueTime: "" },
    { id: "done", scheduledStart: "2026-11-18T12:00", dueDate: "2026-11-18", completed: true },
    { id: "deleted", dueDate: "2026-11-18", deleted: true },
    { id: "tombstone", dueDate: "2026-11-18", deleted_at: "2026-11-17" },
    { id: "unscheduled" },
  ];
  const before = JSON.stringify(rows);
  rows.forEach(Object.freeze); Object.freeze(rows);
  assert.deepEqual(Model.daySummary(rows, "2026-11-18"), { workCount: 2, dueCount: 2 });
  assert.deepEqual(Model.daySummary(rows, "2026-11-19"), { workCount: 0, dueCount: 0 }, "Overnight counts only on its start day");
  assert.deepEqual(Model.daySummary(rows, "2026-11-20"), { workCount: 0, dueCount: 1 });
  assert.equal(JSON.stringify(rows), before);
});

test("unique identities, empty/invalid dates and source updates do not produce misleading totals", () => {
  const task = { id: "one", dueDate: "2026-11-18", scheduledStart: "2026-11-18T10:00" };
  assert.deepEqual(Model.daySummary([task, { ...task }], "2026-11-18"), { workCount: 1, dueCount: 1 });
  assert.deepEqual(Model.daySummary(null, "2026-11-18"), { workCount: 0, dueCount: 0 });
  assert.deepEqual(Model.daySummary([task], "2026-02-30"), { workCount: 0, dueCount: 0 });
  task.scheduledStart = "2026-11-19T10:00";
  assert.deepEqual(Model.daySummary([task], "2026-11-18"), { workCount: 0, dueCount: 1 });
  assert.deepEqual(Model.daySummary([task], "2026-11-19"), { workCount: 1, dueCount: 0 });
  task.completed = true;
  assert.deepEqual(Model.daySummary([task], "2026-11-18"), { workCount: 0, dueCount: 0 });
});

test("compact counts hide zero categories, cap only visual large totals and retain a full accessible label", () => {
  const ui = Presentation.create({ formatLongDate: date => `Date ${date}` });
  const empty = ui.daySummary([], "2026-11-18");
  assert.doesNotMatch(empty.markup, /data-day-(work|due)-count/);
  const rows = Array.from({ length: 110 }, (_, id) => ({ id, dueDate: "2026-11-18" }));
  const result = ui.daySummary(rows, "2026-11-18");
  assert.equal(result.dueCount, 110);
  assert.match(result.markup, /99\+/);
  assert.match(result.label, /0 scheduled assignments, 110 deadlines/);
  assert.match(result.markup, /data-day-list="due"/);
  assert.match(result.markup, /Show 110 deadlines for Date 2026-11-18/);
  assert.match(result.markup, /aria-haspopup="dialog"/);
  assert.match(result.markup, /is-single/);
  const picker = ui.daySummary(rows, "2026-11-18", { interactive: false });
  assert.match(picker.markup, /aria-hidden="true"/);
  assert.doesNotMatch(picker.markup, /<button/);
});
