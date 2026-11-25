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
  const root = { animate: (...args) => card.animate(...args), querySelectorAll: selector => selector.includes(".daily-task-card") ? [card] : [], querySelector: () => null, getBoundingClientRect: () => ({ top: 0, left: 0 }) };
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

test("bulk section motion never queries or measures individual task cards", () => {
  let queries = 0;
  const root = { getBoundingClientRect: () => ({ left: 0, top: 0 }), querySelector: () => null,
    querySelectorAll(selector) { if (selector.includes(".daily-task-card")) { queries++; throw Error("Per-card scan in bulk path"); } return []; } };
  const motion = create({ getRoot: () => root, getContext: () => "same", enabled: () => true });
  motion.capture({ sectionsOnly: true }); motion.play(); assert.equal(queries, 0);
});

test("bulk Tasks groups close before replacement and open afterward, coalescing late refreshes", async () => {
  const s = fixture(), renders = [];
  s.motion.replaceSurface(() => renders.push("initial"));
  assert.deepEqual(renders, []);
  assert.equal(s.motion.deferRender(() => renders.push("latest")), true);
  s.animations[0].resolve(); await Promise.resolve();
  assert.deepEqual(renders, ["latest"]); assert.equal(s.animations.length, 2);
  s.animations[1].resolve(); await Promise.resolve();
  assert.equal(s.motion.deferRender(() => renders.push("unexpected")), false);
});

test("a context change cancels bulk Tasks presentation without rendering old-owner content", async () => {
  const s = fixture(), renders = [];
  s.motion.replaceSurface(() => renders.push("old owner")); s.motion.cancel({ flush: false });
  await Promise.resolve(); assert.deepEqual(renders, []);
});
