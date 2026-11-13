const test = require("node:test");
const assert = require("node:assert/strict");
const Goals = require("../landing/personal-goals.js");

test("goal progress uses the actual target, caps its bar and retains over-target counts", () => {
  assert.deepEqual(Goals.goalProgress({ targetCount: 8, currentCount: 3 }), { percent: 38, remaining: 5, reached: false });
  assert.deepEqual(Goals.goalProgress({ targetCount: 3, currentCount: 8 }), { percent: 100, remaining: 0, reached: true });
  assert.equal(Goals.normalizeGoal({ title: "Read", targetCount: 3, currentCount: 8 }).currentCount, 8);
});

test("goal validation accepts measured targets and real dates without copying unrelated fields", () => {
  assert.deepEqual(Goals.normalizeGoal({ title: "  Read a book  ", targetCount: "100", currentCount: "12", unit: "pages", deadlineDate: "2028-02-29", notes: "Read each evening", completed: true }), { title: "Read a book", targetCount: 100, currentCount: 12, unit: "pages", deadlineDate: "2028-02-29", notes: "Read each evening" });
  for (const [field, value] of [["title", ""], ["title", "x".repeat(101)], ["targetCount", 0], ["targetCount", 100001], ["currentCount", -1], ["currentCount", 1.2], ["unit", ""], ["unit", "x".repeat(31)], ["notes", "x".repeat(5001)], ["deadlineDate", "2026-02-29"], ["deadlineDate", "2026-11-31"]]) {
    assert.throws(() => Goals.normalizeGoal({ title: "Goal", [field]: value }), error => error.field === field);
  }
  assert.deepEqual(Goals.normalizeGoal({ title: "A goal" }), { title: "A goal", notes: "", targetCount: 5, currentCount: 0, unit: "sessions", deadlineDate: "" });
});

test("habit repeat days are validated, deduplicated and sorted without mutating the source", () => {
  const source = Object.freeze({ title: "Read", repeatDays: Object.freeze([5, 1, 5, 0]), notes: "One chapter" });
  assert.deepEqual(Goals.normalizeHabit(source), { title: "Read", repeatDays: [0, 1, 5], notes: "One chapter" });
  assert.deepEqual(source.repeatDays, [5, 1, 5, 0]);
  assert.equal(Goals.normalizeHabit({ title: "Daily practice" }).repeatDays.length, 7);
  for (const value of [[], [-1], [7], [1.5], ["1"], null, "Monday"]) {
    if (value === null) continue;
    assert.throws(() => Goals.normalizeHabit({ title: "Read", repeatDays: value }), error => error.field === "repeatDays");
  }
  assert.throws(() => Goals.normalizeHabit({ title: "Read", notes: "x".repeat(2001) }), error => error.field === "notes");
});

test("Monday-based weeks cross month, year, leap-day and DST boundaries as calendar dates", () => {
  assert.equal(Goals.weekStart("2026-11-15"), "2026-11-09");
  assert.deepEqual(Goals.weekDates("2027-01-01"), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  assert.equal(Goals.addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(Goals.addDays("2026-03-08", 1), "2026-03-09");
  assert.equal(Goals.addDays("2026-11-01", 1), "2026-11-02");
  for (const date of ["2026-2-01", "2026-02-29", "2026-13-01", "0000-01-01", "2026-01-01T00:00:00"]) assert.equal(Goals.validDate(date), false);
});

test("weekly check-ins count only the habit's scheduled dates through today", () => {
  const habit = { id: "reading", repeatDays: [1, 3, 5] };
  const checkins = [
    { habitId: "reading", date: "2026-11-09", completed: true },
    { habitId: "reading", date: "2026-11-11", completed: true },
    { habitId: "reading", date: "2026-11-11", completed: false },
    { habitId: "reading", date: "2026-11-10", completed: true },
    { habitId: "reading", date: "2026-11-13", completed: true },
    { habitId: "another", date: "2026-11-11", completed: true },
  ];
  assert.deepEqual(Goals.habitWeekSummary(habit, checkins, "2026-11-12", "2026-11-12"), { planned: 2, completed: 1 });
  assert.deepEqual(Goals.habitWeekSummary(habit, checkins, "2026-11-12", "2026-11-15"), { planned: 3, completed: 2 });
  assert.equal(Goals.canCheckIn(habit, "2026-11-13", "2026-11-12"), false);
  assert.equal(Goals.canCheckIn(habit, "2026-11-10", "2026-11-12"), false);
  assert.equal(Goals.canCheckIn(habit, "2026-11-11", "2026-11-12"), true);
});
