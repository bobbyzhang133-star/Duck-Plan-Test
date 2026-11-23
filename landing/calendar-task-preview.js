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
    const onResize = () => { if (dialog?.type === "day-list") close({ immediate: true }); };
    doc.defaultView?.addEventListener?.("resize", onResize);
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
    const sourceKind = source => source?.dataset?.calendarKind || source?.dataset?.calendarTaskKind || (source?.dataset?.dayList === "due" ? "deadline" : source?.dataset?.dayList === "work" ? "work" : source?.dataset?.timedDeadlineGroup || source?.classList?.contains("deadline-chip") ? "deadline" : source?.classList?.contains("calendar-event-block") ? "work" : "");
    function daySource(date, kind, phone = false) {
      const root = doc.querySelector("#view-calendar") || doc.querySelector("#planner-calendar");
      const sources = [...(root?.querySelectorAll("[data-day-list]") || [])]
        .filter(element => element.dataset.summaryDate === date && element.dataset.dayList === kind);
      return sources.find(element => Boolean(element.closest("#phone-week-strip")) === phone) || sources[0] || null;
    }
    function groupSource(key, date) {
      const calendar = doc.querySelector("#planner-calendar");
      return [...(calendar?.querySelectorAll("[data-timed-deadline-group]") || [])]
        .find(element => element.dataset.timedDeadlineGroup === key && element.dataset.deadlineDate === date) || null;
    }
    function sourceFor(context) {
      if (context.source?.isConnected) return context.source;
      if (context.type === "deadline-group") return groupSource(context.key, context.date);
      if (context.type === "day-list") return daySource(context.date, context.kind, context.phoneSource);
      const calendar = doc.querySelector("#planner-calendar");
      return [...(calendar?.querySelectorAll("[data-edit-task],[data-calendar-preview-task],[data-calendar-drag-task]") || [])]
        .find(element => [element.dataset.editTask, element.dataset.calendarPreviewTask, element.dataset.calendarDragTask].some(id => String(id) === context.id)
          && (!context.kind || sourceKind(element) === context.kind))
        || (context.returnGroup ? groupSource(context.returnGroup.key, context.returnGroup.date) : null)
        || (context.returnDayList ? daySource(context.returnDayList.date, context.returnDayList.kind, context.returnDayList.phone) : null);
    }
    function expandGroup(context, expanded) {
      if (!["deadline-group", "day-list"].includes(context.type)) return;
      for (const source of new Set([context.source, sourceFor(context)])) {
        if (!source) continue;
        source.setAttribute("aria-expanded", String(expanded));
        if (expanded) source.setAttribute("aria-controls", context.element.id); else source.removeAttribute("aria-controls");
      }
    }
    function retire(context, { restoreFocus = true, afterClose } = {}) {
      if (dialog !== context) return;
      const canRestore = sameOwner(context);
      expandGroup(context, false);
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
      if (context.type === "deadline-group") {
        const group = deadlineGroupFor(context);
        if (!group) { close({ immediate: true }); return; }
        if (!context.closing) renderDeadlineGroup(context, group);
        return;
      }
      if (context.type === "day-list") {
        const group = dayGroupFor(context);
        if (!group) { close({ immediate: true }); return; }
        if (!context.closing) { renderDeadlineGroup(context, group); if (!context.element.dataset.popupMotion) positionDayList(context); }
        return;
      }
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
    function deadlineGroupFor(context) {
      const group = host.getDeadlineGroup ? host.getDeadlineGroup(context.key, context.date) : context.initialGroup;
      if (!group || String(group.key) !== context.key || group.date !== context.date) return null;
      const tasks = [...new Set((group.tasks || []).map(task => String(task.id)))].map(taskFor)
        .filter(task => task && !task.completed && task.dueDate === context.date && task.dueTime)
        .sort((a, b) => a.dueTime.localeCompare(b.dueTime) || String(a.title).localeCompare(String(b.title)) || String(a.id).localeCompare(String(b.id)));
      return tasks.length ? { ...group, tasks } : null;
    }
    function dayGroupFor({ date, kind }) {
      if (!["work", "due"].includes(kind) || typeof date !== "string") return null;
      const parsed = model.fromDateKey(date);
      if (!parsed || model.toDateKey(parsed) !== date) return null;
      const rows = new Map();
      for (const task of store.listItems()) {
        if (!task || task.completed || task.deleted || task.deleted_at) continue;
        if ((kind === "work" ? model.scheduledParts(task)?.date : task.dueDate) !== date) continue;
        rows.set(String(task.id), task);
      }
      const tasks = [...rows.values()].sort((a, b) => {
        const time = task => kind === "work" ? model.scheduledParts(task).time : task.dueTime || "24:00";
        return time(a).localeCompare(time(b)) || String(a.title).localeCompare(String(b.title)) || String(a.id).localeCompare(String(b.id));
      });
      return { date, kind, tasks };
    }
    function listTime(context, task) {
      const format = host.formatTime || (value => value);
      if (context.kind !== "work") return task.dueTime ? /^([01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime) ? format(task.dueTime) : "Time unavailable" : "End of day";
      const start = model.scheduledParts(task), end = model.scheduledEndAt(task);
      return `${format(start.time)}–${format(end?.slice(11, 16) || model.scheduledEnd(task))}${end && end.slice(0, 10) > start.date ? " (+1 day)" : ""}`;
    }
    function renderDeadlineGroup(context, group) {
      const fields = context.fields, count = group.tasks.length, formatTime = host.formatTime || (value => value);
      const work = context.type === "day-list" && context.kind === "work", noun = work ? "work session" : "deadline";
      const action = context.type === "deadline-group" ? "Edit task" : "View task details";
      text(fields.title, `${count} ${noun}${count === 1 ? "" : "s"}`);
      text(fields.meta, (host.formatLongDate || (value => value))(context.date));
      text(fields.status, count ? `${count} unfinished ${count === 1 ? "task" : "tasks"}. Select a task to ${context.type === "deadline-group" ? "edit it" : "view its details"}.` : `No remaining ${work ? "work sessions" : "deadlines"} for this day.`);
      const signature = JSON.stringify(group.tasks.map(task => String(task.id)));
      const focusedID = doc.activeElement?.dataset?.deadlinePreviewTask;
      for (const task of group.tasks) {
        const id = String(task.id);
        let row = fields.rows.get(id);
        if (!row) {
          const item = node("li"), button = node("button", "calendar-deadline-group-item"); button.type = "button"; button.dataset.deadlinePreviewTask = id;
          const time = node("time", "calendar-deadline-group-time"), title = node("strong", "calendar-deadline-group-task-title");
          button.append(time, title); item.append(button); row = { item, button, time, title }; fields.rows.set(id, row);
        }
        const time = context.type === "day-list" ? listTime(context, task) : formatTime(task.dueTime);
        text(row.title, task.title || "Untitled task"); text(row.time, time);
        row.time.setAttribute("datetime", work ? `${context.date}T${model.scheduledParts(task).time}` : task.dueTime ? `${context.date}T${task.dueTime}` : context.date);
        row.button.setAttribute("aria-label", `${task.title || "Untitled task"}. ${work ? "Work" : "Deadline"}: ${time}. ${action}.`);
      }
      if (signature !== context.rowSignature) {
        fields.list.textContent = "";
        for (const task of group.tasks) fields.list.append(fields.rows.get(String(task.id)).item);
        const active = new Set(group.tasks.map(task => String(task.id)));
        for (const id of fields.rows.keys()) if (!active.has(id)) fields.rows.delete(id);
        context.rowSignature = signature;
        if (context.element.isConnected) {
          host.setupButtons?.(context.element);
          if (focusedID) (fields.rows.get(focusedID)?.button || fields.dismiss).focus({ preventScroll: true });
        }
      }
      expandGroup(context, true);
    }
    function chooseDeadline(context, id) {
      if (!current(context) || context.closing) return;
      const latest = () => context.type === "day-list" ? dayGroupFor(context) : deadlineGroupFor(context);
      if (!latest()?.tasks.some(task => String(task.id) === id)) { sync(); return; }
      close({ restoreFocus: false, afterClose: () => {
        if (!sameOwner(context) || !latest()?.tasks.some(task => String(task.id) === id)) return;
        host.onSelectTask?.(id);
        if (!sameOwner(context)) return;
        const source = sourceFor(context) || doc.querySelector("#calendar-today");
        if (context.type === "deadline-group") host.openTask?.({ id, source, fade: true });
        else open(id, source);
      } });
    }
    function positionDayList(context) {
      if (context.type !== "day-list") return;
      const viewport = doc.defaultView;
      if (!viewport?.innerWidth || !viewport.innerHeight) return;
      const rect = context.element.getBoundingClientRect(), source = sourceFor(context)?.getBoundingClientRect();
      if (!source) return;
      const margin = 14, gap = 8, width = rect.width, height = rect.height;
      const left = source.left >= width + gap + margin ? source.left - width - gap
        : source.right + width + gap <= viewport.innerWidth - margin ? source.right + gap : source.left;
      Object.assign(context.element.style, { margin: "0", right: "auto", bottom: "auto",
        left: `${Math.max(margin, Math.min(viewport.innerWidth - width - margin, left))}px`,
        top: `${Math.max(margin, Math.min(viewport.innerHeight - height - margin, source.top))}px` });
    }
    function show(context, dismiss, onClick) {
      const element = context.element;
      element.addEventListener("cancel", event => { event.preventDefault(); if (dialog === context) close(); });
      element.addEventListener("close", () => { if (dialog === context) retire(context); });
      element.addEventListener("click", event => {
        if (!current(context) || context.closing) return;
        const button = event.target.closest?.("button");
        if (button === dismiss) close();
        else if (button) return onClick(button);
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
      doc.body.append(element); host.setupButtons?.(element); element.showModal(); positionDayList(context);
      const focus = () => { if (current(context) && !context.closing) dismiss.focus({ preventScroll: true }); };
      if (motion?.open) motion.open(element, context.anchor, focus); else focus();
    }
    function openDayList(date, kind, source) {
      if (destroyed) return false;
      const group = dayGroupFor({ date, kind });
      if (!group?.tasks.length) return false;
      if (dialog?.type === "day-list" && current(dialog) && dialog.date === date && dialog.kind === kind && !dialog.closing) { sync(); return true; }
      close({ immediate: true, restoreFocus: false });
      const element = node("dialog", "calendar-task-preview calendar-day-list-preview"); element.id = "calendar-task-preview"; element.tabIndex = -1;
      element.dataset.dayListKind = kind; element.setAttribute("aria-labelledby", "calendar-preview-title"); element.setAttribute("aria-describedby", "calendar-preview-status");
      const card = node("article", "calendar-preview-card"), heading = node("header", "calendar-preview-heading"), headingText = node("div");
      const title = node("h2"); title.id = "calendar-preview-title";
      const meta = node("p", "calendar-preview-meta"), dismiss = node("button", "close-button", "×"); dismiss.type = "button"; dismiss.setAttribute("aria-label", kind === "work" ? "Close work list" : "Close due list");
      headingText.append(node("p", "calendar-preview-kicker", kind === "work" ? "Scheduled work" : "Deadlines"), title, meta); heading.append(headingText, dismiss);
      const status = node("p", "calendar-preview-status"); status.id = "calendar-preview-status"; status.setAttribute("role", "status");
      const list = node("ul", "calendar-deadline-group-list"); card.append(heading, status, list); element.append(card);
      const context = { type: "day-list", date, kind, source, phoneSource: Boolean(source?.closest?.("#phone-week-strip")), owner: ownerKey(), view: viewKey(), generation: ++generation, element,
        fields: { title, meta, status, list, dismiss, rows: new Map() }, closing: false, anchor: motion?.capture?.(source) || null };
      dialog = context; renderDeadlineGroup(context, group);
      show(context, dismiss, button => { if (button.dataset.deadlinePreviewTask) chooseDeadline(context, button.dataset.deadlinePreviewTask); });
      return true;
    }
    function openDeadlineGroup(group, source) {
      if (destroyed || !group?.key || !group.date) return false;
      const key = String(group.key), date = String(group.date), latest = deadlineGroupFor({ key, date, initialGroup: group });
      if (!latest) return false;
      if (dialog?.type === "deadline-group" && current(dialog) && dialog.key === key && dialog.date === date && !dialog.closing) { sync(); return true; }
      close({ immediate: true, restoreFocus: false });
      const element = node("dialog", "calendar-task-preview calendar-deadline-group-preview"); element.id = "calendar-task-preview"; element.tabIndex = -1;
      element.setAttribute("aria-labelledby", "calendar-preview-title"); element.setAttribute("aria-describedby", "calendar-preview-status");
      const card = node("article", "calendar-preview-card"), heading = node("header", "calendar-preview-heading"), headingText = node("div");
      const title = node("h2"); title.id = "calendar-preview-title";
      const meta = node("p", "calendar-preview-meta"), dismiss = node("button", "close-button", "×"); dismiss.type = "button"; dismiss.setAttribute("aria-label", "Close deadline list");
      headingText.append(node("p", "calendar-preview-kicker", "Timed deadlines"), title, meta); heading.append(headingText, dismiss);
      const status = node("p", "calendar-preview-status"); status.id = "calendar-preview-status"; status.setAttribute("role", "status");
      const list = node("ul", "calendar-deadline-group-list"); card.append(heading, status, list); element.append(card);
      const context = { type: "deadline-group", key, date, initialGroup: group, source, owner: ownerKey(), view: viewKey(), generation: ++generation, element,
        fields: { title, meta, status, list, dismiss, rows: new Map() }, closing: false, anchor: motion?.capture?.(source) || null };
      dialog = context; renderDeadlineGroup(context, latest);
      show(context, dismiss, button => { if (button.dataset.deadlinePreviewTask) chooseDeadline(context, button.dataset.deadlinePreviewTask); });
      return true;
    }
    function open(taskID, source) {
      if (destroyed) return false;
      const id = String(taskID), task = taskFor(id);
      if (!task) return false;
      if (dialog && dialog.type !== "deadline-group" && current(dialog) && dialog.id === id && !dialog.closing) { sync(); return true; }
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
        returnGroup: source?.dataset?.timedDeadlineGroup ? { key: source.dataset.timedDeadlineGroup, date: source.dataset.deadlineDate } : null,
        returnDayList: source?.dataset?.dayList ? { date: source.dataset.summaryDate, kind: source.dataset.dayList, phone: Boolean(source.closest?.("#phone-week-strip")) } : null,
        fields: { title, meta, status, work, due, warning, notesSection, notes, error, edit, reschedule, complete: completeButton },
        busy: false, closing: false, anchor: motion?.capture?.(source) || null };
      dialog = context; render(context, task);
      show(context, dismiss, button => {
        if (button === edit) handoff(context, false);
        else if (button === reschedule) handoff(context, true);
        else if (button === completeButton) return complete(context);
      });
      return true;
    }
    return {
      open, openDeadlineGroup, openDayList, close, sync,
      get isOpen() { return Boolean(dialog?.element.open); },
      destroy() { destroyed = true; doc.defaultView?.removeEventListener?.("resize", onResize); close({ immediate: true, restoreFocus: false }); },
    };
  }
  return { create };
});
