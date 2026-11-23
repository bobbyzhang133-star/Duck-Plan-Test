(function completionListMotionFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCompletionListMotion = api;
})(typeof window !== "undefined" ? window : globalThis, function buildCompletionListMotion() {
  "use strict";
  function create({ getRoot, getContext, enabled }) {
    let previous = null, pendingRender = null;
    const running = new Set();
    const cleanups = new Set();
    const cards = root => [...root.querySelectorAll(".daily-task-card,.all-task-row,.matrix-task-card")]
      .filter(card => !card.classList.contains("completion-exit-source") && card.checkVisibility?.() !== false && !card.closest("[hidden],details:not([open])"));
    const idFor = card => card.querySelector("input[data-task-id]")?.dataset.taskId;
    function stop() {
      for (const animation of running) animation.cancel();
      running.clear();
      for (const cleanup of [...cleanups]) cleanup();
    }
    function cancel({ flush = true } = {}) {
      const next = pendingRender;
      previous = null; pendingRender = null; stop();
      if (flush) next?.();
    }
    function deferRender(next) {
      if (!running.size) return false;
      pendingRender = next;
      return true;
    }
    function capture() {
      const root = getRoot();
      if (!enabled() || !root) { cancel(); return; }
      const origin = root.getBoundingClientRect(), positions = new Map();
      const scrolls = [];
      for (let element = root; element; element = element.parentElement) {
        if (element.scrollTop || element.scrollLeft) scrolls.push({ element, top: element.scrollTop, left: element.scrollLeft });
      }
      for (const card of cards(root)) {
        const id = idFor(card), rect = card.getBoundingClientRect();
        if (id && rect.width && rect.height) positions.set(id, { x: rect.left - origin.left, y: rect.top - origin.top });
      }
      const frames = [".tasks-panel", ".dashboard-today"].flatMap(selector => {
        const element = root.querySelector(selector);
        if (!element) return [];
        const style = getComputedStyle(element);
        return style.display === "block" ? [{ selector, height: Number.parseFloat(style.height) }] : [];
      });
      const parts = [...root.querySelectorAll(".task-section,[data-complete-overdue],#task-empty,#daily-empty")]
        .filter(element => !element.hasAttribute("data-completion-section-exit"))
        .map(element => {
          const visible = element.checkVisibility?.() !== false && !element.closest("[hidden]");
          if (!visible) return { element, visible: false };
          const style = getComputedStyle(element);
          return { element, visible: true, height: element.getBoundingClientRect().height, display: style.display,
            marginTop: style.marginTop, marginBottom: style.marginBottom,
            paddingTop: style.paddingTop, paddingBottom: style.paddingBottom,
            borderTopWidth: style.borderTopWidth, borderBottomWidth: style.borderBottomWidth };
        });
      // Sample an interrupted slide's rendered position before cancelling its old animation.
      pendingRender = null; stop();
      previous = { context: getContext(), positions, frames, parts, scrolls };
    }
    function play() {
      const snapshot = previous; previous = null;
      const root = getRoot();
      if (!snapshot || !root || !enabled() || snapshot.context !== getContext()) return;
      const track = (animation, cleanup) => {
        running.add(animation);
        const finished = () => {
          running.delete(animation);
          cleanup?.();
          if (running.size || !pendingRender) return;
          const next = pendingRender; pendingRender = null;
          next();
        };
        animation.finished.then(finished, finished);
      };
      const timing = { duration: 400, easing: "cubic-bezier(.25,.1,.25,1)" };
      const frameTargets = snapshot.frames.flatMap(frame => {
        const element = root.querySelector(frame.selector);
        return element ? [{ ...frame, element, targetHeight: Number.parseFloat(getComputedStyle(element).height) }] : [];
      });
      for (const part of snapshot.parts) {
        const element = part.element;
        const visible = element.checkVisibility?.() !== false && !element.closest("[hidden]");
        if (!part.visible && visible) {
          track(element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" }));
          continue;
        }
        if (!part.visible || visible) continue;
        const originalStyle = element.style.cssText, wasInert = element.inert;
        element.setAttribute("data-completion-section-exit", "");
        element.inert = true;
        element.style.setProperty("display", part.display, "important");
        Object.assign(element.style, { height: `${part.height}px`, minHeight: "0", maxHeight: "none", overflow: "clip", pointerEvents: "none", boxSizing: "border-box" });
        let cleaned = false;
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true; cleanups.delete(cleanup);
          element.style.cssText = originalStyle;
          element.inert = wasInert;
          element.removeAttribute("data-completion-section-exit");
        };
        cleanups.add(cleanup);
        // Restore the old space before measuring survivors; natural height collapse
        // moves the following sections without adding a second translate animation.
        track(element.animate([
          { height: `${part.height}px`, opacity: 1, marginTop: part.marginTop, marginBottom: part.marginBottom,
            paddingTop: part.paddingTop, paddingBottom: part.paddingBottom, borderTopWidth: part.borderTopWidth, borderBottomWidth: part.borderBottomWidth },
          { height: "0px", opacity: 0, marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px", borderTopWidth: "0px", borderBottomWidth: "0px" }
        ], timing), cleanup);
      }
      for (const frame of frameTargets) {
        if (Number.isFinite(frame.targetHeight) && Math.abs(frame.targetHeight - frame.height) >= 1) track(frame.element.animate([{ height: `${frame.height}px` }, { height: `${frame.targetHeight}px` }], timing));
      }
      for (const scroll of snapshot.scrolls) {
        scroll.element.scrollTop = scroll.top;
        scroll.element.scrollLeft = scroll.left;
      }
      const origin = root.getBoundingClientRect();
      for (const card of cards(root)) {
        const from = snapshot.positions.get(idFor(card));
        if (!from) continue;
        const rect = card.getBoundingClientRect(), x = from.x - (rect.left - origin.left), y = from.y - (rect.top - origin.top);
        if (Math.abs(x) < 1 && Math.abs(y) < 1) continue;
        track(card.animate([{ transform: `translate(${x}px,${y}px)` }, { transform: "translate(0,0)" }], timing));
      }
    }
    return Object.freeze({ capture, play, cancel, deferRender });
  }
  return Object.freeze({ create });
});
