/* Read-only summaries for the shared Calendar/Tasks editor. */
(() => {
  "use strict";
  const form = document.querySelector("#task-form"), modal = document.querySelector("#task-modal");
  if (!form || !modal) return;
  const setText = (id, value) => { const node = document.getElementById(id); if (node && node.textContent !== value) node.textContent = value; };
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
    setText("task-detail-summary", `${fields.classId.selectedOptions[0]?.textContent || "No class"} · ${fields.priority.value}`);
    setText("task-time-summary", fields.actualMinutes.value === "" ? "No time logged" : `${fields.actualMinutes.value} minutes logged`);
    const alarm = fields.alarmEnabled.checked, notification = fields.notificationEnabled.checked;
    setText("task-alert-summary", alarm && notification ? "Alarm and notification" : alarm ? "Alarm only" : notification ? "Notification only" : "Off");
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
