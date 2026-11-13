(function taskMatrixFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckTaskMatrix = api;
})(typeof window !== "undefined" ? window : globalThis, function buildTaskMatrix() {
  "use strict";

  const DAY_MS = 86400000;
  const DEFAULT_URGENCY_DAYS = 2;
  const DRAG_TYPE = "application/x-duckplan-matrix-task";
  const QUADRANTS = Object.freeze([
    Object.freeze({ id: "do_first", title: "Do first", description: "Urgent and important", importance: "important", urgency: "urgent" }),
    Object.freeze({ id: "schedule", title: "Schedule", description: "Important, not urgent", importance: "important", urgency: "not_urgent" }),
    Object.freeze({ id: "delegate", title: "Consider delegating", description: "Urgent, less important", importance: "not_important", urgency: "urgent" }),
    Object.freeze({ id: "reconsider", title: "Reconsider", description: "Neither urgent nor important", importance: "not_important", urgency: "not_urgent" }),
  ]);

  function normalizeUrgencyDays(value) {
    if (value === null || value === undefined || typeof value === "boolean" || String(value).trim() === "") return DEFAULT_URGENCY_DAYS;
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= 30 ? number : DEFAULT_URGENCY_DAYS;
  }

  // Plain calendar-day arithmetic avoids timezone and daylight-saving offsets.
  function dateOrdinal(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.getTime() / DAY_MS;
  }

  function effectiveUrgency(task, { today, urgencyDays = DEFAULT_URGENCY_DAYS } = {}) {
    if (task?.urgency === "urgent" || task?.urgency === "not_urgent") {
      return { value: task.urgency, source: "manual" };
    }
    const due = dateOrdinal(task?.dueDate);
    const reference = dateOrdinal(today);
    if (due === null || reference === null) return { value: null, source: "unknown" };
    return { value: due <= reference + normalizeUrgencyDays(urgencyDays) ? "urgent" : "not_urgent", source: "due_date" };
  }

  function classifyTask(task, options) {
    const importance = ["important", "not_important"].includes(task?.importance) ? task.importance : null;
    const urgency = effectiveUrgency(task, options);
    const quadrant = QUADRANTS.find((item) => item.importance === importance && item.urgency === urgency.value)?.id || "unclassified";
    return { importance, urgency: urgency.value, urgencySource: urgency.source, quadrant };
  }

  function groupTasks(tasks, options) {
    const groups = Object.fromEntries([...QUADRANTS.map((item) => item.id), "unclassified"].map((id) => [id, []]));
    const unique = new Map();
    for (const task of Array.isArray(tasks) ? tasks : []) {
      if (!task || task.id === null || task.id === undefined || String(task.id).trim() === "") continue;
      unique.set(String(task.id), task);
    }
    // The caller owns filtering, including whether completed tasks are shown.
    for (const task of unique.values()) groups[classifyTask(task, options).quadrant].push(task);
    return groups;
  }

  function quadrantAssignment(id) {
    const quadrant = QUADRANTS.find((item) => item.id === id);
    return quadrant ? { importance: quadrant.importance, urgency: quadrant.urgency } : null;
  }

  function escapeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  function formatDate(value) {
    const ordinal = dateOrdinal(value);
    return ordinal === null ? "No deadline" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(ordinal * DAY_MS));
  }

  function create(host) {
    const root = host.root || document.querySelector("#task-matrix-root");
    if (!root) throw new Error("The task matrix container is unavailable.");
    const store = host.store;
    const showToast = host.showToast || (() => {});
    const reportError = host.reportError || ((error) => showToast(error.message || "The task could not be updated."));
    let lastTasks = [];
    let draggedTaskId = null;
    let destroyed = false;
    const pending = new Map();

    function canOrganize() { return store.supportsOrganization !== false; }

    function settings() {
      return { today: host.getToday(), urgencyDays: normalizeUrgencyDays(store.organizationPreferences?.()?.urgencyDays) };
    }

    function taskMarkup(task, options, expanded) {
      const id = escapeText(task.id);
      const title = escapeText(task.title || "Untitled task");
      const state = classifyTask(task, options);
      const disabled = canOrganize() ? "" : " disabled";
      const importance = state.importance || "";
      const urgency = ["urgent", "not_urgent"].includes(task.urgency) ? task.urgency : "auto";
      const importanceLabel = importance === "important" ? "Important" : importance === "not_important" ? "Less important" : "Importance needed";
      const urgencyLabel = state.urgency === "urgent" ? "Urgent" : state.urgency === "not_urgent" ? "Not urgent" : "Urgency needed";
      const sourceLabel = state.urgencySource === "due_date" ? "from deadline" : state.urgencySource === "manual" ? "set by you" : "no deadline to use";
      const overdue = dateOrdinal(task.dueDate) !== null && dateOrdinal(task.dueDate) < dateOrdinal(options.today) && !task.completed;
      const due = dateOrdinal(task.dueDate) === null ? "No deadline" : `${overdue ? "Overdue" : "Due"} ${formatDate(task.dueDate)}${task.dueTime ? ` · ${escapeText(task.dueTime)}` : ""}`;
      const suggestion = !importance && ["High", "Low"].includes(task.priority)
        ? `<p class="matrix-suggestion">Priority: ${escapeText(task.priority)}. <button type="button" class="text-link" data-matrix-action="suggest" data-matrix-value="${task.priority === "High" ? "important" : "not_important"}" data-matrix-field="suggest"${disabled}>${task.priority === "High" ? "Mark important" : "Mark less important"}</button></p>` : "";
      const destinations = QUADRANTS.map((item) => `<option value="${item.id}"${state.quadrant === item.id ? " selected" : ""}>${item.title}</option>`).join("");
      return `<li class="matrix-task-card${task.completed ? " is-completed" : ""}" data-matrix-task-id="${id}">
        <div class="matrix-task-heading"><label class="matrix-complete-target"><input class="task-check" type="checkbox" data-task-id="${id}" data-matrix-field="complete"${task.completed ? " checked" : ""} aria-label="Mark ${title} ${task.completed ? "incomplete" : "complete"}" /></label><h4>${title}</h4><button type="button" class="secondary-button matrix-edit" data-matrix-action="edit" data-matrix-field="edit" aria-label="Edit ${title}">Edit</button></div>
        <div class="matrix-task-meta"><span${overdue ? ' class="matrix-overdue"' : ""}>${due}</span>${canOrganize() ? `<span class="matrix-drag-handle" draggable="true" data-matrix-drag-task="${id}" title="Drag task to a quadrant" aria-hidden="true">⠿</span>` : ""}</div>
        <div class="matrix-axis-labels"><span>${importanceLabel}</span><span>${urgencyLabel} <small>· ${sourceLabel}</small></span></div>
        ${suggestion}
        <details class="matrix-task-options"${expanded.has(String(task.id)) || state.quadrant === "unclassified" ? " open" : ""}><summary>Classify or move</summary><div class="matrix-axis-controls">
          <label>Importance<select data-matrix-field="importance" aria-label="Importance for ${title}"${disabled}><option value=""${!importance ? " selected" : ""}>Not set</option><option value="important"${importance === "important" ? " selected" : ""}>Important</option><option value="not_important"${importance === "not_important" ? " selected" : ""}>Less important</option></select></label>
          <label>Urgency<select data-matrix-field="urgency" aria-label="Urgency for ${title}"${disabled}><option value="auto"${urgency === "auto" ? " selected" : ""}>Auto · from deadline</option><option value="urgent"${urgency === "urgent" ? " selected" : ""}>Urgent · manual</option><option value="not_urgent"${urgency === "not_urgent" ? " selected" : ""}>Not urgent · manual</option></select></label>
        </div><div class="matrix-move-controls"><label>Move to<select data-matrix-field="destination" aria-label="Move ${title} to a quadrant"${disabled}>${state.quadrant === "unclassified" ? '<option value="" selected>Choose a quadrant</option>' : ""}${destinations}</select></label><button type="button" class="secondary-button" data-matrix-action="move" data-matrix-field="move" disabled>Move</button></div><p class="matrix-field-help">Moving chooses both axes. Choose Auto urgency to follow the deadline again.</p></details>
      </li>`;
    }

    function render(filteredTasks) {
      if (destroyed) return;
      lastTasks = Array.isArray(filteredTasks) ? filteredTasks.slice() : [];
      const active = root.contains(document.activeElement) ? document.activeElement : null;
      const focus = active ? { id: active.closest("[data-matrix-task-id]")?.dataset.matrixTaskId, field: active.dataset.matrixField } : null;
      const editingThreshold = focus?.field === "threshold" ? active.value : null;
      const expanded = new Set([...root.querySelectorAll(".matrix-task-options[open]")].map((element) => element.closest("[data-matrix-task-id]").dataset.matrixTaskId));
      const unknownOpen = root.querySelector(".matrix-unclassified")?.open === true;
      const options = settings();
      const groups = groupTasks(lastTasks, options);
      const count = Object.values(groups).reduce((total, items) => total + items.length, 0);
      const unknown = groups.unclassified;
      const disabled = canOrganize() ? "" : " disabled";
      const quadrants = QUADRANTS.map((item) => `<section class="matrix-quadrant" data-matrix-quadrant="${item.id}" aria-labelledby="matrix-heading-${item.id}"><header><div><h3 id="matrix-heading-${item.id}">${item.title}</h3><p>${item.description}</p></div><span class="matrix-count">${groups[item.id].length}</span></header><ul class="matrix-task-list">${groups[item.id].map((task) => taskMarkup(task, options, expanded)).join("")}</ul>${groups[item.id].length ? "" : '<p class="matrix-empty">Move a task here using its controls or drag handle.</p>'}</section>`).join("");
      root.innerHTML = `<div class="task-matrix">${canOrganize() ? "" : '<p class="matrix-availability" role="status">Matrix classification is not available for this connection yet. You can still edit and complete your tasks.</p>'}<header class="matrix-intro"><div><h3 class="matrix-main-heading" tabindex="-1">Priority matrix</h3><p>Choose importance yourself. Urgency can follow a deadline or your own choice.</p></div><form class="matrix-settings-form"><label>Auto urgency window <span><input type="number" name="urgencyDays" min="0" max="30" step="1" required value="${options.urgencyDays}" data-matrix-field="threshold" aria-label="Days before a deadline becomes urgent"${disabled} /> days</span></label><button type="submit" class="secondary-button" data-matrix-field="threshold-save"${disabled}>Update</button></form></header>
        <p class="matrix-summary" role="status">${count} task${count === 1 ? "" : "s"} shown · ${unknown.length} need classification. Auto urgency includes overdue tasks and deadlines within ${options.urgencyDays} day${options.urgencyDays === 1 ? "" : "s"}.</p>
        <details class="matrix-unclassified"${unknownOpen && unknown.length ? " open" : ""}><summary>Needs classification <span class="matrix-count">${unknown.length}</span></summary><p class="matrix-field-help">${unknown.length ? "Choose any missing axis below. A task without a deadline needs a manual urgency choice; priority never sets importance automatically." : "Every task shown has both axes classified."}</p><ul class="matrix-task-list">${unknown.map((task) => taskMarkup(task, options, expanded)).join("")}</ul></details>
        <div class="matrix-grid">${quadrants}</div>
      </div>`;
      host.setupButtons?.(root);
      if (focus?.field) {
        const card = focus.id ? [...root.querySelectorAll("[data-matrix-task-id]")].find((element) => element.dataset.matrixTaskId === focus.id) : root;
        const target = card?.querySelector(`[data-matrix-field="${focus.field}"]`) || root.querySelector(".matrix-main-heading");
        if (editingThreshold !== null && target?.matches("input")) target.value = editingThreshold;
        target?.focus({ preventScroll: true });
        if (focus.id) target?.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }

    function refresh() {
      const current = new Map(store.listItems().map((task) => [String(task.id), task]));
      render(lastTasks.map((task) => current.get(String(task.id))).filter(Boolean));
    }

    function persistChange(id, fields, message) {
      const previous = pending.get(id) || Promise.resolve();
      const operation = previous.catch(() => {}).then(async () => {
        if (!canOrganize()) { showToast("Matrix classification is not available for this connection yet."); return; }
        const task = store.listItems().find((item) => String(item.id) === id);
        if (!task) { showToast("This task is no longer available."); return; }
        try {
          await store.upsertItem({ ...task, ...fields });
          if (!destroyed) { refresh(); showToast(message); }
        } catch (error) { reportError(error); }
      });
      pending.set(id, operation);
      operation.finally(() => { if (pending.get(id) === operation) pending.delete(id); });
      return operation;
    }

    function move(id, destination) {
      const fields = quadrantAssignment(destination);
      if (!fields) return;
      const name = QUADRANTS.find((item) => item.id === destination).title;
      return persistChange(id, fields, `Moved to ${name}.`);
    }

    function click(event) {
      const button = event.target.closest("[data-matrix-action]");
      const card = button?.closest("[data-matrix-task-id]");
      if (!button || !card) return;
      const id = card.dataset.matrixTaskId;
      if (button.dataset.matrixAction === "edit") host.openTask({ id, source: button });
      if (button.dataset.matrixAction === "move") move(id, card.querySelector('[data-matrix-field="destination"]').value);
      if (button.dataset.matrixAction === "suggest") persistChange(id, { importance: button.dataset.matrixValue }, button.dataset.matrixValue === "important" ? "Marked important." : "Marked less important.");
    }

    function change(event) {
      const field = event.target.dataset.matrixField;
      const card = event.target.closest("[data-matrix-task-id]");
      if (!card) return;
      const id = card.dataset.matrixTaskId;
      if (field === "importance") persistChange(id, { importance: event.target.value || null }, "Importance updated.");
      if (field === "urgency") persistChange(id, { urgency: event.target.value }, event.target.value === "auto" ? "Urgency now follows the deadline." : "Urgency updated.");
      if (field === "destination") {
        const task = store.listItems().find((item) => String(item.id) === id);
        card.querySelector('[data-matrix-action="move"]').disabled = !canOrganize() || !quadrantAssignment(event.target.value) || classifyTask(task, settings()).quadrant === event.target.value;
      }
    }

    async function submit(event) {
      if (!event.target.matches(".matrix-settings-form")) return;
      event.preventDefault();
      if (!canOrganize()) { showToast("Matrix classification is not available for this connection yet."); return; }
      const input = event.target.elements.urgencyDays;
      const value = input.valueAsNumber;
      if (!Number.isInteger(value) || value < 0 || value > 30) {
        showToast("Choose an urgency window from 0 to 30 whole days.");
        input.focus();
        return;
      }
      try {
        await store.saveOrganizationPreferences({ urgencyDays: value });
        if (!destroyed) { refresh(); showToast("Urgency window updated."); }
      } catch (error) { reportError(error); }
    }

    function dragstart(event) {
      const handle = event.target.closest("[data-matrix-drag-task]");
      if (!canOrganize() || !handle || !event.dataTransfer) return;
      draggedTaskId = handle.dataset.matrixDragTask;
      event.dataTransfer.setData(DRAG_TYPE, draggedTaskId);
      event.dataTransfer.effectAllowed = "move";
      root.classList.add("matrix-is-dragging");
    }

    function clearDrag() {
      draggedTaskId = null;
      root.classList.remove("matrix-is-dragging");
      root.querySelectorAll(".is-matrix-drop-target").forEach((element) => element.classList.remove("is-matrix-drop-target"));
    }

    function dragover(event) {
      const quadrant = event.target.closest("[data-matrix-quadrant]");
      if (!draggedTaskId || !quadrant) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      root.querySelectorAll(".is-matrix-drop-target").forEach((element) => element.classList.toggle("is-matrix-drop-target", element === quadrant));
      quadrant.classList.add("is-matrix-drop-target");
    }

    function drop(event) {
      const quadrant = event.target.closest("[data-matrix-quadrant]");
      if (!draggedTaskId || !quadrant) return;
      event.preventDefault();
      const id = draggedTaskId;
      const destination = quadrant.dataset.matrixQuadrant;
      clearDrag();
      move(id, destination);
    }

    const listeners = { click, change, submit, dragstart, dragover, drop, dragend: clearDrag };
    for (const [name, listener] of Object.entries(listeners)) root.addEventListener(name, listener);
    return {
      render,
      destroy() {
        destroyed = true;
        clearDrag();
        for (const [name, listener] of Object.entries(listeners)) root.removeEventListener(name, listener);
      },
    };
  }

  return Object.freeze({ QUADRANTS, normalizeUrgencyDays, dateOrdinal, effectiveUrgency, classifyTask, groupTasks, quadrantAssignment, create });
});
