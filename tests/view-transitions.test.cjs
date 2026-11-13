const test = require("node:test");
const assert = require("node:assert/strict");
const Transitions = require("../landing/view-transitions.js");

const order = ["calendar", "home", "tasks", "classes", "goals", "notes", "settings"];

function fixture({ reduced = false, supported = true } = {}) {
  function target() {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(type, callback) { listeners.set(type, callback); },
      removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
      dispatch(type) { listeners.get(type)?.(); },
    };
  }
  const media = Object.assign(target(), { matches: reduced });
  const win = Object.assign(target(), {
    matchMedia: () => media,
    setTimeout, clearTimeout,
    DuckMotion: { duration: { layout: 480 }, easing: "ease-out" },
  });
  const workspace = target();
  const animations = [];
  function view() {
    const element = { dataset: {} };
    if (supported) element.animate = (frames, options) => {
      let resolve;
      const animation = {
        frames, options, cancelled: false,
        finished: new Promise((done) => { resolve = done; }),
        cancel() { this.cancelled = true; resolve(); },
        pause() { this.paused = true; },
        finish() { resolve(); },
      };
      animations.push(animation);
      return animation;
    };
    return element;
  }
  return { win, media, workspace, animations, view, motion: Transitions.create({ window: win, workspace, order }) };
}

test("navigation order drives travel down for lower items and up for higher items", () => {
  const f = fixture();
  const tasks = f.view();
  f.motion.enter("calendar", "tasks", tasks);
  assert.equal(tasks.dataset.viewMotion, "down");
  assert.equal(f.animations[0].frames[0].transform, "translateY(-48px)");
  assert.equal(f.animations[0].frames[1].transform, "translateY(0)");
  assert.equal(f.animations[0].options.duration, 480);
  const calendar = f.view();
  f.motion.enter("tasks", "calendar", calendar);
  assert.equal(calendar.dataset.viewMotion, "up");
  assert.equal(f.animations[1].frames[0].transform, "translateY(48px)");
  assert.equal(Transitions.direction(order, "calendar", "home"), 1, "Section DOM order must not reverse Dashboard motion");
});

test("startup, same-section clicks, unknown routes, reduced motion and unsupported animation are immediate", () => {
  for (const options of [{}, { reduced: true }, { supported: false }]) {
    const f = fixture(options);
    for (const [from, to] of [[undefined, "calendar"], ["calendar", "calendar"], ["missing", "tasks"]]) {
      f.motion.enter(from, to, f.view());
    }
    assert.equal(f.animations.length, 0);
    if (options.reduced || options.supported === false) {
      const next = f.view();
      f.motion.enter("calendar", "tasks", next);
      assert.equal(next.dataset.viewMotion, undefined);
      assert.equal(f.animations.length, 0);
    }
  }
});

test("rapid reversals and stale completion cannot cancel the latest view", async () => {
  const f = fixture();
  const tasks = f.view();
  const calendar = f.view();
  f.motion.enter("calendar", "tasks", tasks);
  f.motion.enter("tasks", "calendar", calendar);
  await Promise.resolve();
  assert.equal(f.animations[0].cancelled, true);
  assert.equal(tasks.dataset.viewMotion, undefined);
  assert.equal(f.animations[1].cancelled, false);
  assert.equal(calendar.dataset.viewMotion, "up");
  f.animations[1].finish();
  await Promise.resolve();
  assert.equal(calendar.dataset.viewMotion, undefined, "Finished animations leave no transform/compositing hint behind");
  assert.equal(f.animations[1].cancelled, true);
});

test("content interaction, resize, page exit and a changed motion preference settle before measurements", () => {
  for (const [group, type] of [["workspace", "click"], ["workspace", "focusin"], ["workspace", "wheel"], ["workspace", "touchmove"], ["workspace", "keydown"], ["win", "resize"], ["win", "pagehide"], ["win", "pointercancel"], ["win", "blur"], ["media", "change"]]) {
    const f = fixture();
    const next = f.view();
    f.motion.enter("calendar", "tasks", next);
    f[group].dispatch(type);
    assert.equal(f.animations[0].cancelled, true, type);
    assert.equal(next.dataset.viewMotion, undefined, type);
  }
});

test("a pointer press holds the moving target until click capture, before measuring its popup", async () => {
  const f = fixture();
  const next = f.view();
  f.motion.enter("calendar", "tasks", next);
  f.workspace.dispatch("pointerdown");
  f.workspace.dispatch("focusin");
  assert.equal(f.animations[0].paused, true);
  assert.equal(f.animations[0].cancelled, false, "Pointer focus must not move the held target");
  f.win.dispatch("pointerup");
  f.workspace.dispatch("click");
  assert.equal(f.animations[0].cancelled, true);
  assert.equal(next.dataset.viewMotion, undefined);
  f.motion.enter("tasks", "calendar", next);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.animations[1].cancelled, false, "Old pointer release cannot cancel a new navigation");
  f.workspace.dispatch("pointerdown");
  f.win.dispatch("pointerup");
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.animations[1].cancelled, true, "Releasing outside content cannot leave a paused view");
});

test("duplicate pointer releases cannot leave a stale timer that cancels the next navigation", async () => {
  const f = fixture();
  f.motion.enter("calendar", "tasks", f.view());
  f.workspace.dispatch("pointerdown");
  f.win.dispatch("pointerup");
  f.win.dispatch("pointerup");
  f.motion.enter("tasks", "calendar", f.view());
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.animations[1].cancelled, false);
  f.motion.destroy();
});

test("destroy removes all listeners and settles any live view", () => {
  const f = fixture();
  f.motion.enter("calendar", "tasks", f.view());
  f.motion.destroy();
  assert.equal(f.animations[0].cancelled, true);
  assert.equal(f.workspace.listeners.size + f.win.listeners.size + f.media.listeners.size, 0);
});
