(function calendarTaskPreviewFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCalendarTaskPreview = api;
})(typeof window !== "undefined" ? window : globalThis, function buildCalendarTaskPreview() {
  "use strict";

  function create(host) {
    const doc = host.document || document, store = host.store;
    const model = host.model || doc.defaultView?.DuckPlannerModel;
    const motion = host.motion || doc.defaultView?.DuckPopupMotion;
    let dialog = null, generation = 0, destroyed = false;
    const ownerKey = () => `${store.mode}:${store.user?.id || "local"}:${host.getOwnerVersion?.() ?? 0}`;
    const viewKey = () => host.getView?.() ?? "calendar";
    const taskFor = id => store.listItems().find(task => String(task.id) === id && !task.deleted && !task.deleted_at);
    const sameOwner = context => !destroyed && context.owner === ownerKey() && context.view === viewKey();
    const current = context => dialog === context && generation === context.generation && sameOwner(context);
    const text = (element, value) => { const next = String(value ?? ""); if (element.textContent !== next) element.textContent = next; };
    const node = (tag, className, value) => {
      const element = doc.createElement(tag);
      if (className) element.className = className;
      if (value !== undefined) element.textContent = value;
      return element;
    };
    const sourceKind = source => source?.dataset?.calendarKind || source?.dataset?.calendarTaskKind || (source?.classList?.contains("deadline-chip") ? "deadline" : source?.classList?.contains("calendar-event-block") ? "work" : "");
    function sourceFor(context) {
      if (context.source?.isConnected) return context.source;
      const calendar = doc.querySelector("#planner-calendar");
      return [...(calendar?.querySelectorAll("[data-edit-task],[data-calendar-preview-task],[data-calendar-drag-task]") || [])]
        .find(element => [element.dataset.editTask, element.dataset.calendarPreviewTask, element.dataset.calendarDragTask].some(id => String(id) === context.id)
          && (!context.kind || sourceKind(element) === context.kind)) || null;
    }
    function retire(context, { restoreFocus = true, afterClose } = {}) {
      if (dialog !== context) return;
      const canRestore = sameOwner(context);
      dialog = null; generation += 1;
      motion?.cancel?.(context.element);
      if (context.element.open) context.element.close();
      context.element.remove();
      if (canRestore && restoreFocus) (sourceFor(context) || doc.querySelector("#calendar-today") || doc.querySelector("#planner-calendar"))?.focus({ preventScroll: true });
      if (canRestore) afterClose?.();
    }
    function close({ immediate = false, restoreFocus = true, afterClose } = {}) {
      const context = dialog;
      if (!context) return;
      if (immediate) { retire(context, { restoreFocus, afterClose }); return; }
      if (context.closing) return;
      context.closing = true; context.element.inert = true;
      const replacement = sourceFor(context);
      if (replacement && replacement !== context.source) context.anchor = motion?.capture?.(replacement) || context.anchor;
      const finish = () => retire(context, { restoreFocus, afterClose });
      if (motion?.close) motion.close(context.element, context.anchor, finish); else finish();
    }
    function workLabel(timing, task) {
      if (!timing.workStart) return "Not scheduled";
      const shortDate = host.formatShortDate || (value => value), time = host.formatTime || (value => value);
      const [startDate, startTime] = timing.workStart.split("T");
      if (!timing.workEnd) return `${shortDate(startDate)} · ${time(startTime)} · ${task.durationMinutes || 45} min`;
      const [endDate, endTime] = timing.workEnd.split("T");
      return `${shortDate(startDate)} · ${time(startTime)}–${endDate === startDate ? "" : `${shortDate(endDate)} · `}${time(endTime)}`;
    }
    function render(context, task) {
      const fields = context.fields, info = host.classInfo?.(task) || {};
      const timing = model.taskTiming(task);
      text(fields.title, task.title || "Untitled task");
      text(fields.meta, `${info.name || "Personal"} · ${task.priority || "Medium"} priority · ${task.durationMinutes || 45} min`);
      fields.meta.style.setProperty("--calendar-preview-class-color", info.color || "var(--muted)");
      text(fields.status, context.busy ? context.pendingCompleted ? "Marking complete…" : "Marking incomplete…" : task.completed ? "Completed" : "Not completed");
      fields.status.dataset.completed = String(Boolean(task.completed));
      text(fields.work, workLabel(timing, task));
      const dueDate = timing.deadlineAt?.split("T")[0], dueTime = timing.deadlineAt?.split("T")[1];
      text(fields.due, dueDate ? `${(host.formatLongDate || (value => value))(dueDate)} · ${task.dueTime ? (host.formatTime || (value => value))(dueTime) : "End of day"}` : "No deadline");
      const warning = [timing.overdue ? "Overdue." : "", timing.plannedAfterDeadline ? "Work ends after the deadline." : ""].filter(Boolean).join(" ");
      text(fields.warning, warning); fields.warning.hidden = !warning;
      text(fields.notes, task.notes || ""); fields.notesSection.hidden = !String(task.notes || "").trim();
      text(fields.complete, context.busy ? "Saving…" : task.completed ? "Mark incomplete" : "Mark complete");
      for (const button of [fields.edit, fields.reschedule, fields.complete]) button.disabled = context.busy;
      if (context.busy) context.element.setAttribute("aria-busy", "true"); else context.element.removeAttribute("aria-busy");
    }
    function sync() {
      const context = dialog;
      if (!context) return;
      if (!sameOwner(context)) { close({ immediate: true, restoreFocus: false }); return; }
      const task = taskFor(context.id);
      if (!task) { close({ immediate: true }); return; }
      if (!context.closing) render(context, task);
    }
    async function complete(context) {
      if (!current(context) || context.busy || context.closing) return;
      const task = taskFor(context.id);
      if (!task) { close({ immediate: true }); return; }
      context.busy = true; context.pendingCompleted = !task.completed;
      context.fields.error.hidden = true; text(context.fields.error, "");
      render(context, task);
      try {
        await store.toggleComplete(task.id, context.pendingCompleted);
        if (!current(context) || context.closing) return;
        host.showToast?.(context.pendingCompleted ? "Task completed." : "Task reopened.");
      } catch (error) {
        if (!current(context) || context.closing) return;
        text(context.fields.error, error.message || "Could not update this task. Try again.");
        context.fields.error.hidden = false;
        host.reportError?.(error);
      } finally {
        if (current(context) && !context.closing) {
          context.busy = false; sync();
          if (current(context)) context.fields.complete.focus({ preventScroll: true });
        }
      }
    }
    function handoff(context, reschedule) {
      if (!current(context) || context.busy || context.closing) return;
      if (!taskFor(context.id)) { close({ immediate: true }); return; }
      close({ restoreFocus: false, afterClose: () => {
        if (!taskFor(context.id)) return;
        host.openTask?.({ id: context.id, source: sourceFor(context) || doc.querySelector("#calendar-today"), ...(reschedule ? { reschedule: true } : {}) });
      } });
    }
    function open(taskID, source) {
      if (destroyed) return false;
      const id = String(taskID), task = taskFor(id);
      if (!task) return false;
      if (dialog && current(dialog) && dialog.id === id && !dialog.closing) { sync(); return true; }
      close({ immediate: true, restoreFocus: false });
      const element = node("dialog", "calendar-task-preview");
      element.id = "calendar-task-preview"; element.tabIndex = -1;
      element.setAttribute("aria-labelledby", "calendar-preview-title");
      element.setAttribute("aria-describedby", "calendar-preview-status");
      const card = node("article", "calendar-preview-card"), heading = node("header", "calendar-preview-heading"), headingText = node("div");
      const title = node("h2"); title.id = "calendar-preview-title";
      const meta = node("p", "calendar-preview-meta"), dismiss = node("button", "close-button", "×");
      dismiss.type = "button"; dismiss.setAttribute("aria-label", "Close task preview");
      headingText.append(node("p", "calendar-preview-kicker", "Task details"), title, meta); heading.append(headingText, dismiss);
      const status = node("p", "calendar-preview-status"); status.id = "calendar-preview-status"; status.setAttribute("role", "status");
      const dates = node("dl", "calendar-preview-dates"), work = node("dd"), due = node("dd");
      for (const [label, value] of [["Work", work], ["Due", due]]) { const row = node("div"); row.append(node("dt", "", label), value); dates.append(row); }
      const warning = node("p", "calendar-preview-warning"); warning.setAttribute("role", "status");
      const notesSection = node("section", "calendar-preview-notes"), notes = node("p"); notesSection.append(node("h3", "", "Notes"), notes);
      const error = node("p", "calendar-preview-error"); error.setAttribute("role", "alert"); error.hidden = true;
      const actions = node("footer", "calendar-preview-actions"), edit = node("button", "secondary-button", "Edit"), reschedule = node("button", "secondary-button", "Reschedule"), completeButton = node("button", "primary-button", "Mark complete");
      for (const [button, name] of [[edit, "edit"], [reschedule, "reschedule"], [completeButton, "complete"]]) { button.type = "button"; button.id = `calendar-preview-${name}`; }
      actions.append(edit, reschedule, completeButton); card.append(heading, status, dates, warning, notesSection, error, actions); element.append(card);
      const context = { id, source, kind: sourceKind(source), owner: ownerKey(), view: viewKey(), generation: ++generation, element,
        fields: { title, meta, status, work, due, warning, notesSection, notes, error, edit, reschedule, complete: completeButton },
        busy: false, closing: false, anchor: motion?.capture?.(source) || null };
      dialog = context; render(context, task);
      element.addEventListener("cancel", event => { event.preventDefault(); if (dialog === context) close(); });
      element.addEventListener("close", () => { if (dialog === context) retire(context); });
      element.addEventListener("click", event => {
        const button = event.target.closest?.("button");
        if (button === dismiss) close();
        else if (button === edit) handoff(context, false);
        else if (button === reschedule) handoff(context, true);
        else if (button === completeButton) return complete(context);
        else if (event.target === element) {
          const bounds = element.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
        }
      });
      element.addEventListener("keydown", event => {
        if (event.key !== "Tab" || !current(context) || context.closing) return;
        const controls = [...element.querySelectorAll("button,[href],[tabindex]")].filter(control => !control.disabled && !control.hidden && control.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); element.focus(); return; }
        if (event.shiftKey && doc.activeElement === first || !event.shiftKey && doc.activeElement === last || !controls.includes(doc.activeElement)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      });
      doc.body.append(element); host.setupButtons?.(element); element.showModal();
      const focus = () => { if (current(context) && !context.closing) dismiss.focus({ preventScroll: true }); };
      if (motion?.open) motion.open(element, context.anchor, focus); else focus();
      return true;
    }
    return {
      open, close, sync,
      get isOpen() { return Boolean(dialog?.element.open); },
      destroy() { destroyed = true; close({ immediate: true, restoreFocus: false }); },
    };
  }
  return { create };
});
