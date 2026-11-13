const test = require("node:test");
const assert = require("node:assert/strict");
const Matrix = require("../landing/task-matrix.js");

const options = { today: "2026-11-12", urgencyDays: 2 };

test("automatic urgency includes overdue and cutoff dates, but not the next day", () => {
  for (const dueDate of ["2026-01-01", "2026-11-12", "2026-11-13", "2026-11-14"]) {
    assert.deepEqual(Matrix.effectiveUrgency({ dueDate, urgency: "auto" }, options), { value: "urgent", source: "due_date" });
  }
  assert.equal(Matrix.effectiveUrgency({ dueDate: "2026-11-15" }, options).value, "not_urgent");
  assert.equal(Matrix.effectiveUrgency({ dueDate: "2026-11-13" }, { ...options, urgencyDays: 0 }).value, "not_urgent");
  assert.equal(Matrix.effectiveUrgency({ dueDate: "2026-12-12" }, { ...options, urgencyDays: 30 }).value, "urgent");
  assert.equal(Matrix.effectiveUrgency({ dueDate: "2026-12-13" }, { ...options, urgencyDays: 30 }).value, "not_urgent");
});

test("calendar-day urgency crosses leap days and year boundaries without timezone offsets", () => {
  assert.equal(Matrix.effectiveUrgency({ dueDate: "2028-03-01" }, { today: "2028-02-28", urgencyDays: 2 }).value, "urgent");
  assert.equal(Matrix.effectiveUrgency({ dueDate: "2028-03-02" }, { today: "2028-02-28", urgencyDays: 2 }).value, "not_urgent");
  assert.equal(Matrix.effectiveUrgency({ dueDate: "2027-01-01" }, { today: "2026-12-31", urgencyDays: 1 }).value, "urgent");
  assert.equal(Matrix.dateOrdinal("2000-02-29") + 1, Matrix.dateOrdinal("2000-03-01"));
  assert.equal(Matrix.dateOrdinal("2100-02-29"), null);
  assert.equal(Matrix.dateOrdinal("2026-02-29"), null);
  assert.equal(Matrix.dateOrdinal("2026-04-31"), null);
  assert.equal(Matrix.dateOrdinal("2026-2-01"), null);
});

test("an absent or invalid deadline stays unknown rather than becoming not urgent", () => {
  for (const dueDate of [undefined, null, "", "not-a-date", "2026-02-30"]) {
    const state = Matrix.classifyTask({ id: "undated", importance: "important", urgency: "auto", dueDate }, options);
    assert.equal(state.urgency, null);
    assert.equal(state.urgencySource, "unknown");
    assert.equal(state.quadrant, "unclassified");
  }
  assert.equal(Matrix.classifyTask({ importance: "important", dueDate: "2026-11-13" }, { today: "invalid" }).urgency, null);
});

test("manual urgency overrides the deadline and returning to auto derives the current deadline", () => {
  const task = { id: "essay", importance: "important", dueDate: "2026-11-11", urgency: "not_urgent" };
  assert.deepEqual(Matrix.classifyTask(task, options), { importance: "important", urgency: "not_urgent", urgencySource: "manual", quadrant: "schedule" });
  assert.equal(Matrix.classifyTask({ ...task, dueDate: null, urgency: "urgent" }, options).quadrant, "do_first");
  assert.equal(Matrix.classifyTask({ ...task, urgency: "auto" }, options).quadrant, "do_first");
  assert.equal(Matrix.classifyTask({ ...task, urgency: "auto", dueDate: null }, options).quadrant, "unclassified", "Clearing a deadline cannot retain cached auto urgency");
});

test("priority never silently supplies importance and all four explicit quadrants remain distinct", () => {
  for (const priority of ["High", "Medium", "Low"]) {
    const state = Matrix.classifyTask({ priority, dueDate: "2026-11-12" }, options);
    assert.equal(state.importance, null);
    assert.equal(state.quadrant, "unclassified");
  }
  for (const quadrant of Matrix.QUADRANTS) {
    const fields = Matrix.quadrantAssignment(quadrant.id);
    assert.deepEqual(fields, { importance: quadrant.importance, urgency: quadrant.urgency });
    assert.equal(Matrix.classifyTask({ ...fields, dueDate: null }, options).quadrant, quadrant.id);
  }
  assert.equal(Matrix.quadrantAssignment("invalid"), null);
});

test("grouping respects the caller's filtered set, includes passed completed tasks and deduplicates IDs", () => {
  const tasks = [
    { id: "essay", importance: "important", urgency: "urgent", completed: false },
    { id: "done", importance: "not_important", urgency: "not_urgent", completed: true },
    { id: "essay", importance: "important", urgency: "not_urgent", title: "Newest version" },
    { id: "unknown", priority: "High" },
    { title: "Missing identity" },
    null,
  ];
  const original = JSON.stringify(tasks);
  const groups = Matrix.groupTasks(tasks, options);
  assert.deepEqual(groups.do_first, []);
  assert.equal(groups.schedule[0].title, "Newest version");
  assert.deepEqual(groups.reconsider.map((task) => task.id), ["done"]);
  assert.deepEqual(groups.unclassified.map((task) => task.id), ["unknown"]);
  assert.equal(Object.values(groups).flat().length, 3);
  assert.equal(new Set(Object.values(groups).flat().map((task) => task.id)).size, 3);
  assert.equal(JSON.stringify(tasks), original, "Classification must not mutate source tasks");
  const onlyDone = Matrix.groupTasks(tasks.filter((task) => task?.completed), options);
  assert.deepEqual(Object.values(onlyDone).flat().map((task) => task.id), ["done"]);
});

test("urgency preferences accept only whole-day windows from zero through thirty", () => {
  assert.equal(Matrix.normalizeUrgencyDays(0), 0);
  assert.equal(Matrix.normalizeUrgencyDays("30"), 30);
  assert.equal(Matrix.normalizeUrgencyDays("2"), 2);
  for (const value of [null, undefined, "", true, -1, 31, 1.5, "invalid", Infinity]) assert.equal(Matrix.normalizeUrgencyDays(value), 2);
});
