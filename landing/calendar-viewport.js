/* Keep labels/dots whole and native timetable scrolling below a fixed header. */
(function calendarViewportFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCalendarViewport = api;
})(typeof window !== "undefined" ? window : globalThis, function buildCalendarViewport() {
  "use strict";
  function scroller(calendar) {
    return calendar?.querySelector?.(".calendar-timeline-scroller") || calendar;
  }
  function createNativeScroll({ calendar, view } = {}) {
    const doc = calendar?.ownerDocument || view?.document;
    if (!doc?.querySelector || !calendar?.addEventListener) return { refresh() {}, destroy() {} };
    let finger = null, headerNodes = [];
    const inHeader = target => {
      const header = target?.closest?.(".calendar-header-viewport");
      return Boolean(header && calendar.contains(header)) || Boolean(target?.closest?.("#phone-week-strip"));
    };
    const syncHeader = () => {
      const surface = scroller(calendar), header = calendar.querySelector(".calendar-header-viewport"), grid = calendar.querySelector(".calendar-header-grid");
      if (!header || !grid || surface === calendar) return;
      const width = `${surface.scrollWidth}px`;
      if (grid.style.width !== width) grid.style.width = width;
      if (header.scrollLeft !== surface.scrollLeft) header.scrollLeft = surface.scrollLeft;
    };
    const wheel = event => {
      if (!inHeader(event.target) || event.ctrlKey || !event.cancelable) return;
      const surface = scroller(calendar);
      if (surface === calendar) return;
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientHeight : 1;
      event.preventDefault();
      // Header input may pan the schedule, but never initiates an elastic pull.
      // Timetable input itself is left entirely to native browser scrolling.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) surface.scrollLeft += event.deltaX * multiplier;
      else surface.scrollTop += event.deltaY * multiplier;
      syncHeader();
    };
    const touchstart = event => {
      finger = event.touches.length === 1 && inHeader(event.target) ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    };
    const touchmove = event => {
      if (!finger || event.touches.length !== 1 || !event.cancelable) return;
      const next = event.touches[0], dx = finger.x - next.clientX, dy = finger.y - next.clientY;
      finger = { x: next.clientX, y: next.clientY };
      const surface = scroller(calendar);
      if (surface === calendar) return;
      event.preventDefault();
      if (Math.abs(dx) > Math.abs(dy)) surface.scrollLeft += dx;
      else surface.scrollTop += dy;
      syncHeader();
    };
    const touchend = () => { finger = null; };
    const onScroll = event => {
      const surface = scroller(calendar), header = calendar.querySelector(".calendar-header-viewport");
      if (event.target === surface) syncHeader();
      else if (header && event.target === header && surface.scrollLeft !== header.scrollLeft) surface.scrollLeft = header.scrollLeft;
    };
    const events = [["wheel", wheel, { passive: false }], ["touchstart", touchstart, { passive: true }],
      ["touchmove", touchmove, { passive: false }], ["touchend", touchend], ["touchcancel", touchend]];
    const unbindHeaders = () => {
      for (const node of headerNodes) for (const [name, handler, options] of events) node.removeEventListener(name, handler, options);
      headerNodes = [];
    };
    const refresh = () => {
      const next = [calendar.querySelector(".calendar-header-viewport"), doc.querySelector("#phone-week-strip")].filter(Boolean);
      if (next.length !== headerNodes.length || next.some((node, index) => node !== headerNodes[index])) {
        unbindHeaders(); finger = null; headerNodes = next;
        // Attach cancellable input only to headers, never to the document or
        // timetable: native schedule scrolling must stay off the JS input path.
        for (const node of headerNodes) for (const [name, handler, options] of events) node.addEventListener(name, handler, options);
      }
      syncHeader();
    };
    calendar.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return { refresh, destroy() {
      finger = null; unbindHeaders();
      calendar.removeEventListener("scroll", onScroll, true);
    } };
  }

  function create({ calendar, view = calendar?.ownerDocument?.defaultView } = {}) {
    if (!calendar || !view?.IntersectionObserver) return { refresh() {}, destroy() {} };
    const nativeScroll = createNativeScroll({ calendar, view });
    let frame = null, generation = 0, destroyed = false, labelObserver, indicatorObserver;
    const observedSizes = new Set(), clipped = new Set();
    const paintFold = () => calendar.classList.toggle("is-timeline-scrolled", Boolean(calendar.querySelector(".time-axis")) && scroller(calendar).scrollTop > 1);
    calendar.addEventListener("scroll", paintFold, { passive: true, capture: true });
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
      nativeScroll.refresh();
      paintFold();
      disconnectPaint();
      const headers = [...calendar.querySelectorAll(".timeline-days,.timeline-deadlines")];
      const surface = scroller(calendar);
      const currentSizes = new Set([calendar, surface, ...headers]);
      for (const element of observedSizes) if (!currentSizes.has(element)) { sizes?.unobserve(element); observedSizes.delete(element); }
      for (const element of currentSizes) if (!observedSizes.has(element)) { sizes?.observe(element); observedSizes.add(element); }
      if (!surface.clientHeight || !calendar.querySelector(".time-axis")) return;
      const bounds = surface.getBoundingClientRect();
      const headerBottom = Math.max(bounds.top + surface.clientTop, ...headers.map(element => element.getBoundingClientRect().bottom));
      const top = Math.max(0, headerBottom - bounds.top), right = Math.max(0, surface.offsetWidth - surface.clientWidth - surface.clientLeft);
      const bottom = Math.max(0, surface.offsetHeight - surface.clientHeight - surface.clientTop);
      const axis = calendar.querySelector(".time-axis").getBoundingClientRect();
      // The 8px dot is centred on today's column boundary. Its gutter-side
      // half is intentional; keep that half visible without exposing it when
      // the column has scrolled behind the sticky hour labels.
      const left = Math.max(0, axis.right - bounds.left - surface.clientLeft - 4);
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
      labelObserver = new view.IntersectionObserver(update(false), { root: surface, rootMargin: `-${top}px -${right}px -${bottom}px -${surface.clientLeft}px`, threshold: [0, 1] });
      indicatorObserver = new view.IntersectionObserver(update(true), { root: surface, rootMargin: `-${top}px -${right}px -${bottom}px -${left}px`, threshold: [0, 1] });
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
      nativeScroll.destroy();
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      disconnectPaint(); sizes?.disconnect(); mutations?.disconnect(); observedSizes.clear();
      calendar.removeEventListener("scroll", paintFold, true);
      calendar.classList.remove("is-timeline-scrolled");
      view.removeEventListener("resize", schedule);
    } };
  }
  return { create, createNativeScroll, scroller };
});
