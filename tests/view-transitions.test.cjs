const test = require("node:test");
const assert = require("node:assert/strict");
const Transitions = require("../landing/view-transitions.js");

const order = ["calendar", "home", "tasks", "classes", "goals", "notes", "settings"];
const flush = () => Promise.resolve();

function deferred() {
  let resolve, reject;
  const result = { settled: false };
  result.promise = new Promise((yes, no) => {
    resolve = value => { result.settled = true; yes(value); };
    reject = error => { result.settled = true; no(error); };
  });
  return Object.assign(result, { resolve, reject });
}

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
    dispatch(name, event = {}) { listeners.get(name)?.(event); },
  };
}

function fixture(options = {}) {
  const state = {
    owner: "owner-A", dialog: false, menu: false, sheet: false, shellMoving: false,
    box: { left: 80, top: 0, right: 1280, bottom: 900, width: 1200, height: 900 },
    ...options,
  };
  const properties = new Map();
  const root = {
    dataset: {},
    style: { setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name) },
  };
  const reduced = Object.assign(eventTarget(), { matches: Boolean(options.reduced) });
  const coarse = Object.assign(eventTarget(), { matches: Boolean(options.coarse) });
  const source = { name: "sidebar button" };
  const content = { insideWorkspace: true };
  const workspace = {
    contains: target => target === workspace || Boolean(target?.insideWorkspace),
    getBoundingClientRect: () => state.box,
    parentElement: { getAnimations: () => state.shellMoving ? [{ playState: "running" }] : [] },
  };
  const doc = Object.assign(eventTarget(), {
    documentElement: root,
    hidden: Boolean(options.hidden),
    body: { classList: { contains: name => name === "task-panel-open" && state.sheet } },
    querySelector: selector => selector === "dialog[open]" ? state.dialog : selector === "#template-management-menu" ? state.menu : null,
  });
  const native = [];
  if (options.supported !== false) doc.startViewTransition = callback => {
    if (state.throwOnStart) throw new Error("Native capture unavailable");
    const ready = deferred(), finished = deferred(), update = deferred();
    const transition = {
      ready: ready.promise, finished: finished.promise, updateCallbackDone: update.promise,
      skips: 0,
      skipTransition() { this.skips += 1; },
    };
    native.push({
      transition, ready, finished, update,
      capture() {
        // Skipping a native transition does not suppress its deferred DOM callback.
        try { callback(); update.resolve(); }
        catch (error) { update.reject(error); }
      },
    });
    return transition;
  };
  const observers = [];
  const win = Object.assign(eventTarget(), {
    document: doc,
    matchMedia: query => query.includes("reduced-motion") ? reduced : coarse,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
      observe(target, config) { this.target = target; this.config = config; }
      disconnect() { this.disconnected = true; }
      notify() { if (!this.disconnected) this.callback(); }
    },
  });
  const updates = [];
  const motion = Transitions.create({ window: win, workspace, order, getOwner: () => state.owner });
  const navigate = (from = "calendar", to = "tasks", extra = {}) => motion.navigate({ from, to, source, update: () => updates.push(to), ...extra });
  const clean = () => {
    assert.deepEqual(root.dataset, {});
    assert.equal(properties.size, 0);
  };
  return { state, root, properties, reduced, coarse, source, content, workspace, doc, native, observers, win, updates, motion, navigate, clean };
}

test("sidebar order selects forward/back page stacks and uses the visible workspace height", () => {
  assert.equal(Transitions.direction(order, "calendar", "home"), 1, "Calendar precedes Dashboard even though section markup has the reverse order");
  assert.equal(Transitions.direction(order, "settings", "classes"), -1);
  assert.equal(Transitions.direction(order, "tasks", "tasks"), 0);
  assert.equal(Transitions.direction(order, "missing", "tasks"), 0);
  const f = fixture();
  f.navigate("calendar", "tasks");
  assert.equal(f.root.dataset.pageTransition, "forward");
  assert.equal(f.root.dataset.pageTransitionPhase, "capture");
  assert.equal(f.properties.get("--page-height"), "900px");
  f.navigate("tasks", "calendar");
  assert.equal(f.root.dataset.pageTransition, "back");
  assert.equal(f.native[0].transition.skips, 1);
  f.motion.destroy();
  f.clean();
});

