(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DuckViewTransitions = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function direction(order, from, to) {
    const previous = order.indexOf(from);
    const next = order.indexOf(to);
    return previous < 0 || next < 0 ? 0 : Math.sign(next - previous);
  }

  function create({ window: win, workspace, order }) {
    const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)");
    let running = null;
    let pointerHeld = false;
    let releaseTimer = null;

    function cancel() {
      win.clearTimeout(releaseTimer);
      releaseTimer = null;
      pointerHeld = false;
      if (!running) return;
      const current = running;
      running = null;
      delete current.view.dataset.viewMotion;
      current.animation.cancel();
    }

    function enter(from, to, view) {
      cancel();
      const movement = direction(order, from, to);
      if (!movement || reducedMotion.matches || typeof view.animate !== "function") return;

      // Lower navigation items travel down into place; upper items travel up.
      // Only the incoming live view moves, so hidden forms/IDs are never duplicated.
      const animation = view.animate([
        { transform: `translateY(${-movement * 48}px)`, opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ], {
        duration: win.DuckMotion?.duration.layout || 480,
        easing: win.DuckMotion?.easing || "cubic-bezier(.2,.8,.2,1)",
        fill: "both",
      });
      const current = { view, animation };
      running = current;
      view.dataset.viewMotion = movement > 0 ? "down" : "up";
      const finish = () => { if (running === current) cancel(); };
      animation.finished.then(finish, finish);
    }

    // Hold the touched target still through pointer-up. Settling on pointer-down
    // could move it away from the release point and swallow a fast phone tap.
    function holdPointer() {
      if (!running) return;
      pointerHeld = true;
      running.animation.pause();
    }
    function releasePointer() {
      if (!pointerHeld) return;
      win.clearTimeout(releaseTimer);
      const current = running;
      releaseTimer = win.setTimeout(() => { if (running === current) cancel(); }, 0);
    }
    function focusContent() { if (!pointerHeld) cancel(); }
    // Click capture settles before the popup's own anchor measurements. Keyboard
    // focus and scroll gestures also settle immediately, without a navigation wait.
    const contentEvents = { pointerdown: holdPointer, focusin: focusContent, click: cancel, wheel: cancel, touchmove: cancel, keydown: cancel };
    Object.entries(contentEvents).forEach(([type, handler]) => workspace.addEventListener(type, handler, { capture: true, passive: true }));
    reducedMotion.addEventListener("change", cancel);
    win.addEventListener("pointerup", releasePointer, true);
    win.addEventListener("pointercancel", cancel, true);
    win.addEventListener("blur", cancel);
    win.addEventListener("resize", cancel);
    win.addEventListener("pagehide", cancel);

    return Object.freeze({
      enter, cancel,
      destroy() {
        cancel();
        Object.entries(contentEvents).forEach(([type, handler]) => workspace.removeEventListener(type, handler, true));
        reducedMotion.removeEventListener("change", cancel);
        win.removeEventListener("pointerup", releasePointer, true);
        win.removeEventListener("pointercancel", cancel, true);
        win.removeEventListener("blur", cancel);
        win.removeEventListener("resize", cancel);
        win.removeEventListener("pagehide", cancel);
      },
    });
  }

  return Object.freeze({ create, direction });
});
