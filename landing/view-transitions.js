(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DuckViewTransitions = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function direction(order, from, to) {
    const previous = order.indexOf(from), next = order.indexOf(to);
    return previous < 0 || next < 0 ? 0 : Math.sign(next - previous);
  }
  function create({ window: win, workspace, order, getOwner = () => "local" }) {
    const doc = win.document, root = doc.documentElement;
    const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    const touch = win.matchMedia("(any-pointer: coarse)");
    let running = null, sequence = 0, pointer = null, committing = false;
    function cleanup(current) {
      if (running !== current) return;
      running = null;
      delete root.dataset.pageTransition;
      delete root.dataset.pageTransitionPhase;
      current.transition?.skipTransition();
    }
    function cancel() {
      sequence += 1;
      if (running) cleanup(running);
    }
    function commit(current) {
      if (running !== current || current.sequence !== sequence || current.owner !== getOwner() || current.committed) return;
      current.committed = true;
      committing = true;
      try { current.update(); } finally { committing = false; }
    }
    function settle() {
      if (!running || committing) return;
      const current = running;
      try { commit(current); } finally {
        cleanup(current);
        if (sequence === current.sequence) sequence += 1;
      }
    }
    function inside(point) {
      if (!point) return false;
      const box = workspace.getBoundingClientRect();
      return point.x >= box.left && point.x < box.right && point.y >= box.top && point.y < box.bottom;
    }
    function navigate({ from, to, source, update }) {
      cancel();
      const movement = direction(order, from, to), box = workspace.getBoundingClientRect();
      const shellMoving = workspace.parentElement?.getAnimations?.().some((animation) => animation.playState === "running");
      // Captured snapshots cannot hit-test like live controls. Touch and content
      // shortcuts stay immediate; desktop mouse entry settles before a click.
      if (!movement || reduced.matches || touch.matches || inside(pointer) || !source || workspace.contains(source)
        || doc.hidden || doc.body.classList.contains("task-panel-open") || doc.querySelector("dialog[open]") || shellMoving || !box.width || !box.height
        || typeof doc.startViewTransition !== "function") { update(); return; }
      const current = { sequence, owner: getOwner(), update, committed: false, transition: null };
      running = current;
      root.dataset.pageTransition = movement > 0 ? "forward" : "back";
      root.dataset.pageTransitionPhase = "capture";
      try {
        const transition = doc.startViewTransition(() => commit(current));
        current.transition = transition;
        transition.ready.then(() => {
          if (running === current) root.dataset.pageTransitionPhase = "animate";
        }, () => { if (running === current) settle(); });
        // Failure is a visual fallback; stale callbacks cannot commit old routes.
        transition.finished.then(() => {
          if (running === current) { commit(current); cleanup(current); }
        }, () => { if (running === current) settle(); });
        transition.updateCallbackDone.catch(() => { if (running === current) cleanup(current); });
      } catch { try { commit(current); } finally { cleanup(current); } }
    }
    function pointerMove(event) {
      pointer = { x: event.clientX, y: event.clientY };
      if (inside(pointer)) settle();
    }
    function pointerDown(event) {
      pointer = { x: event.clientX, y: event.clientY };
      if (inside(pointer) || event.pointerType === "touch") settle();
    }
    function focusContent(event) { if (workspace.contains(event.target)) settle(); }
    const documentEvents = { pointermove: pointerMove, pointerdown: pointerDown, focusin: focusContent, keydown: focusContent, wheel: settle, touchstart: settle };
    Object.entries(documentEvents).forEach(([name, handler]) => doc.addEventListener(name, handler, { capture: true, passive: true }));
    const windowEvents = ["resize", "pagehide", "blur"];
    windowEvents.forEach((name) => win.addEventListener(name, settle));
    reduced.addEventListener("change", settle);
    touch.addEventListener("change", settle);
    const popups = new win.MutationObserver(() => {
      if (running && (doc.querySelector("dialog[open]") || doc.querySelector("#template-management-menu"))) settle();
    });
    popups.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return Object.freeze({ navigate, cancel, settle, destroy() {
      cancel(); popups.disconnect();
      Object.entries(documentEvents).forEach(([name, handler]) => doc.removeEventListener(name, handler, true));
      windowEvents.forEach((name) => win.removeEventListener(name, settle));
      reduced.removeEventListener("change", settle); touch.removeEventListener("change", settle);
    } });
  }
  return Object.freeze({ create, direction });
});
