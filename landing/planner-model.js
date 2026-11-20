(function plannerModelFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckPlannerModel = api;
})(typeof window !== "undefined" ? window : globalThis, function buildPlannerModel() {
  const DAY_MS = 86400000;

  function pad(value) { return String(value).padStart(2, "0"); }
  function toDateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function fromDateKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  }
  function todayKey(now = new Date()) { return toDateKey(now); }
  function addDays(value, amount) {
    const date = typeof value === "string" ? fromDateKey(value) : new Date(value);
    date.setDate(date.getDate() + amount);
    return toDateKey(date);
  }
  function startOfWeek(value) {
    const date = fromDateKey(value);
    const weekday = date.getDay() || 7;
    date.setDate(date.getDate() - weekday + 1);
    return toDateKey(date);
  }
  function addMonths(value, amount) {
    const date = fromDateKey(value);
    const originalDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(originalDay, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    return toDateKey(date);
  }
  function localDateTime(dateKey, time = "00:00") {
    const date = fromDateKey(dateKey);
    if (!date) return null;
    const [hours, minutes] = (time || "00:00").split(":").map(Number);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
  }
  function minutesFromTime(value) {
    if (!value) return null;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }
  function timeFromMinutes(value) {
    const bounded = Math.max(0, Math.min(1439, Math.round(value)));
    return `${pad(Math.floor(bounded / 60))}:${pad(bounded % 60)}`;
  }
  function scheduledParts(task) {
    if (!task.scheduledStart) return null;
    const [date, time = "09:00"] = task.scheduledStart.split("T");
    return { date, time, minutes: minutesFromTime(time) };
  }
  function scheduledEnd(task) {
    const start = scheduledParts(task);
    if (!start) return null;
    const explicit = task.scheduledEnd?.split("T")[1];
    return explicit || timeFromMinutes(start.minutes + Number(task.durationMinutes || 45));
  }
  // Task dates are floating calendar values. UTC-backed arithmetic keeps their
  // civil dates stable at midnight and DST boundaries without changing alert zones.
  function calendarTime(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value || "");
    if (!match) return null;
    const [, year, month, day, hour, minute] = match.map(Number);
    if (year < 1) return null;
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, 0, 0);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.getTime();
  }
  function calendarWall(value) {
    const date = new Date(value), year = date.getUTCFullYear();
    if (!Number.isFinite(value) || year < 1 || year > 9999) return null;
    return `${String(year).padStart(4, "0")}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  }
  function deadlineAt(task = {}) {
    if (!task.dueDate) return null;
    const value = `${task.dueDate}T${task.dueTime || "23:59"}`;
    return calendarTime(value) === null ? null : value;
  }
  function scheduledEndAt(task = {}) {
    const start = calendarTime(task.scheduledStart);
    if (start === null) return null;
    const explicit = calendarTime(task.scheduledEnd);
    if (explicit !== null && explicit >= start) return task.scheduledEnd;
    const duration = Number(task.durationMinutes || 45);
    return Number.isInteger(duration) && duration > 0 ? calendarWall(start + duration * 60000) : null;
  }
  function taskTiming(task = {}, reference = new Date()) {
    const due = deadlineAt(task), workStart = calendarTime(task.scheduledStart) === null ? null : task.scheduledStart;
    const workEnd = scheduledEndAt(task), completed = Boolean(task.completed);
    let now = null;
    if (reference instanceof Date && Number.isFinite(reference.getTime())) {
      const local = `${String(reference.getFullYear()).padStart(4, "0")}-${pad(reference.getMonth() + 1)}-${pad(reference.getDate())}T${pad(reference.getHours())}:${pad(reference.getMinutes())}`;
      now = calendarTime(local);
      if (now !== null) now += reference.getSeconds() * 1000 + reference.getMilliseconds();
    } else if (typeof reference === "string") now = calendarTime(reference);
    const deadline = calendarTime(due), end = calendarTime(workEnd);
    return {
      deadlineAt: due,
      workStart,
      workEnd,
      overdue: !completed && deadline !== null && now !== null && deadline < now,
      plannedAfterDeadline: !completed && deadline !== null && end !== null && end > deadline,
      completed,
    };
  }
  function migrateTasks(input) {
    if (!Array.isArray(input)) return [];
    return input.filter(Boolean).map((task, index) => ({
      ...task,
      id: String(task.id || `migrated-${Date.now()}-${index}`),
      title: String(task.title || "Untitled task"),
      className: task.className || "Personal",
      priority: task.priority || "Medium",
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || "") ? task.dueDate : "",
      dueTime: /^\d{2}:\d{2}$/.test(task.dueTime || "") ? task.dueTime : "",
      scheduledStart: task.scheduledStart || null,
      scheduledEnd: task.scheduledEnd || null,
      durationMinutes: Number(task.durationMinutes || 45),
      completed: Boolean(task.completed),
      schemaVersion: 2,
    }));
  }
  function groupForDate(tasks, selectedDate, referenceDate = todayKey()) {
    const groups = { overdue: [], scheduled: [], unscheduled: [], backlog: [], completed: [] };
    for (const task of tasks) {
      const workDate = scheduledParts(task)?.date;
      if (task.completed) {
        if (task.dueDate === selectedDate || workDate === selectedDate) groups.completed.push(task);
      } else if (workDate === selectedDate) groups.scheduled.push(task);
      else if (task.dueDate === selectedDate) groups.unscheduled.push(task);
      else if (task.dueDate && task.dueDate < referenceDate) groups.overdue.push(task);
      else if (!task.dueDate && !task.scheduledStart) groups.backlog.push(task);
    }
    groups.scheduled.sort((a, b) => scheduledParts(a).minutes - scheduledParts(b).minutes);
    groups.unscheduled.sort((a, b) => (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99"));
    return groups;
  }
  // Header summaries describe independent work/deadline facts, not the
  // mutually exclusive groups used by the task list. Never mutate task dates.
  function daySummary(tasks, date) {
    const work = new Set(), due = new Set();
    const parsed = fromDateKey(date);
    if (!parsed || toDateKey(parsed) !== date) return { workCount: 0, dueCount: 0 };
    for (const task of Array.isArray(tasks) ? tasks : []) {
      if (!task || task.completed || task.deleted || task.deleted_at) continue;
      const identity = task.id ?? task;
      if (scheduledParts(task)?.date === date) work.add(identity);
      if (task.dueDate === date) due.add(identity);
    }
    return { workCount: work.size, dueCount: due.size };
  }
  function datesForView(view, selectedDate) {
    if (view === "day") return [selectedDate];
    if (view === "week") return Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate), index));
    const selected = fromDateKey(selectedDate);
    const first = toDateKey(new Date(selected.getFullYear(), selected.getMonth(), 1));
    const gridStart = addDays(first, -(fromDateKey(first).getDay()));
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }
  function shiftView(view, selectedDate, direction) {
    if (view === "day") return addDays(selectedDate, direction);
    if (view === "week") return addDays(selectedDate, direction * 7);
    return addMonths(selectedDate, direction);
  }

  return {
    DAY_MS,
    addDays,
    datesForView,
    daySummary,
    deadlineAt,
    fromDateKey,
    groupForDate,
    localDateTime,
    migrateTasks,
    minutesFromTime,
    scheduledEnd,
    scheduledEndAt,
    scheduledParts,
    shiftView,
    startOfWeek,
    timeFromMinutes,
    taskTiming,
    toDateKey,
    todayKey,
  };
});