test("route commits in the native capture callback before ready or animation completion", async () => {
  const f = fixture();
  f.navigate();
  assert.deepEqual(f.updates, []);
  const transition = f.native[0];
  transition.capture();
  assert.deepEqual(f.updates, ["tasks"]);
  assert.equal(transition.ready.settled, false);
  assert.equal(transition.finished.settled, false, "Routing must not wait for the 480ms visual transition");
  transition.ready.resolve();
  await flush();
  assert.equal(f.root.dataset.pageTransitionPhase, "animate");
  transition.capture();
  assert.deepEqual(f.updates, ["tasks"], "A route can only be committed once");
  transition.finished.resolve();
  await flush();
  f.clean();
  f.motion.destroy();
});

test("rapid pending navigation keeps only the latest route and ignores stale callbacks and completions", async () => {
  const f = fixture();
  f.navigate("calendar", "tasks");
  const old = f.native[0];
  f.navigate("calendar", "notes");
  const latest = f.native[1];
  old.capture();
  old.ready.resolve();
  old.finished.resolve();
  await flush();
  assert.deepEqual(f.updates, [], "Skipping the old animation cannot permit its queued update to run");
  assert.equal(f.root.dataset.pageTransition, "forward");
  assert.equal(f.root.dataset.pageTransitionPhase, "capture");
  assert.equal(latest.transition.skips, 0);
  latest.capture();
  latest.ready.resolve();
  await flush();
  assert.deepEqual(f.updates, ["notes"]);
  latest.finished.resolve();
  await flush();
  f.clean();
  f.motion.destroy();
});

test("settling a route cannot invalidate a newer navigation requested during its update", () => {
  const f = fixture();
  f.navigate("calendar", "tasks", { update: () => {
    f.updates.push("tasks");
    f.navigate("tasks", "notes");
  } });
  f.motion.settle();
  assert.equal(f.native.length, 2);
  assert.equal(f.native[1].transition.skips, 0);
  f.native[0].capture();
  f.native[1].capture();
  assert.deepEqual(f.updates, ["tasks", "notes"]);
  f.motion.destroy();
  f.clean();
});

test("owner changes prevent a pending private route from committing even when the native callback arrives later", async () => {
  for (const terminate of ["settle", "cancel"]) {
    const f = fixture();
    f.navigate();
    const old = f.native[0];
    f.state.owner = "owner-B";
    f.motion[terminate]();
    f.clean();
    old.capture(); old.ready.resolve(); old.finished.resolve();
    await flush();
    assert.deepEqual(f.updates, [], terminate);
    f.navigate("calendar", "goals");
    f.native[1].capture();
    assert.deepEqual(f.updates, ["goals"], "The next owner can navigate normally");
    f.motion.destroy();
  }
});

test("startup, same/unknown routes and unsafe animation contexts update immediately without snapshots", () => {
  const cases = [
    ["reduced motion", { reduced: true }], ["coarse touch", { coarse: true }],
    ["unsupported browser", { supported: false }], ["hidden document", { hidden: true }],
    ["open popup", { dialog: true }], ["open phone sheet", { sheet: true }],
    ["moving navigation shell", { shellMoving: true }],
    ["zero viewport", { box: { left: 80, top: 0, right: 80, bottom: 0, width: 0, height: 0 } }],
  ];
  for (const [name, options] of cases) {
    const f = fixture(options);
    f.navigate();
    assert.deepEqual(f.updates, ["tasks"], name);
    assert.equal(f.native.length, 0, name);
    f.clean(); f.motion.destroy();
  }
  for (const [from, to] of [[undefined, "calendar"], ["tasks", "tasks"], ["missing", "tasks"]]) {
    const f = fixture();
    f.motion.navigate({ from, to, source: f.source, update: () => f.updates.push(to) });
    assert.deepEqual(f.updates, [to]); assert.equal(f.native.length, 0);
    f.motion.destroy();
  }
  for (const sourceType of ["content", "absent"]) {
    const f = fixture();
    f.navigate("calendar", "tasks", { source: sourceType === "content" ? f.content : null });
    assert.deepEqual(f.updates, ["tasks"]); assert.equal(f.native.length, 0);
    f.motion.destroy();
  }
});

