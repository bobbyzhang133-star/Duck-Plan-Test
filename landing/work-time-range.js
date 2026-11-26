(function workTimeRangeFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckWorkTimeRange = api;
})(typeof window !== "undefined" ? window : globalThis, function buildWorkTimeRange() {
  "use strict";
  const fields = ["scheduledDate", "scheduledTime", "scheduledEndDate", "scheduledEndTime"];
  function stamp(date, time) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(`${date}T${time}`);
    if (!match) return null;
    const [, year, month, day, hour, minute] = match.map(Number), value = new Date(0);
    value.setUTCFullYear(year, month - 1, day); value.setUTCHours(hour, minute, 0, 0);
    return year >= 1 && value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day ? value.getTime() : null;
  }
  function wall(value) {
    const date = new Date(value), pad = number => String(number).padStart(2, "0");
    if (!Number.isFinite(value) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return null;
    return `${String(date.getUTCFullYear()).padStart(4, "0")}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  }
  function duration(value) { const n = Number(value); return Number.isInteger(n) && n >= 5 && n <= 1440 ? n : 45; }
  function fromStart(date, time, minutes = 45) {
    const start = stamp(date, time), end = start === null ? null : wall(start + duration(minutes) * 60000);
    return { scheduledDate: date || "", scheduledTime: time || "", scheduledEndDate: end?.slice(0, 10) || date || "", scheduledEndTime: end?.slice(11) || "" };
  }
  function invalid(field, message) { const error = new Error(message); error.field = field; return error; }
  function read(values) {
    if (fields.every(field => !values[field])) return { scheduledStart: null, durationMinutes: duration(values.durationMinutes) };
    if (!values.scheduledDate || stamp(values.scheduledDate, "00:00") === null) throw invalid("scheduledDate", "Choose a valid start date for your work.");
    const start = stamp(values.scheduledDate, values.scheduledTime);
    if (start === null) throw invalid("scheduledTime", "Choose a valid start time for your work.");
    if (!values.scheduledEndDate || stamp(values.scheduledEndDate, "00:00") === null) throw invalid("scheduledEndDate", "Choose a valid end date for your work.");
    const end = stamp(values.scheduledEndDate, values.scheduledEndTime);
    if (end === null) throw invalid("scheduledEndTime", "Choose a valid end time for your work.");
    const minutes = (end - start) / 60000;
    if (minutes <= 0) throw invalid("scheduledEndTime", "End time must be after start time. For overnight work, choose the next end date.");
    if (minutes < 5) throw invalid("scheduledEndTime", "Work time must be at least 5 minutes.");
    if (minutes > 1440) throw invalid("scheduledEndDate", "Work time can be up to 24 hours. Choose an earlier end date or time.");
    return { scheduledStart: `${values.scheduledDate}T${values.scheduledTime}`, durationMinutes: minutes };
  }
  function createEditor(form) {
    let minutes = 45;
    const values = () => Object.fromEntries([...fields, "durationMinutes"].map(name => [name, form.elements[name].value]));
    function reset(date, time, savedDuration, savedEnd) {
      minutes = duration(savedDuration);
      const range = fromStart(date, time, minutes);
      if (savedEnd && stamp(savedEnd.slice(0, 10), savedEnd.slice(11)) !== null) {
        range.scheduledEndDate = savedEnd.slice(0, 10); range.scheduledEndTime = savedEnd.slice(11);
        try { minutes = read(range).durationMinutes; } catch { /* Show an unsupported legacy range for correction, never silently shorten it. */ }
      }
      for (const [name, value] of Object.entries(range)) form.elements[name].value = value;
      form.elements.durationMinutes.value = String(minutes);
    }
    form.addEventListener("input", event => {
      if (!fields.includes(event.target.name)) return;
      if (["scheduledDate", "scheduledTime"].includes(event.target.name)) {
        const current = values(), next = fromStart(current.scheduledDate, current.scheduledTime, minutes);
        if (stamp(current.scheduledDate, current.scheduledTime) !== null || !current.scheduledTime) {
          form.elements.scheduledEndDate.value = next.scheduledEndDate;
          form.elements.scheduledEndTime.value = next.scheduledEndTime;
        }
      }
      try { const next = read(values()); minutes = next.durationMinutes; form.elements.durationMinutes.value = String(minutes); } catch { /* Save reports the exact invalid endpoint. */ }
    });
    form.addEventListener("click", event => {
      if (!event.target.closest?.("[data-clear-work-time]")) return;
      for (const name of fields) form.elements[name].value = "";
      form.elements.scheduledDate.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return { reset, read: () => read(values()) };
  }
  return { fromStart, read, createEditor };
});
