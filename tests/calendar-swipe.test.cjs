const test = require("node:test");
const assert = require("node:assert/strict");
const Swipe = require("../landing/calendar-swipe.js");

function fixture({ width = 390, overflow = 0, left = 0 } = {}) {
  let clock = 0, context = "local:calendar:day:2026-11-20", enabled = true, ignored = false;
  const calls = [], listeners = new Map(), root = { clientWidth: width,
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } };
  const surface = { scrollWidth: 300 + overflow, clientWidth: 300, scrollLeft: left };
  const controller = Swipe.create({ roots: [root, root], getScroller: () => surface, enabled: () => enabled,
    getContext: () => context, ignoreTarget: () => ignored, navigate: direction => calls.push(direction), now: () => clock });
  const touch = (x, y = 100, identifier = 1) => ({ clientX: x, clientY: y, identifier });
  function emit(type, touches = [], changedTouches = touches, extra = {}) {
    const event = { currentTarget: root, target: {}, touches, changedTouches, cancelable: true,
      prevented: false, stopped: false, immediate: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.immediate = true; }, ...extra };
    listeners.get(type)?.(event);return event;
  }
  const start = (x = 200, y = 100) => emit("touchstart", [touch(x, y)]);
  const move = (x, y = 100) => { clock += 40; return emit("touchmove", [touch(x, y)]); };
  const end = (x, y = 100) => emit("touchend", [], [touch(x, y)]);
  return { controller, calls, listeners, surface, touch, emit, start, move, end,
    setContext: value => context = value, setEnabled: value => enabled = value, setIgnored: value => ignored = value, advance: n => clock += n };
}

test("one left swipe advances once; one right swipe returns once", () => {
  const f = fixture();f.start();const move = f.move(100);f.end(100);f.end(100);
  assert.deepEqual(f.calls, [1]);assert.ok(move.prevented && move.stopped);
  f.start(100);f.move(200);f.end(200);assert.deepEqual(f.calls, [1, -1]);
});
test("taps and short movement do not navigate or turn into an accidental task click", () => {
  const f = fixture();f.start();f.end(200);assert.deepEqual(f.calls, []);
  f.start();f.move(180);f.end(180);assert.deepEqual(f.calls, []);
  assert.ok(f.emit("click", [], [], { detail: 1 }).prevented);
  assert.equal(f.emit("click", [], [], { detail: 0 }).prevented, false);
  f.advance(651);assert.equal(f.emit("click", [], [], { detail: 1 }).prevented, false);
});
test("vertical intent stays native even if the finger later moves sideways", () => {
  const f = fixture();f.start();assert.equal(f.move(198, 140).prevented, false);
  assert.equal(f.move(80, 150).prevented, false);f.end(80, 150);assert.deepEqual(f.calls, []);
});
test("a new deliberate tap immediately after a swipe stays responsive", () => {
  const f = fixture();f.start();f.move(100);f.end(100);
  assert.ok(f.emit("click", [], [], { detail: 1 }).prevented);
  f.start();f.end(200);assert.equal(f.emit("click", [], [], { detail: 1 }).prevented, false);
  assert.deepEqual(f.calls, [1]);
});
test("diagonal gestures cannot accidentally change periods", () => {
  const f = fixture();f.start();f.move(140, 155);f.end(140, 155);assert.deepEqual(f.calls, []);
});
test("multi-touch and touch cancellation never navigate", () => {
  const f = fixture();f.emit("touchstart", [f.touch(200), f.touch(210, 100, 2)]);f.move(100);f.end(100);
  f.start();f.move(100);f.emit("touchmove", [f.touch(100), f.touch(110, 100, 2)]);f.end(100);
  f.start();f.move(100);f.emit("touchcancel");f.end(100);assert.deepEqual(f.calls, []);
});
test("a changed touch identifier and noncancelable native gesture are abandoned", () => {
  const f = fixture();f.start();f.emit("touchmove", [f.touch(100, 100, 2)]);f.end(100);
  f.start();f.emit("touchmove", [f.touch(100)], [], { cancelable: false });f.end(100);assert.deepEqual(f.calls, []);
});
test("view/date/account changes and disabled overlays cancel a pending gesture", () => {
  const f = fixture();f.start();f.move(100);f.setContext("another-owner");f.end(100);
  f.start();f.setEnabled(false);f.move(100);f.end(100);
  f.start();f.move(100);f.end(100);assert.deepEqual(f.calls, []);
});
test("ignored drag/form targets and long holds do not navigate", () => {
  const f = fixture();f.setIgnored(true);f.start();f.move(100);f.end(100);
  f.setIgnored(false);f.start();f.move(100);f.advance(1201);f.end(100);assert.deepEqual(f.calls, []);
});
test("wide timetable panning stays native for the entire gesture, even on reaching its edge", () => {
  const f = fixture({ overflow: 600, left: 100 });f.start();assert.equal(f.move(100).prevented, false);
  f.surface.scrollLeft = 600;f.move(0);f.end(0);assert.deepEqual(f.calls, []);
});
test("fresh outward gestures at either horizontal edge navigate; inward gestures pan", () => {
  const f = fixture({ overflow: 600 });f.start(100);f.move(200);f.end(200);assert.deepEqual(f.calls, [-1]);
  f.surface.scrollLeft = 600;f.start(200);f.move(100);f.end(100);assert.deepEqual(f.calls, [-1, 1]);
  f.surface.scrollLeft = 0;f.start(200);assert.equal(f.move(100).prevented, false);f.end(100);assert.equal(f.calls.length, 2);
});
test("large viewports need a deliberate swipe rather than a small horizontal nudge", () => {
  const f = fixture({ width: 1000 });f.start();f.move(130);f.end(130);assert.deepEqual(f.calls, []);
  f.start();f.move(100);f.end(100);assert.deepEqual(f.calls, [1]);
});
test("destroy removes deduplicated listeners and prevents stale touch callbacks", () => {
  const f = fixture();assert.equal(f.listeners.size, 5);const move = f.listeners.get("touchmove");
  f.start();f.controller.destroy();assert.equal(f.listeners.size, 0);
  move({ touches: [f.touch(100)] });assert.deepEqual(f.calls, []);f.controller.destroy();
});
