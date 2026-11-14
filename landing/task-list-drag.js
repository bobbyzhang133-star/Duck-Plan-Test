(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckTaskListDrag = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TASK_MIME = "application/x-duckplan-task-id";
  const SOURCE = "button[data-drag-task]";
  const CALENDAR = '.nav-item[data-view="calendar"], [data-go="calendar"]';

  function create({ window: win, document: doc = win.document, getTask, getOwner = () => "local", getPlacement, showPreview, clearPreview, schedule, openCalendar }) {
    let active = null, hover = null, suppressed = null, destroyed = false;
    const now = () => win.performance?.now?.() ?? Date.now();
    const sameTask = (task, id) => task && String(task.id) === id;
    const hidePreview = () => { try { clearPreview?.(); } catch { /* Cleanup must also survive a failed preview callback. */ } };
    function clearHover() {
      if (hover?.timer != null) win.clearTimeout(hover.timer);
      hover = null;
    }
    function retire(current, suppress = true) {
      if (active !== current) return;
      active = null;
      current?.source.classList?.remove("is-drag-source");
      clearHover(); hidePreview();
      if (suppress && current) suppressed = { id: current.id, owner: current.owner, until: now() + 650 };
    }
    function cancel() {
      if (active) retire(active);
      else clearHover();
    }
    function currentTask(current) {
      if (!current || active !== current) return null;
      try {
        if (current.owner !== getOwner()) { retire(current); return null; }
        const task = getTask(current.id);
        if (!sameTask(task, current.id)) { retire(current); return null; }
        return task;
      } catch { retire(current); return null; }
    }
    function transferTask(event, dropping = false) {
      const current = active;
      if (!current) return null;
      try {
        const transfer = event.dataTransfer;
        if (!Array.from(transfer?.types || []).includes(TASK_MIME)) { retire(current); return null; }
        // Browsers hide payload values during dragover. A drop must expose the
        // exact ID from this controller's own active drag, never an external ID.
        const id = transfer.getData(TASK_MIME);
        if ((dropping && id !== current.id) || (id && id !== current.id)) { retire(current); return null; }
      } catch { retire(current); return null; }
      const task = currentTask(current);
      return task ? { current, task } : null;
    }
    function setDropEffect(event, value) {
      try { event.dataTransfer.dropEffect = value; } catch { /* Some transports expose a readonly transfer. */ }
    }
    function trackCalendarHover(event, current) {
      const target = typeof openCalendar === "function" ? event.target.closest?.(CALENDAR) : null;
      if (!target) { clearHover(); return; }
      if (hover?.target === target && hover.current === current) return;
      clearHover();
      const pending = hover = { target, current, timer: null };
      pending.timer = win.setTimeout(() => {
        if (hover !== pending || !currentTask(current)) return;
        pending.timer = null;
        try { openCalendar(target); } catch { retire(current); }
      }, 400);
    }
    function start(event) {
      if (destroyed || event.defaultPrevented) return;
      if (active || hover) cancel();
      suppressed = null;
      const source = event.target.closest?.(SOURCE);
      if (!source) return;
      const id = String(source.dataset.dragTask || "");
      try {
        const task = id && getTask(id), owner = getOwner();
        if (!sameTask(task, id) || !event.dataTransfer?.setData) { event.preventDefault(); return; }
        event.dataTransfer.clearData?.();
        event.dataTransfer.setData(TASK_MIME, id);
        event.dataTransfer.effectAllowed = "move";
        active = { id, owner, source };
        source.classList?.add("is-drag-source");
      } catch { event.preventDefault(); cancel(); }
    }
    function over(event) {
      const session = transferTask(event);
      if (!session) return;
      const { current, task } = session;
      try {
        trackCalendarHover(event, current);
        const placement = getPlacement(event, task);
        if (!currentTask(current)) return;
        if (!placement) { setDropEffect(event, "none"); hidePreview(); return; }
        showPreview?.(task, placement);
        if (active !== current) return;
        event.preventDefault(); setDropEffect(event, "move");
      } catch { retire(current); }
    }
    function drop(event) {
      const session = transferTask(event, true);
      if (!session) return;
      const { current, task } = session;
      try {
        const placement = getPlacement(event, task);
        const latest = currentTask(current);
        if (!latest) return;
        if (!placement) { setDropEffect(event, "none"); retire(current); return; }
        event.preventDefault(); setDropEffect(event, "move");
        // Retire before calling host code: duplicate drops cannot write twice,
        // and a later rejection cannot clear a newer drag's preview or timer.
        retire(current);
        Promise.resolve(schedule(latest, placement)).catch(() => {});
      } catch { retire(current); }
    }
    function leave(event) {
      if (!hover || !hover.target.contains?.(event.target)) return;
      if (!event.relatedTarget || !hover.target.contains(event.relatedTarget)) clearHover();
    }
    function click(event) {
      if (!suppressed) return;
      try {
        if (now() >= suppressed.until || getOwner() !== suppressed.owner) { suppressed = null; return; }
        // Keyboard activation remains available immediately after a drag.
        if (event.detail === 0 || event.target.closest?.(SOURCE)?.dataset.dragTask !== suppressed.id) return;
        suppressed = null;
        event.preventDefault(); event.stopImmediatePropagation();
      } catch { suppressed = null; }
    }
    function keydown(event) { if (event.key === "Escape") cancel(); }
    function pointerdown() { suppressed = null; }
    const documentEvents = { dragstart: start, dragenter: over, dragover: over, drop, dragleave: leave, dragend: cancel, keydown, pointerdown };
    Object.entries(documentEvents).forEach(([name, handler]) => doc.addEventListener(name, handler));
    doc.addEventListener("click", click, true);
    win.addEventListener("blur", cancel); win.addEventListener("pagehide", cancel);
    return Object.freeze({ cancel, destroy() {
      if (destroyed) return;
      destroyed = true; cancel(); suppressed = null;
      Object.entries(documentEvents).forEach(([name, handler]) => doc.removeEventListener(name, handler));
      doc.removeEventListener("click", click, true);
      win.removeEventListener("blur", cancel); win.removeEventListener("pagehide", cancel);
    } });
  }

  return Object.freeze({ TASK_MIME, create });
});
