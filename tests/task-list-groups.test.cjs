const test = require("node:test");
const assert = require("node:assert/strict");
const { groupTasks } = require("../landing/task-list-groups.js");
const options = { today: "2026-11-22", isOverdue: task => Boolean(task.overdue), classInfo: task => ({ id: task.classId || "none", name: task.classId || "No class" }) };
const tasks = [
  { id: "late-work", overdue: true, scheduledStart: "2026-11-22T09:00", dueDate: "2026-11-21", priority: "High", classId: "Physics" },
  { id: "work", scheduledStart: "2026-11-23T09:00", dueDate: "2026-11-24", priority: "Medium", classId: "Physics" },
  { id: "today", dueDate: "2026-11-22", priority: "Low", classId: "Calculus" },
  { id: "future", dueDate: "2026-11-25", priority: "Medium", classId: "Calculus" },
  { id: "inbox", dueDate: "", priority: "" },
  { id: "done", overdue: true, completed: true, priority: "High" }
];
test("plan categories retain every task once and separate work time from its deadline", () => {
  const groups = groupTasks(tasks, options);
  assert.deepEqual(groups.map(g => [g.key, g.tasks.map(t => t.id)]), [["overdue", ["late-work"]], ["scheduled", ["work"]], ["due", ["today"]], ["upcoming", ["future"]], ["unscheduled", ["inbox"]], ["completed", ["done"]]]);
});
test("class grouping retains order within classes and includes tasks without a class", () => {
  const groups = groupTasks(tasks, { ...options, mode: "class" });
  assert.deepEqual(groups.map(g => [g.label, g.tasks.map(t => t.id)]), [["Calculus", ["today", "future"]], ["No class", ["inbox", "done"]], ["Physics", ["late-work", "work"]]]);
});
test("priority grouping orders all supported priorities and retains unprioritized tasks", () => {
  const before = JSON.stringify(tasks);
  const groups = groupTasks(tasks, { ...options, mode: "priority" });
  assert.deepEqual(groups.map(g => g.label), ["High priority", "Medium priority", "Low priority", "No priority"]);
  assert.equal(new Set(groups.flatMap(g => g.tasks.map(t => t.id))).size, tasks.length);
  assert.equal(JSON.stringify(tasks), before);
});
test("empty inputs have no empty category scaffolding", () => {
  for (const mode of ["plan", "class", "priority"]) assert.deepEqual(groupTasks([], { ...options, mode }), []);
});
