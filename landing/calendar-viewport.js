/* Keep timeline labels and the current-time dot whole at sticky/scroll edges. */
(function calendarViewportFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCalendarViewport = api;
})(typeof window !== "undefined" ? window : globalThis, function buildCalendarViewport() {
  "use strict";
  function create({ calendar, view = calendar?.ownerDocument?.defaultView } = {}) {
    if (!calendar || !view?.IntersectionObserver) return { refresh() {}, destroy() {} };
    let frame = null, generation = 0, destroyed = false, labelObserver, indicatorObserver;
    const observedSizes = new Set(), clipped = new Set();
    const paintFold = () => calendar.classList.toggle("is-timeline-scrolled", Boolean(calendar.querySelector(".time-axis")) && calendar.scrollTop > 1);
    calendar.addEventListener("scroll", paintFold, { passive: true });
    const schedule = () => { if (!destroyed && frame === null) frame = view.requestAnimationFrame(() => { frame = null; refresh(); }); };
    const sizes = view.ResizeObserver ? new view.ResizeObserver(schedule) : null;
    function disconnectPaint() {
      generation += 1;
      labelObserver?.disconnect(); indicatorObserver?.disconnect();
      for (const element of clipped) element.classList.remove("is-viewport-clipped");
      clipped.clear();
    }
    function refresh() {
      if (destroyed) return;
      paintFold();
      disconnectPaint();
      const headers = [...calendar.querySelectorAll(".timeline-days,.timeline-deadlines")];
      const currentSizes = new Set([calendar, ...headers]);
      for (const element of observedSizes) if (!currentSizes.has(element)) { sizes?.unobserve(element); observedSizes.delete(element); }
      for (const element of currentSizes) if (!observedSizes.has(element)) { sizes?.observe(element); observedSizes.add(element); }
      if (!calendar.clientHeight || !calendar.querySelector(".time-axis")) return;
      const bounds = calendar.getBoundingClientRect();
      const headerBottom = Math.max(bounds.top + calendar.clientTop, ...headers.map(element => element.getBoundingClientRect().bottom));
      const top = Math.max(0, headerBottom - bounds.top), right = Math.max(0, calendar.offsetWidth - calendar.clientWidth - calendar.clientLeft);
      const bottom = Math.max(0, calendar.offsetHeight - calendar.clientHeight - calendar.clientTop);
      const axis = calendar.querySelector(".time-axis").getBoundingClientRect();
      // The 8px dot is centred on today's column boundary. Its gutter-side
      // half is intentional; keep that half visible without exposing it when
      // the column has scrolled behind the sticky hour labels.
      const left = Math.max(0, axis.right - bounds.left - calendar.clientLeft - 4);
      const version = generation;
      const update = indicator => entries => {
        if (destroyed || version !== generation) return;
        for (const entry of entries) {
          const element = indicator ? entry.target.parentElement : entry.target;
          if (!element) continue;
          const hidden = !entry.isIntersecting || entry.intersectionRatio < 0.999;
          element.classList.toggle("is-viewport-clipped", hidden);
          if (hidden) clipped.add(element); else clipped.delete(element);
        }
      };
      labelObserver = new view.IntersectionObserver(update(false), { root: calendar, rootMargin: `-${top}px -${right}px -${bottom}px -${calendar.clientLeft}px`, threshold: [0, 1] });
      indicatorObserver = new view.IntersectionObserver(update(true), { root: calendar, rootMargin: `-${top}px -${right}px -${bottom}px -${left}px`, threshold: [0, 1] });
      calendar.querySelectorAll(".time-axis-label").forEach(element => labelObserver.observe(element));
      calendar.querySelectorAll(".current-time-line > span").forEach(element => indicatorObserver.observe(element));
    }
    const mutations = view.MutationObserver ? new view.MutationObserver(schedule) : null;
    mutations?.observe(calendar, { childList: true, subtree: true });
    view.addEventListener("resize", schedule);
    refresh();
    return { refresh, destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      disconnectPaint(); sizes?.disconnect(); mutations?.disconnect(); observedSizes.clear();
      calendar.removeEventListener("scroll", paintFold);
      calendar.classList.remove("is-timeline-scrolled");
      view.removeEventListener("resize", schedule);
    } };
  }
  return { create };
});
