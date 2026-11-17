(function calendarDatePresentationFactory(root, factory) {
  const model = typeof module === "object" && module.exports ? require("./planner-model.js") : root?.DuckPlannerModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCalendarDatePresentation = api;
})(typeof window !== "undefined" ? window : globalThis, function buildCalendarDatePresentation(defaultModel) {
  "use strict";

  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const flag = '<svg class="calendar-kind-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M3 14V2m0 0c3-2 6 2 10 0v7c-4 2-7-2-10 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const clock = '<svg class="calendar-kind-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.5V8l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const countText = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

  function create({ model = defaultModel, classInfo = () => ({}), safeText = escape, formatTime = value => value, formatLongDate = value => value,
    nowKey = () => model.todayKey(), selectedTaskId = () => null, now = () => new Date() } = {}) {
    const currentSelection = () => typeof selectedTaskId === "function" ? selectedTaskId() : selectedTaskId;
    const colors = task => {
      const info = classInfo(task) || {};
      const color = /^#[a-f\d]{6}$/i.test(info.color || "") ? info.color : "#8f8a7d";
      const soft = /^#[a-f\d]{6}$/i.test(info.soft || "") ? info.soft : "#efede7";
      return `--course-color:${color};--course-soft:${soft}`;
    };
    const timing = task => task.completed ? { overdue: false, plannedAfterDeadline: false } : typeof model.taskTiming === "function" ? model.taskTiming(task, now())
      : { overdue: Boolean(!task.completed && task.dueDate && task.dueDate < nowKey()), plannedAfterDeadline: false };
    const visibleTasks = (tasks, includeCompleted = false) => (Array.isArray(tasks) ? tasks : []).filter(task => task && (includeCompleted || !task.completed) && !task.deleted && !task.deleted_at);
    const validTime = value => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const dueTime = task => task.dueTime ? validTime(task.dueTime) ? formatTime(task.dueTime) : "Time unavailable" : "End of day";
    const workTime = task => {
      const start = model.scheduledParts(task);
      if (!start) return "Not scheduled";
      const endAt = model.scheduledEndAt?.(task);
      const end = endAt ? endAt.slice(11, 16) : model.scheduledEnd(task);
      return `${formatTime(start.time)}–${formatTime(end)}${endAt && endAt.slice(0, 10) > start.date ? " next day" : ""}`;
    };
    const sortedDeadlines = (tasks, date, includeCompleted = false) => visibleTasks(tasks, includeCompleted).filter(task => task.dueDate === date)
      .sort((a, b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed)) || (a.dueTime || "23:59").localeCompare(b.dueTime || "23:59") || String(a.title).localeCompare(String(b.title)) || String(a.id).localeCompare(String(b.id)));
    const sortedWork = (tasks, date, includeCompleted = false) => visibleTasks(tasks, includeCompleted).filter(task => model.scheduledParts(task)?.date === date)
      .sort((a, b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed)) || model.scheduledParts(a).minutes - model.scheduledParts(b).minutes || String(a.title).localeCompare(String(b.title)) || String(a.id).localeCompare(String(b.id)));
    const taskAttributes = (task, kind) => `data-select-task="${escape(task.id)}" data-edit-task="${escape(task.id)}" data-calendar-kind="${kind}"`;
    function accessibleLabel(task, kind, date) {
      const status = timing(task);
      const label = kind === "deadline" ? `Deadline: ${task.title}. ${dueTime(task)} on ${formatLongDate(date)}.${status.overdue ? " Overdue." : ""}`
        : `Work session: ${task.title}. ${workTime(task)} on ${formatLongDate(date)}.${status.plannedAfterDeadline ? " Work ends after the deadline." : ""}`;
      return task.completed ? `Completed. ${label}` : label;
    }
    function deadlineChip(task, date) {
      const status = timing(task);
      return `<button type="button" class="deadline-chip calendar-deadline-marker${status.overdue ? " is-overdue" : ""}${task.id === currentSelection() ? " selected" : ""}" style="${colors(task)}" ${taskAttributes(task, "deadline")} aria-label="${escape(accessibleLabel(task, "deadline", date))}">${flag}<span class="deadline-title">${safeText(task.title)}</span><small class="deadline-time">${safeText(dueTime(task))}</small>${status.overdue ? '<span class="sr-only">Overdue</span>' : ""}</button>`;
    }
    function daySummary(tasks, date) {
      const { workCount, dueCount } = model.daySummary(tasks, date);
      const count = value => value > 99 ? "99+" : String(value);
      return { workCount, dueCount,
        label: `${formatLongDate(date)}. ${countText(workCount, "scheduled assignment")}, ${countText(dueCount, "deadline")}.`,
        markup: `<span class="calendar-day-counts" aria-hidden="true">${workCount ? `<span data-day-work-count>${clock}<span>${count(workCount)}</span></span>` : ""}${dueCount ? `<span data-day-due-count>${flag}<span>${count(dueCount)}</span></span>` : ""}</span>` };
    }
    function deadlineChips(tasks, date, { expanded = false, limit = 3, dateOnly = false } = {}) {
      const deadlines = sortedDeadlines(tasks, date).filter(task => !dateOnly || !validTime(task.dueTime));
      if (!deadlines.length) return "";
      const visibleLimit = Number.isInteger(limit) && limit > 0 ? limit : 3;
      const visible = expanded ? deadlines : deadlines.slice(0, visibleLimit);
      const remaining = deadlines.length - visible.length;
      const overflow = deadlines.length > visibleLimit ? `<button type="button" class="deadline-overflow" data-deadline-overflow="${escape(date)}" aria-expanded="${expanded ? "true" : "false"}" aria-label="${escape(expanded ? `Show fewer deadlines for ${formatLongDate(date)}` : `Show ${remaining} more deadline${remaining === 1 ? "" : "s"} for ${formatLongDate(date)}`)}">${expanded ? "Show fewer" : `+${remaining} more`}</button>` : "";
      return `<div class="deadline-chip-list" data-deadline-expanded="${expanded ? "true" : "false"}">${visible.map(task => deadlineChip(task, date)).join("")}</div>${overflow}`;
    }
    function timedDeadlineGroups(tasks, date, { hourHeight = 62, markerHeight = 44 } = {}) {
      // Date-only deadlines retain their end-of-day status semantics without
      // inventing a clock position. Invalid legacy timestamps stay in the strip.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return [];
      const [year, month, day] = date.split("-").map(Number), check = new Date(0);
      check.setUTCFullYear(year, month - 1, day); check.setUTCHours(0, 0, 0, 0);
      if (year < 1 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return [];
      const scale = Number.isFinite(hourHeight) && hourHeight > 0 ? hourHeight : 62;
      const dayHeight = 24 * scale;
      const height = Math.min(dayHeight, Number.isFinite(markerHeight) && markerHeight > 0 ? markerHeight : 44);
      const groups = [];
      for (const task of sortedDeadlines(tasks, date).filter(item => validTime(item.dueTime))) {
        const minutes = Number(task.dueTime.slice(0, 2)) * 60 + Number(task.dueTime.slice(3));
        const markerTop = minutes * scale / 60;
        const top = Math.max(0, Math.min(dayHeight - height, markerTop - height / 2));
        const entry = { task, minutes, markerTop };
        let group = groups.at(-1);
        // Anchor each cluster to its first fixed-height label. Extending the
        // comparison for every new pin would chain a whole morning into a group.
        if (!group || top >= group.top + height + 4) {
          group = { key: `${date}-${minutes}`, date, minutes, lastMinutes: minutes, markerTop, top, height, dayHeight, bottom: Math.min(dayHeight, Math.max(top + height, markerTop + 5)), tasks: [], entries: [] };
          groups.push(group);
        }
        group.tasks.push(task); group.entries.push(entry); group.lastMinutes = minutes;
        group.bottom = Math.min(dayHeight, Math.max(group.top + group.height, markerTop + 5));
      }
      return groups;
    }
    function timedDeadlineMarker(group, { overlapsWork = false } = {}) {
      if (!group?.entries?.length || !Number.isFinite(group.top) || !Number.isFinite(group.bottom)) return "";
      const task = group.entries[0].task, multiple = group.entries.length > 1;
      const points = new Map();
      for (const entry of group.entries) {
        const point = points.get(entry.minutes) || { markerTop: entry.markerTop, count: 0 };
        point.count += 1; points.set(entry.minutes, point);
      }
      const pins = [...points].map(([minutes, point]) => `<span class="timed-deadline-point${point.markerTop < 5 ? " is-day-start" : ""}${group.dayHeight - point.markerTop < 5 ? " is-day-end" : ""}" data-deadline-minute="${minutes}" style="top:${point.markerTop - group.top}px" aria-hidden="true"><svg class="timed-deadline-diamond" viewBox="0 0 10 10" focusable="false"><path d="M5 0 10 5 5 10 0 5Z" fill="currentColor"/></svg>${point.count > 1 ? `<span class="timed-deadline-point-count">${point.count}</span>` : ""}</span>`).join("");
      const range = `${formatTime(task.dueTime)}${group.lastMinutes !== group.minutes ? `–${formatTime(group.entries.at(-1).task.dueTime)}` : ""}`;
      const label = multiple ? `<button type="button" class="timed-deadline-group-trigger" data-timed-deadline-group="${escape(group.key)}" data-deadline-date="${escape(group.date)}" aria-haspopup="dialog" aria-expanded="false" aria-label="${escape(`${countText(group.entries.length, "deadline")} at ${range} on ${formatLongDate(group.date)}. Open deadline list.`)}"><span class="timed-deadline-kicker">${flag}<span class="timed-deadline-kind">Deadlines</span><span class="timed-deadline-count">${group.entries.length}</span></span><strong class="timed-deadline-title">${safeText(range)}</strong></button>`
        : `<button type="button" class="timed-deadline-marker${timing(task).overdue ? " is-overdue" : ""}${task.id === currentSelection() ? " selected" : ""}" style="${colors(task)}" ${taskAttributes(task, "deadline")} aria-label="${escape(accessibleLabel(task, "deadline", group.date))}"><span class="timed-deadline-kicker">${flag}<span class="timed-deadline-kind">Deadline</span><span class="timed-deadline-time">${safeText(dueTime(task))}</span></span><strong class="timed-deadline-title">${safeText(task.title)}</strong></button>`;
      return `<div class="timed-deadline-anchor${overlapsWork ? " has-work-overlap" : ""}" data-overlaps-work="${overlapsWork ? "true" : "false"}" style="top:${group.top}px;height:${group.bottom - group.top}px">${pins}${label}</div>`;
    }
    function monthEntry(task, kind, date) {
      const status = timing(task);
      const time = kind === "deadline" ? dueTime(task) : formatTime(model.scheduledParts(task).time);
      return `<button type="button" class="month-entry month-${kind}-entry${kind === "deadline" && status.overdue ? " is-overdue" : ""}${task.completed ? " is-completed" : ""}${task.id === currentSelection() ? " selected" : ""}" style="${colors(task)}" ${taskAttributes(task, kind)} aria-label="${escape(accessibleLabel(task, kind, date))}">${kind === "deadline" ? flag : clock}<span><strong>${safeText(task.title)}</strong><small>${safeText(time)}${task.completed ? ' · <span class="calendar-completed-label">✓ Completed</span>' : ""}</small></span></button>`;
    }
    function agendaItem(task, kind, date) {
      const status = timing(task);
      const info = classInfo(task) || {};
      return `<button type="button" class="calendar-agenda-item calendar-agenda-${kind}${status.overdue && kind === "deadline" ? " is-overdue" : ""}${task.completed ? " is-completed" : ""}" style="${colors(task)}" ${taskAttributes(task, kind)} aria-label="${escape(accessibleLabel(task, kind, date))}">${kind === "deadline" ? flag : clock}<span><strong>${safeText(task.title)}</strong><small>${safeText(kind === "deadline" ? `Due ${dueTime(task)}` : workTime(task))}${info.name ? ` · ${safeText(info.name)}` : ""}</small>${task.completed ? '<small class="calendar-completed-label">✓ Completed</small>' : ""}${status.overdue && kind === "deadline" ? '<small class="calendar-agenda-warning">Overdue</small>' : ""}${status.plannedAfterDeadline && kind === "work" ? '<small class="calendar-agenda-warning">Work ends after deadline</small>' : ""}</span></button>`;
    }
    function agenda(tasks, date) {
      const deadlines = sortedDeadlines(tasks, date, true), work = sortedWork(tasks, date, true);
      const sections = [
        work.length ? `<div class="calendar-agenda-group"><h4>${countText(work.length, "work session")}</h4>${work.map(task => agendaItem(task, "work", date)).join("")}</div>` : "",
        deadlines.length ? `<div class="calendar-agenda-group"><h4>${countText(deadlines.length, "deadline")}</h4>${deadlines.map(task => agendaItem(task, "deadline", date)).join("")}</div>` : "",
      ].join("");
      return `<section class="month-selected-agenda" aria-labelledby="month-agenda-heading" data-month-agenda="${escape(date)}"><h3 id="month-agenda-heading">${safeText(formatLongDate(date))}</h3>${sections || '<p class="calendar-agenda-empty">No work sessions or deadlines for this day.</p>'}</section>`;
    }
    function month(tasks, dates, selectedDate) {
      const currentMonth = selectedDate.slice(0, 7);
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `<span>${day}</span>`).join("");
      const cells = dates.map(date => {
        const deadlines = sortedDeadlines(tasks, date, true), work = sortedWork(tasks, date, true);
        const entries = [...deadlines.map(task => ({ task, kind: "deadline" })), ...work.map(task => ({ task, kind: "work" }))]
          .sort((a, b) => Number(Boolean(a.task.completed)) - Number(Boolean(b.task.completed)));
        const visible = entries.slice(0, 3), remaining = entries.length - visible.length;
        const unique = new Set(entries.map(({ task }) => task.id)).size;
        const counts = [deadlines.length ? countText(deadlines.length, "deadline") : "", work.length ? countText(work.length, "work session") : ""].filter(Boolean).join(" · ");
        const marker = `<span class="month-kind-markers" aria-hidden="true">${deadlines.length ? `<span class="month-deadline-count">${flag}<b>${deadlines.length}</b></span>` : ""}${work.length ? `<span class="month-work-count">${clock}<b>${work.length}</b></span>` : ""}</span>`;
        return `<div class="month-day${date === selectedDate ? " selected" : ""}${date === nowKey() ? " today" : ""}${date.slice(0, 7) !== currentMonth ? " outside" : ""}" data-date="${escape(date)}"><button type="button" class="month-date-button" data-date="${escape(date)}" aria-pressed="${date === selectedDate ? "true" : "false"}"${date === nowKey() ? ' aria-current="date"' : ""} aria-label="${escape(`${formatLongDate(date)}${counts ? `, ${counts}, ${countText(unique, "task")}` : ", no work or deadlines"}`)}"><strong>${Number(date.slice(8, 10))}</strong>${marker}</button><div class="month-entries">${visible.map(({ task, kind }) => monthEntry(task, kind, date)).join("")}${remaining ? `<button type="button" class="month-overflow" data-calendar-open-day="${escape(date)}" aria-label="${escape(`Show ${remaining} more calendar entries for ${formatLongDate(date)}`)}">+${remaining} more</button>` : ""}</div><small class="month-entry-counts">${safeText(counts)}</small></div>`;
      }).join("");
      return `<div class="month-calendar calendar-layered-month"><div class="calendar-kind-legend" aria-label="Calendar key"><span>${clock}Work session</span><span>${flag}Deadline</span></div><div class="month-weekdays">${weekdays}</div><div class="month-grid">${cells}</div>${agenda(tasks, selectedDate)}</div>`;
    }
    return { daySummary, deadlineChips, timedDeadlineGroups, timedDeadlineMarker, month, agenda };
  }
  return { create };
});
