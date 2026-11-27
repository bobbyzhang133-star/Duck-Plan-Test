/* Optional timing sections and summaries for the shared Calendar/Tasks editor. */
(() => {
  "use strict";
  const form = document.querySelector("#task-form"), modal = document.querySelector("#task-modal");
  if (!form || !modal) return;
  const setText = (id, value) => { const node = document.getElementById(id); if (node && node.textContent !== value) node.textContent = value; };
  const work = document.querySelector("#task-schedule-options"), deadline = document.querySelector("#task-deadline-options");
  const expanded = section => window.DuckExpansionMotion?.isExpanded(section) ?? section.open;
  function refresh() {
    const fields = form.elements;
    const date = fields.scheduledDate.value, time = fields.scheduledTime.value;
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : null;
    const day = parsed && Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsed) : date;
    const workTime = /^\d{2}:\d{2}$/.test(time) ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(`2000-01-01T${time}:00`)) : "";
    const endDate = fields.scheduledEndDate.value, endTime = fields.scheduledEndTime.value;
    const endDay = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${endDate}T12:00:00`)) : endDate;
    const endLabel = /^\d{2}:\d{2}$/.test(endTime) ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(`2000-01-01T${endTime}:00`)) : "";
    setText("task-work-summary", date && time ? `${day} · ${workTime}${endDate && endLabel ? `–${endDate === date ? "" : `${endDay} · `}${endLabel}` : " · Choose an end time"}` : date ? `${day} · Choose a start time` : time || endDate || endTime ? "Choose a work date" : "Not scheduled");
    setText("task-work-label", date || time || endDate || endTime || expanded(work) ? "Work time" : "Add work time");
    if (!date && !time && !endDate && !endTime) setText("task-work-summary", expanded(work) ? "Choose a start and end time" : "Optional");
    setText("task-deadline-label", fields.dueDate.value || fields.dueTime.value || expanded(deadline) ? "Due date" : "Add due date");
    setText("task-deadline-summary", fields.dueDate.value ? `${fields.dueDate.value} · ${fields.dueTime.value || "End of day"}` : expanded(deadline) ? "Choose a deadline" : "Optional");
    for (const section of [work, deadline]) section.querySelector("summary").setAttribute("aria-expanded", String(expanded(section)));
    setText("task-detail-summary", `${fields.classId.selectedOptions[0]?.textContent || "No class"} · ${fields.priority.value}`);
    setText("task-time-summary", fields.actualMinutes.value === "" ? "No time logged" : `${fields.actualMinutes.value} minutes logged`);
    const alarm = fields.alarmEnabled.checked, notification = fields.notificationEnabled.checked;
    setText("task-alert-summary", alarm && notification ? "Alarm and notification" : alarm ? "Alarm only" : notification ? "Notification only" : "Off");
  }
  for (const section of [work, deadline]) section.addEventListener("toggle", refresh);
  form.addEventListener("click", event => {
    if (event.target.closest("[data-clear-due-date]")) {
      clearDueDate();
      window.DuckExpansionMotion.setExpanded(deadline, false);
    } else if (event.target.closest("[data-clear-work-time]")) window.DuckExpansionMotion.setExpanded(work, false);
    refresh();
  });
  function clearDueDate() {
    form.elements.dueDate.value = ""; form.elements.dueTime.value = "";
    form.elements.dueDate.dispatchEvent(new Event("input", { bubbles: true }));
  }
  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);
  form.addEventListener("reset", () => queueMicrotask(refresh));
  new MutationObserver(refresh).observe(modal, { attributes: true, attributeFilter: ["open"] });
  for (const id of ["alarm-link-status", "notification-link-status"]) {
    const node = document.getElementById(id);
    if (node) new MutationObserver(refresh).observe(node, { childList: true, characterData: true, subtree: true });
  }
  refresh();
})();
