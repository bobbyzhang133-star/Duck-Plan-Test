(function completionRenderHoldFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCompletionRenderHold = api;
})(typeof window !== "undefined" ? window : globalThis, function buildCompletionRenderHold() {
  "use strict";

  // Hold presentation only. Persistence and the store's canonical task state continue normally.
  function create({ getContext, schedule = setTimeout, unschedule = clearTimeout }) {
    const holds = new Set();
    let render = null, after = [];
    function flush() {
      if (holds.size) return;
      const next = render, callbacks = after;
      render = null; after = [];
      callbacks.forEach(hold => hold.beforeRender?.());
      next?.();
      callbacks.forEach(hold => hold.afterRelease?.());
    }
    function release(hold, cancelled) {
      if (!holds.delete(hold)) return;
      unschedule(hold.timer);
      hold.onRelease?.({ cancelled });
      if (!cancelled && (hold.beforeRender || hold.afterRelease)) after.push(hold);
      flush();
    }
    function cancel({ flush: shouldFlush = true } = {}) {
      const pending = render;
      render = null; after = [];
      const pendingHolds = [...holds];
      holds.clear();
      for (const hold of pendingHolds) {
        unschedule(hold.timer);
        hold.onRelease?.({ cancelled: true });
      }
      if (shouldFlush) pending?.();
    }
    return Object.freeze({
      hold({ duration, onRelease, beforeRender, afterRelease }) {
        const hold = { context: getContext(), onRelease, beforeRender, afterRelease, timer: null };
        holds.add(hold);
        hold.timer = schedule(() => release(hold, false), duration);
        return Object.freeze({ finish: () => release(hold, false), cancel: () => release(hold, true) });
      },
      deferRender(next) {
        if (!holds.size) return false;
        if ([...holds].some(hold => hold.context !== getContext())) { cancel({ flush: false }); return false; }
        render = next;
        return true;
      },
      cancel,
      get active() { return holds.size; }
    });
  }
  return Object.freeze({ create });
});
