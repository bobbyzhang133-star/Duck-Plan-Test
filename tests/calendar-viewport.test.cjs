const test = require("node:test");
const assert = require("node:assert/strict");
const Viewport = require("../landing/calendar-viewport.js");

function element(bounds = {}) {
  const classes = new Set();
  return { classes, getBoundingClientRect: () => bounds,
    classList: { remove: name => classes.delete(name), toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } } };
}
function fixture() {
  const labels = [element(), element()], line = element(), dot = { parentElement: line };
  const days = element({ bottom: 77 }), due = element({ bottom: 125 }), axis = element({ right: 92 });
  let headers = [days, due], currentLabels = labels, hasAxis = true, nextFrame = 0;
  const frames = new Map(), intersections = [], resize = [], mutations = [], listeners = new Set();
  const scrollListeners = new Set();
  const calendar = { scrollTop: 0, addEventListener: (name, fn) => scrollListeners.add(fn), removeEventListener: (name, fn) => scrollListeners.delete(fn), ...element({ top: 10, left: 20 }), clientTop: 1, clientLeft: 1, clientHeight: 598, offsetHeight: 600, clientWidth: 398, offsetWidth: 400,
    querySelector: selector => selector === ".time-axis" && hasAxis ? axis : null,
    querySelectorAll: selector => selector === ".timeline-days,.timeline-deadlines" ? headers : selector === ".time-axis-label" ? currentLabels : [dot] };
  const view = {
    requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener: (name, fn) => listeners.add(fn), removeEventListener: (name, fn) => listeners.delete(fn),
    IntersectionObserver: class { constructor(callback, options) { Object.assign(this, { callback, options, observed: new Set() }); intersections.push(this); } observe(e) { this.observed.add(e); } disconnect() { this.disconnected = true; this.observed.clear(); } },
    ResizeObserver: class { constructor(callback) { this.callback = callback; this.observed = new Set(); resize.push(this); } observe(e) { this.observed.add(e); } unobserve(e) { this.observed.delete(e); } disconnect() { this.disconnected = true; this.observed.clear(); } },
    MutationObserver: class { constructor(callback) { this.callback = callback; mutations.push(this); } observe() {} disconnect() { this.disconnected = true; } },
  };
  const controller = Viewport.create({ calendar, view });
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  const emit = (observer, target, ratio) => observer.callback([{ target, intersectionRatio: ratio, isIntersecting: ratio > 0 }]);
  return { controller, calendar, view, labels, line, dot, days, due, intersections, resize, mutations, frames, listeners, scrollListeners, flush, emit,
    replace() { headers = [days]; currentLabels = [element()]; }, month() { headers = []; currentLabels = []; hasAxis = false; } };
}

test("sticky header and time-gutter occlusion define independent label and current-dot viewports", () => {
  const f = fixture();
  assert.equal(f.intersections[0].options.root, f.calendar);
  assert.equal(f.intersections[0].options.rootMargin, "-115px -1px -1px -1px");
  assert.equal(f.intersections[1].options.rootMargin, "-115px -1px -1px -67px", "Allow the gutter-side half of the boundary-centred dot, measured from the inner root edge");
  assert.deepEqual(f.intersections[0].options.threshold, [0, 1]);
  f.emit(f.intersections[0], f.labels[0], 0.5);
  assert.ok(f.labels[0].classes.has("is-viewport-clipped"));
  f.emit(f.intersections[0], f.labels[0], 1);
  assert.equal(f.labels[0].classes.size, 0);
  f.emit(f.intersections[1], f.dot, 0.99);
  assert.ok(f.line.classes.has("is-viewport-clipped"), "The full indicator hides when its dot is cut, rather than showing a broken dot");
  f.emit(f.intersections[1], f.dot, 1);
  assert.equal(f.line.classes.size, 0);
  f.controller.destroy();
});

test("rerender/resize coalesce, update changed header bounds and ignore stale observer callbacks", () => {
  const f = fixture(), oldLabels = f.intersections[0], oldDot = f.intersections[1];
  f.emit(oldLabels, f.labels[0], 0.2);
  f.replace();
  f.mutations[0].callback(); f.resize[0].callback(); [...f.listeners][0]();
  assert.equal(f.frames.size, 1, "No extra scroll/layout loop");
  f.flush();
  assert.equal(f.labels[0].classes.size, 0, "Retired nodes regain their original paint");
  assert.ok(oldLabels.disconnected && oldDot.disconnected);
  assert.equal(f.intersections.at(-2).options.rootMargin, "-67px -1px -1px -1px");
  assert.equal(f.resize[0].observed.has(f.due), false, "Detached header no longer observed");
  f.emit(oldDot, f.dot, 0.1);
  assert.equal(f.line.classes.size, 0, "Old generation cannot hide a current indicator");
  f.month(); f.controller.refresh();
  assert.ok(f.intersections.at(-1).disconnected);
  f.controller.destroy();
});

test("destroy cancels pending work, restores paint and releases observers/listeners", () => {
  const f = fixture(); f.emit(f.intersections[0], f.labels[1], 0);
  f.mutations[0].callback(); assert.equal(f.frames.size, 1);
  f.controller.destroy(); f.controller.destroy();
  assert.equal(f.frames.size, 0); assert.equal(f.labels[1].classes.size, 0); assert.equal(f.listeners.size, 0);
  assert.ok(f.resize[0].disconnected && f.mutations[0].disconnected);
  f.emit(f.intersections[0], f.labels[1], 0);
  f.controller.refresh(); assert.equal(f.labels[1].classes.size, 0);
});

test("unsupported observer environments leave the CSS-sized timeline usable", () => {
  assert.doesNotThrow(() => { const c = Viewport.create({ calendar: {}, view: {} }); c.refresh(); c.destroy(); });
});

test("fold shadow follows only timetable scroll, resets for Month and releases its passive listener", () => {
  const f = fixture();
  assert.equal(f.calendar.classes.has("is-timeline-scrolled"), false);
  f.calendar.scrollTop = 120; [...f.scrollListeners][0]();
  assert.ok(f.calendar.classes.has("is-timeline-scrolled"));
  assert.equal(f.frames.size, 0, "Scroll paint does not rebuild viewport geometry");
  f.calendar.scrollTop = 0; [...f.scrollListeners][0]();
  assert.equal(f.calendar.classes.has("is-timeline-scrolled"), false);
  f.calendar.scrollTop = 120; f.month(); f.controller.refresh();
  assert.equal(f.calendar.classes.has("is-timeline-scrolled"), false);
  f.controller.destroy(); assert.equal(f.scrollListeners.size, 0);
});

test("fold paint changes only when crossing the edge, without querying geometry on scroll", () => {
  const f = fixture(); let paints = 0, queries = 0;
  const toggle = f.calendar.classList.toggle, query = f.calendar.querySelector;
  f.calendar.classList.toggle = (...args) => { paints += 1; return toggle(...args); };
  f.calendar.querySelector = selector => { queries += 1; return query(selector); };
  for (const top of [10, 20, 30, 20, 10]) {
    f.calendar.scrollTop = top; [...f.scrollListeners][0]();
  }
  assert.equal(paints, 1, "Interior scrolling must not rewrite the ancestor's fold class");
  f.calendar.scrollTop = 0; [...f.scrollListeners][0]();
  assert.equal(paints, 2, "Reaching the edge removes the fold once");
  assert.equal(queries, 0, "Fold paint uses the current rendered timeline, not a new search");
  f.controller.destroy();
});
