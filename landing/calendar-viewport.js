/* Keep timeline labels/dots whole and stretch the timetable at scroll limits. */
(function calendarViewportFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCalendarViewport = api;
})(typeof window !== "undefined" ? window : globalThis, function buildCalendarViewport() {
  "use strict";
  // The approved 6814b34 spring: zeta .67, omega 7.1, with a smooth resting
  // tail. Explicit samples retain its rebound even without CSS linear() easing.
  // Keep this local: button/popup release curves must not change with edge bounce.
  const edgeSpring = [0,0.006638,0.025150,0.053557,0.090040,0.132942,0.180768,0.232176,0.285978,0.341125,0.396708,0.451944,0.506168,0.558829,0.609474,0.657743,0.703362,0.746127,0.785906,0.822621,0.856246,0.886800,0.914338,0.938946,0.960735,0.979837,0.996398,1.010578,1.022542,1.032460,1.040504,1.046844,1.051649,1.055081,1.057298,1.058448,1.058674,1.058108,1.056873,1.055084,1.052844,1.050250,1.047386,1.044329,1.041147,1.037899,1.034638,1.031407,1.028243,1.025134,1.021940,1.018599,1.015157,1.011734,1.008496,1.005622,1.003272,1.001561,1.000520,1.000073,1];
  function createElastic({ calendar, view } = {}) {
    if (!calendar?.style || !view?.requestAnimationFrame || !view?.setTimeout) return { reset() {}, destroy() {} };
    const reduced = view.matchMedia?.("(prefers-reduced-motion: reduce)");
    let parts = [], originals = [], animations = [], offset = 0, frame = null, releaseTimer = null, touch = null, version = 0, destroyed = false, dragging = false;
    // Move the existing grid as one backing surface, counter-moving its sticky
    // header pieces. This preserves the current-time dot's overlap with the gutter;
    // separate axis/column transforms would trap it below the gutter's stacking layer.
    const paint = () => { frame = null; parts.forEach((part, index) => { part.style.transform = `translate3d(0,${offset * (index ? -1 : 1)}px,0)`; }); };
    function reset() {
      version += 1;
      view.clearTimeout(releaseTimer); releaseTimer = null;
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      for (const animation of animations) animation.cancel();
      animations = [];
      for (const [part, transform, priority] of originals) {
        if (transform) part.style.setProperty("transform", transform, priority);
        else part.style.removeProperty("transform");
      }
      parts = []; originals = []; offset = 0; touch = null;
    }
    function release() {
      releaseTimer = null;
      if (!offset || animations.length) return;
      if (reduced?.matches || !parts.every(part => part.animate)) { reset(); return; }
      if (frame !== null) { view.cancelAnimationFrame(frame); paint(); }
      const current = ++version;
      animations = parts.map((part, index) => part.animate(edgeSpring.map((progress, sample) => ({
        offset: sample / (edgeSpring.length - 1),
        transform: `translate3d(0,${offset * (1 - progress) * (index ? -1 : 1)}px,0)`,
      })), { duration: 440, easing: "linear", fill: "forwards" }));
      Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => { if (current === version) reset(); });
    }
    function pull(delta) {
      if (animations.length) {
        // Read the displayed return position once, before cancelling, so a renewed
        // gesture picks up smoothly instead of snapping to its old end position.
        const matrix = view.getComputedStyle(parts[0]).transform;
        const displayed = view.DOMMatrixReadOnly ? new view.DOMMatrixReadOnly(matrix).m42 : 0;
        version += 1;
        for (const animation of animations) animation.cancel();
        animations = []; offset = displayed;
      }
      if (!parts.length) {
        parts = [...calendar.querySelectorAll(".timeline-calendar,.timeline-corner,.timeline-days,.timeline-deadline-label,.timeline-deadlines")];
        originals = parts.map(part => [part, part.style.getPropertyValue("transform"), part.style.getPropertyPriority("transform")]);
      }
      offset = Math.max(-48, Math.min(48, offset + delta * 0.35 * (1 - Math.abs(offset) / 60)));
      if (frame === null) frame = view.requestAnimationFrame(paint);
      view.clearTimeout(releaseTimer);
      releaseTimer = view.setTimeout(release, 90);
    }
    function atEdge(delta) {
      return delta < 0 ? calendar.scrollTop <= 0 : delta > 0 && calendar.scrollTop >= calendar.scrollHeight - calendar.clientHeight - 1;
    }
    const timelineTarget = target => Boolean(target?.closest?.(".time-axis,.timeline-columns"));
    function wheel(event) {
      if (destroyed || reduced?.matches || dragging || event.buttons || event.ctrlKey || !event.cancelable || !timelineTarget(event.target) || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (!atEdge(event.deltaY)) { if (offset || animations.length) reset(); return; }
      event.preventDefault();
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? calendar.clientHeight : 1;
      pull(-event.deltaY * multiplier);
    }
    function touchstart(event) {
      reset();
      if (event.touches.length !== 1 || !timelineTarget(event.target) || reduced?.matches) return;
      // Scheduled blocks retain their own drag gesture. Blank timetable/axis
      // gestures can stretch; multi-touch and native horizontal scrolling stay native.
      if (event.target.closest?.("[data-calendar-drag-task]")) return;
      touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    function touchmove(event) {
      if (!touch || event.touches.length !== 1 || !event.cancelable) return;
      const next = event.touches[0], dx = next.clientX - touch.x, dy = next.clientY - touch.y;
      touch = { x: next.clientX, y: next.clientY };
      if (Math.abs(dx) > Math.abs(dy) || !atEdge(-dy)) { if (offset || animations.length) reset(); return; }
      event.preventDefault(); pull(dy);
      // Hold while the finger is down; release on lift/cancel rather than idle.
      view.clearTimeout(releaseTimer); releaseTimer = null;
    }
    const touchend = () => { touch = null; release(); };
    const pointerdown = event => { if (event.pointerType !== "touch") reset(); };
    const dragstart = () => { reset(); dragging = true; };
    const dragend = () => { dragging = false; reset(); };
    const registrations = [
      [calendar, "wheel", wheel, { passive: false }], [calendar, "touchstart", touchstart, { passive: true }],
      [calendar, "touchmove", touchmove, { passive: false }], [calendar, "touchend", touchend], [calendar, "touchcancel", touchend],
      [calendar, "pointerdown", pointerdown, true], [calendar, "keydown", reset, true],
      [calendar, "dragstart", dragstart, true], [calendar, "dragenter", dragstart, true],
      [view, "dragend", dragend], [view, "drop", dragend],
      [view, "blur", reset], [view, "pagehide", reset], [view, "hashchange", reset],
    ];
    for (const [target, name, handler, options] of registrations) target.addEventListener(name, handler, options);
    reduced?.addEventListener?.("change", reset);
    return { reset, destroy() {
      destroyed = true; reset();
      for (const [target, name, handler, options] of registrations) target.removeEventListener(name, handler, options);
      reduced?.removeEventListener?.("change", reset);
    } };
  }
  function create({ calendar, view = calendar?.ownerDocument?.defaultView } = {}) {
    if (!calendar || !view?.IntersectionObserver) return { refresh() {}, destroy() {} };
    const elastic = createElastic({ calendar, view });
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
      elastic.reset();
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
      elastic.destroy();
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      disconnectPaint(); sizes?.disconnect(); mutations?.disconnect(); observedSizes.clear();
      calendar.removeEventListener("scroll", paintFold);
      calendar.classList.remove("is-timeline-scrolled");
      view.removeEventListener("resize", schedule);
    } };
  }
  return { create, createElastic };
});
