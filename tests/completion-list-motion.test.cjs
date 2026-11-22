const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../landing/completion-list-motion.js");

function fixture() {
  let top = 200;
  const animations = [];
  const card = {
    classList: { contains: () => false }, checkVisibility: () => true, closest: () => null,
    querySelector: () => ({ dataset: { taskId: "remaining" } }),
    getBoundingClientRect: () => ({ left: 0, top, width: 200, height: 80 }),
    animate(frames, timing) {
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const animation = { finished, cancel: () => reject(Error("cancelled")), resolve, frames, timing };
      animations.push(animation); return animation;
    }
  };
  const root = { querySelectorAll: selector => selector.includes(".daily-task-card") ? [card] : [], querySelector: () => null, getBoundingClientRect: () => ({ top: 0, left: 0 }) };
  const motion = create({ getRoot: () => root, getContext: () => "same owner and view", enabled: () => true });
  const slide = () => { motion.capture(); top = 100; motion.play(); };
  return { motion, animations, slide };
}

test("late save refreshes wait for the upward slide and coalesce to the latest render", async () => {
  const s = fixture(), renders = [];
  s.slide();
  assert.equal(s.motion.deferRender(() => renders.push("old")), true);
  assert.equal(s.motion.deferRender(() => renders.push("latest")), true);
  assert.deepEqual(renders, []);
  s.animations[0].resolve(); await Promise.resolve();
  assert.deepEqual(renders, ["latest"]);
  assert.equal(s.motion.deferRender(() => renders.push("unexpected")), false);
});

test("an account change discards the queued refresh even after animation cancellation settles", async () => {
  const s = fixture(), renders = [];
  s.slide(); s.motion.deferRender(() => renders.push("old account"));
  s.motion.cancel({ flush: false }); await Promise.resolve();
  assert.deepEqual(renders, []);
});

test("explicit navigation flushes once and does not replay the refresh from cancelled animation promises", async () => {
  const s = fixture(), renders = [];
  s.slide(); s.motion.deferRender(() => renders.push("refresh"));
  s.motion.cancel(); s.motion.cancel(); await Promise.resolve();
  assert.deepEqual(renders, ["refresh"]);
});
