const test = require("node:test");
const assert = require("node:assert/strict");
const { createNativeScroll, scroller } = require("../landing/calendar-viewport.js");

function fixture() {
  const registrations = [];
  const listen = value => Object.assign(value, {
    addEventListener(name, handler, options) { registrations.push({ target: this, name, handler, options }); },
    removeEventListener(name, handler) { const at = registrations.findIndex(r => r.target === this && r.name === name && r.handler === handler); if (at >= 0) registrations.splice(at, 1); },
  });
  const surface = listen({ scrollTop: 200, scrollLeft: 0, scrollWidth: 900, clientHeight: 500 });
  const makeHeader = () => listen({ scrollLeft: 0, closest(selector) { return selector === ".calendar-header-viewport" ? this : null; } });
  let header = makeHeader(), currentSurface = surface, grid = { style: {} };
  const phone = listen({ closest: selector => selector === "#phone-week-strip" ? phone : null });
  const doc = listen({ querySelector: selector => selector === "#phone-week-strip" ? phone : null });
  const calendar = listen({ ownerDocument: doc, contains: value => value === header,
    querySelector: selector => selector === ".calendar-timeline-scroller" ? currentSurface : selector === ".calendar-header-viewport" ? header : selector === ".calendar-header-grid" ? grid : null });
  const controller = createNativeScroll({ calendar, view: { document: doc } }); controller.refresh();
  const emit = (owner, name, fields = {}) => {
    const event = { target: owner, cancelable: true, deltaX: 0, deltaY: 100, deltaMode: 0, prevented: false, preventDefault() { this.prevented = true; }, ...fields };
    registrations.filter(r => r.target === owner && r.name === name).forEach(r => r.handler(event)); return event;
  };
  return { surface, calendar, phone, doc, registrations, controller, emit, get header() { return header; }, get grid() { return grid; },
    rerender() { header = makeHeader(); grid = { style: {} }; controller.refresh(); },
    month() { currentSurface = null; header = null; grid = null; controller.refresh(); } };
}

test("the actual timetable is the scroll target, while Month retains its outer scroll element", () => {
  const f = fixture(); assert.equal(scroller(f.calendar), f.surface);
  f.month(); assert.equal(scroller(f.calendar), f.calendar); f.controller.destroy();
});

test("native timetable input has no cancellable wheel/touch handlers on its surface or ancestors", () => {
  const f = fixture();
  assert.equal(f.registrations.filter(r => [f.surface, f.calendar, f.doc].includes(r.target) && ["wheel", "touchmove"].includes(r.name)).length, 0);
  const target = { closest: () => null };
  assert.equal(f.emit(f.header, "wheel", { target }).prevented, false);
  assert.equal(f.surface.scrollTop, 200); f.controller.destroy();
});

test("date-header wheel input pans the timetable programmatically without scrolling the header vertically", () => {
  const f = fixture();
  assert.ok(f.emit(f.header, "wheel").prevented); assert.equal(f.surface.scrollTop, 300);
  assert.equal(f.grid.style.width, "900px");
  f.emit(f.header, "wheel", { deltaY: 0, deltaX: 80 });
  assert.equal(f.surface.scrollLeft, 80); assert.equal(f.header.scrollLeft, 80);
  assert.equal(f.emit(f.header, "wheel", { ctrlKey: true }).prevented, false);
  f.controller.destroy();
});

test("phone/date-header touch pans the schedule while multi-touch remains available", () => {
  const f = fixture(), point = (x, y) => ({ clientX: x, clientY: y });
  f.emit(f.phone, "touchstart", { touches: [point(100, 100)] });
  assert.ok(f.emit(f.phone, "touchmove", { touches: [point(100, 70)] }).prevented);
  assert.equal(f.surface.scrollTop, 230);
  f.emit(f.header, "touchstart", { touches: [point(100, 100)] });
  f.emit(f.header, "touchmove", { touches: [point(70, 100)] });
  assert.equal(f.surface.scrollLeft, 30); assert.equal(f.header.scrollLeft, 30);
  f.emit(f.phone, "touchstart", { touches: [point(0, 0), point(10, 10)] });
  assert.equal(f.emit(f.phone, "touchmove", { touches: [point(0, 40), point(10, 50)] }).prevented, false);
  f.controller.destroy();
});

test("horizontal header and body scroll remain aligned, including keyboard focus scrolling", () => {
  const f = fixture(); f.surface.scrollLeft = 140;
  f.emit(f.calendar, "scroll", { target: f.surface }); assert.equal(f.header.scrollLeft, 140);
  f.header.scrollLeft = 220; f.emit(f.calendar, "scroll", { target: f.header });
  assert.equal(f.surface.scrollLeft, 220); f.controller.destroy();
});

test("rerender retires old header listeners without accumulating new ones", () => {
  const f = fixture(), old = f.header, count = f.registrations.length;
  f.rerender(); assert.equal(f.registrations.filter(r => r.target === old).length, 0);
  assert.equal(f.registrations.length, count); f.controller.refresh();
  assert.equal(f.registrations.length, count); f.controller.destroy();
  assert.equal(f.registrations.length, 0);
});

test("destroy releases the native header adapter without leaving a gesture handler", () => {
  const f = fixture(); f.controller.destroy(); f.controller.destroy();
  assert.equal(f.registrations.length, 0);
});
