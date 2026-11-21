(function completionListMotionFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCompletionListMotion = api;
})(typeof window !== "undefined" ? window : globalThis, function buildCompletionListMotion() {
  "use strict";
  function create({ getRoot, getContext, enabled }) {
    let previous = null;
    const running = new Set();
    const cards = root => [...root.querySelectorAll(".daily-task-card,.all-task-row,.matrix-task-card")]
      .filter(card => !card.classList.contains("completion-exit-source") && card.checkVisibility?.() !== false && !card.closest("[hidden],details:not([open])"));
    const idFor = card => card.querySelector("input[data-task-id]")?.dataset.taskId;
    function stop() { for (const animation of running) animation.cancel(); running.clear(); }
    function cancel() { previous = null; stop(); }
    function capture() {
      const root = getRoot();
      if (!enabled() || !root) { cancel(); return; }
      const origin = root.getBoundingClientRect(), positions = new Map();
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
      // Sample an interrupted slide's rendered position before cancelling its old animation.
      stop();
      previous = { context: getContext(), positions, frames };
    }
    function play() {
      const snapshot = previous; previous = null;
      const root = getRoot();
      if (!snapshot || !root || !enabled() || snapshot.context !== getContext()) return;
      const track = animation => {
        running.add(animation);
        animation.finished.then(() => running.delete(animation), () => running.delete(animation));
      };
      const timing = { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" };
      for (const frame of snapshot.frames) {
        const element = root.querySelector(frame.selector);
        if (!element) continue;
        const height = Number.parseFloat(getComputedStyle(element).height);
        if (Number.isFinite(height) && Math.abs(height - frame.height) >= 1) track(element.animate([{ height: `${frame.height}px` }, { height: `${height}px` }], timing));
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
    return Object.freeze({ capture, play, cancel });
  }
  return Object.freeze({ create });
});