test("desktop pointer entry settles a pending route before content interaction and prevents duplicate commits", () => {
  const f = fixture();
  f.doc.dispatch("pointermove", { clientX: 20, clientY: 200 });
  f.navigate();
  const transition = f.native[0];
  f.doc.dispatch("pointermove", { clientX: 100, clientY: 200 });
  assert.deepEqual(f.updates, ["tasks"]);
  assert.equal(transition.transition.skips, 1);
  f.clean();
  transition.capture();
  assert.deepEqual(f.updates, ["tasks"]);
  f.navigate("tasks", "notes");
  assert.deepEqual(f.updates, ["tasks", "notes"], "A pointer already inside main content keeps subsequent navigation immediate");
  assert.equal(f.native.length, 1);
  f.motion.destroy();
});

test("pointer-down, content keyboard/focus, preferences, resize and page exit settle with complete cleanup", () => {
  const cases = [
    ["doc", "pointerdown", { clientX: 100, clientY: 200, pointerType: "mouse" }],
    ["doc", "pointerdown", { clientX: 20, clientY: 200, pointerType: "touch" }],
    ["doc", "focusin", "content"], ["doc", "keydown", "content"],
    ["doc", "wheel"], ["doc", "touchstart"], ["reduced", "change"], ["coarse", "change"],
    ["win", "resize"], ["win", "pagehide"], ["win", "blur"],
  ];
  for (const [target, event, data] of cases) {
    const f = fixture();
    f.navigate();
    f[target].dispatch(event, data === "content" ? { target: f.content } : data);
    assert.deepEqual(f.updates, ["tasks"], `${target}:${event}`);
    assert.equal(f.native[0].transition.skips, 1);
    f.clean(); f.motion.destroy();
  }
  const f = fixture();
  f.navigate();
  f.doc.dispatch("focusin", { target: f.source });
  assert.deepEqual(f.updates, [], "Sidebar focus remains outside the captured page");
  f.motion.destroy();
});

test("new native dialogs or template management popups settle snapshots without duplicating their route update", () => {
  for (const popup of ["dialog", "menu"]) {
    const f = fixture();
    f.navigate();
    f.state[popup] = true;
    f.observers[0].notify();
    assert.deepEqual(f.updates, ["tasks"]);
    assert.equal(f.native[0].transition.skips, 1);
    f.clean();
    f.native[0].capture();
    assert.deepEqual(f.updates, ["tasks"]);
    f.motion.destroy();
  }
});

test("snapshot setup/ready/finished failures fall back to one route commit and clear transient state", async () => {
  const failedStart = fixture({ throwOnStart: true });
  failedStart.navigate();
  assert.deepEqual(failedStart.updates, ["tasks"]); failedStart.clean(); failedStart.motion.destroy();
  for (const phase of ["ready", "finished"]) {
    const f = fixture();
    f.navigate();
    f.native[0][phase].reject(new Error("Visual transition unavailable"));
    await flush();
    assert.deepEqual(f.updates, ["tasks"], phase);
    f.clean();
    f.native[0].capture();
    assert.deepEqual(f.updates, ["tasks"]);
    f.motion.destroy();
  }
});

test("a failing update callback cleans the transition without retrying a partial route mutation", async () => {
  const f = fixture();
  let attempts = 0;
  f.navigate("calendar", "tasks", { update: () => { attempts += 1; throw new Error("Route update failed"); } });
  f.native[0].capture();
  await flush();
  assert.equal(attempts, 1);
  f.clean();
  f.native[0].finished.resolve();
  await flush();
  assert.equal(attempts, 1);
  f.motion.destroy();
});

test("destroy invalidates pending callbacks, removes every event listener and disconnects popup observation", async () => {
  const f = fixture();
  f.navigate();
  const transition = f.native[0];
  f.motion.destroy();
  assert.equal(transition.transition.skips, 1);
  assert.equal(f.doc.listeners.size + f.win.listeners.size + f.reduced.listeners.size + f.coarse.listeners.size, 0);
  assert.equal(f.observers[0].disconnected, true);
  transition.capture(); transition.ready.resolve(); transition.finished.resolve();
  await flush();
  assert.deepEqual(f.updates, []);
  f.clean();
});
