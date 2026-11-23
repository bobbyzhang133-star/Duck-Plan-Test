(function taskListGroupsFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckTaskListGroups = api;
})(typeof window !== "undefined" ? window : globalThis, function buildTaskListGroups() {
  "use strict";
  const planGroups = [
    ["overdue", "Overdue", "overdue"], ["scheduled", "Scheduled", "scheduled"],
    ["due", "Due today", "due"], ["upcoming", "Upcoming", "upcoming"],
    ["unscheduled", "Unscheduled", "neutral"], ["completed", "Completed", "completed"]
  ];
  function groupTasks(tasks, { mode = "plan", today, isOverdue, classInfo } = {}) {
    const buckets = new Map();
    for (const task of tasks) {
      let key, label, tone = "neutral", order = 0;
      if (mode === "class") {
        const info = classInfo(task);
        key = `class:${info.id || info.name}`; label = info.name;
      } else if (mode === "priority") {
        const priority = ["High", "Medium", "Low"].includes(task.priority) ? task.priority : "None";
        key = `priority:${priority}`; label = priority === "None" ? "No priority" : `${priority} priority`;
        order = ["High", "Medium", "Low", "None"].indexOf(priority);
        tone = { High: "overdue", Medium: "priority", Low: "completed", None: "neutral" }[priority];
      } else {
        const category = task.completed ? "completed" : isOverdue(task) ? "overdue" : task.scheduledStart ? "scheduled" : task.dueDate === today ? "due" : task.dueDate > today ? "upcoming" : "unscheduled";
        order = planGroups.findIndex(group => group[0] === category);
        [key, label, tone] = planGroups[order];
      }
      if (!buckets.has(key)) buckets.set(key, { key, label, tone, order, tasks: [] });
      buckets.get(key).tasks.push(task);
    }
    return [...buckets.values()].sort((a, b) => mode === "class" ? a.label.localeCompare(b.label) : a.order - b.order);
  }
  return Object.freeze({ groupTasks });
});
