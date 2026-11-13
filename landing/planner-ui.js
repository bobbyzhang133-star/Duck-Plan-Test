(function plannerUiFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckPlannerUI = api;
})(typeof window !== "undefined" ? window : globalThis, function buildPlannerUi() {
  function pad(value) { return String(value).padStart(2, "0"); }

  function accountIdentity(user) {
    if (!user?.id) return { name: "Guest", initials: "?", signedIn: false };
    const clean = (value) => typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
    const name = clean(user.displayName) || clean(user.email) || "Your account";
    const words = name.split(" ");
    const initials = [words[0], ...(words.length > 1 ? [words.at(-1)] : [])]
      .map((word) => Array.from(word)[0]).join("").toLocaleUpperCase();
    return { name, initials, signedIn: true };
  }

  function nextSlot(current, key, dates, startHour = 7, endHour = 22) {
    if (!current || !Array.isArray(dates) || !dates.length) return current;
    const dateIndex = Math.max(0, dates.indexOf(current.date));
    const hour = Number(String(current.time || `${startHour}:00`).split(":")[0]);
    let nextDateIndex = dateIndex;
    let nextHour = hour;
    if (key === "ArrowUp") nextHour -= 1;
    else if (key === "ArrowDown") nextHour += 1;
    else if (key === "ArrowLeft") nextDateIndex -= 1;
    else if (key === "ArrowRight") nextDateIndex += 1;
    else return current;
    nextDateIndex = Math.max(0, Math.min(dates.length - 1, nextDateIndex));
    nextHour = Math.max(startHour, Math.min(endHour - 1, nextHour));
    return { date: dates[nextDateIndex], time: `${pad(nextHour)}:00` };
  }

  function timelineScrollTop({
    targetMinutes,
    startHour = 7,
    hourHeight = 62,
    headerOffset = 114,
    viewportHeight = 0,
    scrollHeight = 0,
  }) {
    const timelineMinutes = Math.max(startHour * 60, Number(targetMinutes) || startHour * 60);
    const target = headerOffset + ((timelineMinutes - startHour * 60) / 60) * hourHeight;
    const preferred = target - Math.max(56, viewportHeight * 0.3);
    return Math.max(0, Math.min(preferred, Math.max(0, scrollHeight - viewportHeight)));
  }

  function restoreDeletedTask(tasks, task, index) {
    if (!task || tasks.some((candidate) => candidate.id === task.id)) return [...tasks];
    const restored = [...tasks];
    restored.splice(Math.max(0, Math.min(Number(index) || 0, restored.length)), 0, task);
    return restored;
  }

  function snapCalendarDrop({
    date,
    pointerY,
    columnTop,
    hourHeight = 62,
    startHour = 7,
    endHour = 22,
    snapMinutes = 15,
    durationMinutes = 45,
  }) {
    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60;
    const duration = Math.max(snapMinutes, Number(durationMinutes) || 45);
    const rawMinutes = startMinutes + ((Number(pointerY) - Number(columnTop)) / hourHeight) * 60;
    const snapped = Math.round(rawMinutes / snapMinutes) * snapMinutes;
    const latestStart = Math.max(startMinutes, endMinutes - duration);
    const minutes = Math.max(startMinutes, Math.min(latestStart, snapped));
    return { date, minutes, time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}` };
  }

  function snapTemplateDrop(options = {}) {
    if (!options || typeof options !== "object") return null;
    const { date, pointerY, columnTop, hourHeight = 62, startHour = 7, endHour = 22, snapMinutes = 15, durationMinutes = 45 } = options;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const [year, month, day] = date.split("-").map(Number);
    const calendarDate = new Date(0);
    calendarDate.setUTCHours(0, 0, 0, 0); calendarDate.setUTCFullYear(year, month - 1, day);
    if (year < 1 || calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;
    if (![pointerY, columnTop, hourHeight, startHour, endHour].every(Number.isFinite) || hourHeight <= 0) return null;
    const startMinutes = startHour * 60, endMinutes = endHour * 60;
    if (!Number.isInteger(startMinutes) || !Number.isInteger(endMinutes) || startMinutes < 0 || endMinutes > 1440 || endMinutes <= startMinutes) return null;
    if (!Number.isInteger(snapMinutes) || snapMinutes < 1 || snapMinutes > endMinutes - startMinutes) return null;
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 900 || durationMinutes > endMinutes - startMinutes) return null;
    if (!Number.isFinite(startMinutes + ((pointerY - columnTop) / hourHeight) * 60)) return null;
    const earliest = Math.ceil(startMinutes / snapMinutes) * snapMinutes;
    const latest = Math.floor((endMinutes - durationMinutes) / snapMinutes) * snapMinutes;
    if (latest < earliest) return null;
    const snapped = snapCalendarDrop({ date, pointerY, columnTop, hourHeight, startHour, endHour, snapMinutes, durationMinutes });
    // The existing drag helper can clamp to an off-grid last start. Template copies must
    // fit their entire actual duration and retain the grid even at the bottom boundary.
    const oldLastStart = endMinutes - Math.max(snapMinutes, durationMinutes);
    const candidate = snapped.minutes >= oldLastStart ? latest : Math.round(snapped.minutes / snapMinutes) * snapMinutes;
    const minutes = Math.max(earliest, Math.min(latest, candidate));
    return { date, minutes, time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}` };
  }

  return { accountIdentity, nextSlot, restoreDeletedTask, snapCalendarDrop, snapTemplateDrop, timelineScrollTop };
});
