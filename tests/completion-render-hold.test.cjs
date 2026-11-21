const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../landing/completion-render-hold.js");

function setup() {
  const timers = new Map(), events = [];
  let owner = "one", serial = 0;
  const gate = create({ getContext: () => owner,
    schedule: callback => { const id = ++serial; timers.set(id, callback); return id; },
    unschedule: id => timers.delete(id) });
  return { gate, events, timers, owner: value => { owner = value; }, tick: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); } };
}

test("list rendering waits for the exit, uses the latest data render, then restores focus", () => {
  const s = setup();
  s.gate.hold({ duration: 670, onRelease: () => s.events.push("remove outgoing card"), afterRelease: () => s.events.push("focus") });
  assert.equal(s.gate.deferRender(() => s.events.push("optimistic render")), true);
  assert.equal(s.gate.deferRender(() => s.events.push("confirmed render")), true);
  assert.deepEqual(s.events, []);
  s.tick();
  assert.deepEqual(s.events, ["remove outgoing card", "confirmed render", "focus"]);
  assert.equal(s.gate.active, 0);
});

test("rapid completions retain list geometry until all outgoing cards finish", () => {
  const s = setup();
  const a = s.gate.hold({ duration: 670, afterRelease: () => s.events.push("first focus check") });
  const b = s.gate.hold({ duration: 670 });
  s.gate.deferRender(() => s.events.push("render"));
  a.finish();
  assert.deepEqual(s.events, []);
  b.finish(); b.finish();
  assert.deepEqual(s.events, ["render", "first focus check"]);
  assert.equal(s.timers.size, 0);
});

test("failure cancels the animation and promptly renders the rollback", () => {
  const s = setup();
  const hold = s.gate.hold({ duration: 670, onRelease: ({ cancelled }) => s.events.push(cancelled ? "cancel" : "finish"), afterRelease: () => s.events.push("success") });
  s.gate.deferRender(() => s.events.push("rollback"));
  hold.cancel();
  assert.deepEqual(s.events, ["cancel", "rollback"]);
  s.tick();
  assert.deepEqual(s.events, ["cancel", "rollback"]);
});

test("owner or view changes discard old renders, callbacks and timers", () => {
  const s = setup();
  s.gate.hold({ duration: 670, onRelease: ({ cancelled }) => s.events.push(cancelled), afterRelease: () => s.events.push("stale focus") });
  s.gate.deferRender(() => s.events.push("stale render"));
  s.owner("two");
  assert.equal(s.gate.deferRender(() => s.events.push("new render")), false);
  assert.deepEqual(s.events, [true]);
  assert.equal(s.timers.size, 0);
  s.tick();
  assert.deepEqual(s.events, [true]);
});

test("explicit navigation/motion cancellation flushes once after retiring every source", () => {
  const s = setup();
  s.gate.hold({ duration: 670, onRelease: () => s.events.push("a") });
  s.gate.hold({ duration: 670, onRelease: () => s.events.push("b") });
  s.gate.deferRender(() => s.events.push("render"));
  s.gate.cancel(); s.gate.cancel(); s.tick();
  assert.deepEqual(s.events, ["a", "b", "render"]);
});

test("focus is sampled immediately before the final shared render, even for an earlier finished card", () => {
  const s = setup();
  const first = s.gate.hold({ duration: 670, beforeRender: () => s.events.push("sample latest focus"), afterRelease: () => s.events.push("restore focus") });
  const second = s.gate.hold({ duration: 670 });
  s.gate.deferRender(() => s.events.push("replace lists"));
  first.finish();
  assert.deepEqual(s.events, []);
  second.finish();
  assert.deepEqual(s.events, ["sample latest focus", "replace lists", "restore focus"]);
});
