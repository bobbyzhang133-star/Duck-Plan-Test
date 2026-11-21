/* Touch period navigation without taking over vertical scroll or task dragging. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCalendarSwipe = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function create({ roots = [], getScroller, enabled, getContext, ignoreTarget, navigate, now = () => performance.now() } = {}) {
    const targets = [...new Set(roots.filter(Boolean))];
    let gesture = null, suppressUntil = 0, destroyed = false;
    const valid = () => !destroyed && enabled?.();
    function cancel() {
      if (gesture?.axis === "horizontal") suppressUntil = now() + 650;
      gesture = null;
    }
    function start(event) {
      cancel();
      if (!valid() || event.touches.length !== 1 || ignoreTarget?.(event.target)) return;
      suppressUntil = 0; // A fresh deliberate touch is not the previous swipe's compatibility click.
      const finger = event.touches[0], root = event.currentTarget;
      const surface = getScroller?.();
      gesture = { id: finger.identifier, root, context: getContext?.(), x: finger.clientX, y: finger.clientY,
        dx: 0, dy: 0, axis: null, started: now(), left: surface?.scrollLeft || 0,
        maxLeft: Math.max(0, (surface?.scrollWidth || 0) - (surface?.clientWidth || 0)) };
    }
    function move(event) {
      const state = gesture;
      if (!state) return;
      if (!valid() || getContext?.() !== state.context || event.touches.length !== 1) { cancel(); return; }
      const finger = [...event.touches].find(touch => touch.identifier === state.id);
      if (!finger) { cancel(); return; }
      state.dx = finger.clientX - state.x; state.dy = finger.clientY - state.y;
      if (!state.axis && Math.max(Math.abs(state.dx), Math.abs(state.dy)) >= 12) {
        if (Math.abs(state.dy) >= Math.abs(state.dx)) state.axis = "vertical";
        else if (Math.abs(state.dx) >= Math.abs(state.dy) * 1.4) {
          // Inside a wide iPad timetable, pan normally. A fresh outward
          // gesture at its edge can navigate to another period.
          const room = state.dx < 0 ? state.left < state.maxLeft - 2 : state.left > 2;
          state.axis = state.maxLeft > 2 && room ? "native" : "horizontal";
        }
      }
      if (state.axis === "horizontal") {
        if (!event.cancelable) { cancel(); return; }
        event.preventDefault(); event.stopPropagation();
      }
    }
    function end(event) {
      const state = gesture;
      if (!state) return;
      const finger = [...(event.changedTouches || [])].find(touch => touch.identifier === state.id);
      if (finger) { state.dx = finger.clientX - state.x; state.dy = finger.clientY - state.y; }
      const horizontal = state.axis === "horizontal";
      const threshold = Math.min(88, Math.max(48, (state.root.clientWidth || 400) * .12));
      const commit = horizontal && valid() && getContext?.() === state.context && event.touches.length === 0
        && now() - state.started <= 1200 && Math.abs(state.dx) >= threshold && Math.abs(state.dx) >= Math.abs(state.dy) * 1.4;
      cancel();
      if (horizontal && event.cancelable) event.preventDefault();
      if (commit) navigate?.(state.dx < 0 ? 1 : -1);
    }
    function click(event) {
      // Discard only the compatibility pointer click, never keyboard activation.
      if (now() < suppressUntil && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
    }
    const bindings = [["touchstart", start, { passive: true, capture: true }],
      ["touchmove", move, { passive: false, capture: true }], ["touchend", end, { passive: false, capture: true }],
      ["touchcancel", cancel, { passive: true, capture: true }], ["click", click, true]];
    for (const target of targets) for (const [type, handler, options] of bindings) target.addEventListener(type, handler, options);
    return { cancel, destroy() {
      destroyed = true; cancel();
      for (const target of targets) for (const [type, handler, options] of bindings) target.removeEventListener(type, handler, options);
    } };
  }
  return { create };
});
