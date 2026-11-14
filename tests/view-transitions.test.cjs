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

function inlineStyle(initial = {}) {
  const properties = new Map(), priorities = new Map();
  for (const [name, entry] of Object.entries(initial)) {
    const [value, priority = ""] = Array.isArray(entry) ? entry : [entry];
    properties.set(name, value); priorities.set(name, priority);
  }
  return {
    properties, priorities,
    getPropertyValue: name => properties.get(name) || "",
    getPropertyPriority: name => priorities.get(name) || "",
    setProperty(name, value, priority = "") { properties.set(name, value); priorities.set(name, priority); },
    removeProperty(name) { properties.delete(name); priorities.delete(name); },
  };
}

function layer(options = {}) {
  const element = {
    insideWorkspace: options.insideWorkspace ?? true,
    style: inlineStyle(options.styles),
    bounds: { left: 100, top: 40, right: 400, bottom: 160, width: 300, height: 120, ...options.bounds },
    visualStyle: { display: "block", visibility: "visible", ...options.visualStyle },
    closest: () => options.hidden ? {} : null,
    contains: other => element.children.includes(other),
    children: options.children || [],
  };
  element.getBoundingClientRect = () => element.bounds;
  return element;
}

function fixture(options = {}) {
  const state = {
    owner: "owner-A", dialog: false, menu: false, sheet: false, shellMoving: false,
    box: { left: 80, top: 0, right: 1280, bottom: 900, width: 1200, height: 900 },
    ...options,
  };
  const style = inlineStyle(options.rootStyles), properties = style.properties;
  const originalProperties = new Map(properties), originalPriorities = new Map(style.priorities);
  const root = {
    dataset: {},
    style,
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
    innerWidth: options.innerWidth ?? 1280,
    innerHeight: options.innerHeight ?? 900,
    getComputedStyle: options.getComputedStyle || (element => element.visualStyle),
    matchMedia: query => query.includes("reduced-motion") ? reduced : coarse,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
      observe(target, config) { this.target = target; this.config = config; }
      disconnect() { this.disconnected = true; }
      notify() { if (!this.disconnected) this.callback(); }
    },
  });
  const updates = [];
  const motion = Transitions.create({ window: win, workspace, order, getOwner: () => state.owner, ...(options.getLayers ? { getLayers: options.getLayers } : {}) });
  const navigate = (from = "calendar", to = "tasks", extra = {}) => motion.navigate({ from, to, source, update: () => updates.push(to), ...extra });
  const clean = () => {
    assert.deepEqual(root.dataset, {});
    assert.deepEqual(properties, originalProperties);
    assert.deepEqual(style.priorities, originalPriorities);
  };
  return { state, root, properties, reduced, coarse, source, content, workspace, doc, native, observers, win, updates, motion, navigate, clean };
}

test("sidebar order selects forward/back motion with a fixed viewport-intersected clip", () => {
  assert.equal(Transitions.direction(order, "calendar", "home"), 1, "Calendar precedes Dashboard even though section markup has the reverse order");
  assert.equal(Transitions.direction(order, "settings", "classes"), -1);
  assert.equal(Transitions.direction(order, "tasks", "tasks"), 0);
  assert.equal(Transitions.direction(order, "missing", "tasks"), 0);
  const f = fixture();
  f.navigate("calendar", "tasks");
  assert.equal(f.root.dataset.pageTransition, "forward");
  assert.equal(f.root.dataset.pageTransitionPhase, "capture");
  assert.deepEqual(Object.fromEntries(f.properties), {
    "--route-clip-top": "0px", "--route-clip-right": "0px", "--route-clip-bottom": "0px", "--route-clip-left": "80px",
  });
  assert.equal(f.root.dataset.pageTransitionComposition, "page", "No available component layers falls back to the workspace capture");
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
  assert.equal(transition.finished.settled, false, "Routing must not wait for the visual transition");
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

test("component captures have unique phase/role names and restore inline values and priorities", async () => {
  const oldTitle = layer({ styles: { "view-transition-name": ["original-title", "important"] } });
  const newTitle = layer({ styles: { "view-transition-name": ["next-title", "important"] } });
  const extraOldTitle = layer(), extraNewTitle = layer();
  const oldControls = Array.from({ length: 4 }, () => layer()), newControls = Array.from({ length: 4 }, () => layer());
  const oldContent = Array.from({ length: 3 }, () => layer()), newContent = Array.from({ length: 3 }, () => layer());
  const targets = (title, controls, content) => [
    { role: "title", element: title }, { role: "title", element: title === oldTitle ? extraOldTitle : extraNewTitle },
    ...controls.map(element => ({ role: "controls", element })),
    ...content.map(element => ({ role: "content", element })),
  ];
  const f = fixture({
    rootStyles: { "--route-clip-left": ["7px", "important"], "--route-clip-top": "9px" },
    getLayers: route => route === "calendar" ? targets(oldTitle, oldControls, oldContent) : targets(newTitle, newControls, newContent),
  });
  f.navigate("calendar", "tasks", { update: () => {
    assert.equal(oldTitle.style.getPropertyValue("view-transition-name"), "original-title", "Old inline names are restored before updating live content");
    assert.equal(oldTitle.style.getPropertyPriority("view-transition-name"), "important");
    assert.ok([...oldControls, ...oldContent].every(element => !element.style.getPropertyValue("view-transition-name")));
    f.updates.push("tasks");
  } });
  const names = elements => elements.map(element => element.style.getPropertyValue("view-transition-name"));
  const oldNames = names([oldTitle, ...oldControls.slice(0, 3), ...oldContent.slice(0, 2)]);
  assert.deepEqual(oldNames, ["duck-route-old-title", "duck-route-old-controls", "duck-route-old-controls-1", "duck-route-old-controls-2", "duck-route-old-content", "duck-route-old-content-1"]);
  assert.equal(f.root.dataset.pageTransitionComposition, "layered");
  assert.equal(f.root.style.getPropertyPriority("--route-clip-left"), "", "Temporary clip is written without inheriting the previous important priority");
  assert.equal(oldControls[3].style.properties.size + oldContent[2].style.properties.size, 0, "Role caps bound texture count");
  assert.equal(extraOldTitle.style.properties.size, 0);
  f.native[0].capture();
  const newNames = names([newTitle, ...newControls.slice(0, 3), ...newContent.slice(0, 2)]);
  assert.deepEqual(newNames, ["duck-route-new-title", "duck-route-new-controls", "duck-route-new-controls-1", "duck-route-new-controls-2", "duck-route-new-content", "duck-route-new-content-1"]);
  assert.equal(new Set([...oldNames, ...newNames]).size, 12, "Old and new snapshots never accidentally pair by the same name");
  assert.equal(extraNewTitle.style.properties.size, 0);
  f.native[0].finished.resolve(); await flush();
  assert.equal(newTitle.style.getPropertyValue("view-transition-name"), "next-title");
  assert.equal(newTitle.style.getPropertyPriority("view-transition-name"), "important");
  assert.ok([...newControls, ...newContent].every(element => element.style.properties.size === 0));
  f.clean(); f.motion.destroy();
});

test("fixed clip bounds intersect the viewport and original clip declarations survive cleanup", () => {
  for (const [box, expected] of [
    [{ left: -20, top: -10, right: 1400, bottom: 1000, width: 1420, height: 1010 }, ["0px", "0px", "0px", "0px"]],
    [{ left: 80, top: 40, right: 1080, bottom: 740, width: 1000, height: 700 }, ["40px", "200px", "160px", "80px"]],
  ]) {
    const f = fixture({ box, rootStyles: { "--route-clip-bottom": ["11px", "important"] } });
    f.navigate();
    assert.deepEqual(["top", "right", "bottom", "left"].map(edge => f.properties.get(`--route-clip-${edge}`)), expected);
    f.motion.cancel(); f.clean(); f.motion.destroy();
  }
  for (const box of [
    { left: -200, top: 0, right: -10, bottom: 200, width: 190, height: 200 },
    { left: 1300, top: 0, right: 1400, bottom: 200, width: 100, height: 200 },
    { left: 100, top: 950, right: 300, bottom: 1050, width: 200, height: 100 },
  ]) {
    const f = fixture({ box }); f.navigate();
    assert.deepEqual(f.updates, ["tasks"]); assert.equal(f.native.length, 0);
    f.clean(); f.motion.destroy();
  }
});

test("incoming content capture selects a surface backing while long-body fallback uses content backing", async () => {
  for (const [label, bounds, expected] of [
    ["bounded content", {}, "surface"],
    ["oversized content", { height: 1600, bottom: 1640 }, "content"],
    ["offscreen content", { top: 950, bottom: 1050, height: 100 }, "content"],
  ]) {
    const oldTitle = layer(), newTitle = layer(), body = layer({ bounds });
    const f = fixture({ getLayers: route => route === "calendar"
      ? [{ role: "title", element: oldTitle }]
      : [{ role: "title", element: newTitle }, { role: "content", element: body }],
    });
    f.navigate();
    assert.equal(f.root.dataset.pageTransitionComposition, "layered", label);
    assert.equal(f.root.dataset.pageTransitionBacking, undefined, "Backing is decided using incoming capture availability");
    f.native[0].capture();
    assert.equal(f.root.dataset.pageTransitionBacking, expected, label);
    assert.equal(newTitle.style.getPropertyValue("view-transition-name"), "duck-route-new-title", label);
    assert.equal(body.style.getPropertyValue("view-transition-name"), expected === "surface" ? "duck-route-new-content" : "", label);
    f.native[0].finished.resolve(); await flush();
    f.clean(); f.motion.destroy();
  }
});

test("layer selection excludes hidden, offscreen, oversized and overlapping capture targets", () => {
  const excluded = [
    ["outside workspace", () => layer({ insideWorkspace: false })],
    ["hidden or inert ancestor", () => layer({ hidden: true })],
    ["display none", () => layer({ visualStyle: { display: "none" } })],
    ["visibility hidden", () => layer({ visualStyle: { visibility: "hidden" } })],
    ["visibility collapse", () => layer({ visualStyle: { visibility: "collapse" } })],
    ["zero width", () => layer({ bounds: { width: 0 } })],
    ["zero height", () => layer({ bounds: { height: 0 } })],
    ["left of clip", () => layer({ bounds: { left: 0, right: 80, width: 80 } })],
    ["below clip", () => layer({ bounds: { top: 900, bottom: 1000, height: 100 } })],
    ["oversized height", () => layer({ bounds: { bottom: 1400, height: 1360 } })],
    ["oversized width", () => layer({ bounds: { right: 2000, width: 1900 } })],
    ["no inline style", () => { const target = layer(); delete target.style; return target; }],
    ["workspace itself", f => { f.workspace.style = inlineStyle({ "view-transition-name": "workspace-name" }); return f.workspace; }],
  ];
  for (const [label, create] of excluded) {
    const valid = layer(); let bad;
    const f = fixture({ getLayers: () => [{ role: "content", element: bad }, { role: "content", element: valid }] });
    bad = create(f); const previous = bad.style?.getPropertyValue("view-transition-name");
    f.navigate();
    assert.equal(valid.style.getPropertyValue("view-transition-name"), "duck-route-old-content", label);
    assert.equal(bad.style?.getPropertyValue("view-transition-name"), previous, label);
    f.motion.destroy(); f.clean();
  }
  for (const parentFirst of [false, true]) {
    const child = layer(), parent = layer({ children: [child] }), peer = layer(), unknown = layer();
    const initial = parentFirst ? [parent, child] : [child, parent];
    const f = fixture({ getLayers: () => [
      { role: "unexpected", element: unknown },
      ...[...initial, initial[0], peer].map(element => ({ role: "content", element })),
    ] });
    f.navigate();
    assert.equal(initial[0].style.getPropertyValue("view-transition-name"), "duck-route-old-content");
    assert.equal(initial[1].style.properties.size, 0, "A parent/child pair is never named twice");
    assert.equal(peer.style.getPropertyValue("view-transition-name"), "duck-route-old-content-1");
    assert.equal(unknown.style.properties.size, 0);
    f.motion.destroy(); f.clean();
  }
});

test("component getter failures roll back partial naming and fall back without blocking routes", async () => {
  for (const failure of ["layers", "bounds", "computed style"]) {
    const first = layer({ styles: { "view-transition-name": ["preserved-name", "important"] } }), broken = layer();
    if (failure === "bounds") broken.getBoundingClientRect = () => { throw new Error("Detached target"); };
    const f = fixture({
      getLayers: () => { if (failure === "layers") throw new Error("Unavailable target collection"); return [{ role: "title", element: first }, { role: "controls", element: broken }]; },
      getComputedStyle: element => { if (failure === "computed style" && element === broken) throw new Error("Unavailable computed style"); return element.visualStyle; },
    });
    f.navigate();
    assert.equal(f.root.dataset.pageTransitionComposition, "page", failure);
    assert.equal(first.style.getPropertyValue("view-transition-name"), "preserved-name", failure);
    assert.equal(first.style.getPropertyPriority("view-transition-name"), "important", failure);
    f.native[0].capture(); f.native[0].finished.resolve(); await flush();
    assert.deepEqual(f.updates, ["tasks"], failure); f.clean(); f.motion.destroy();
  }
  const old = layer(), firstNew = layer({ styles: { "view-transition-name": ["destination-name", "important"] } });
  const brokenNew = layer(); brokenNew.getBoundingClientRect = () => { throw new Error("Destination disappeared"); };
  const f = fixture({ getLayers: route => route === "calendar" ? [{ role: "title", element: old }] : [{ role: "title", element: firstNew }, { role: "controls", element: brokenNew }] });
  f.navigate(); f.native[0].capture();
  assert.deepEqual(f.updates, ["tasks"]);
  assert.equal(old.style.properties.size, 0);
  assert.equal(firstNew.style.getPropertyValue("view-transition-name"), "destination-name");
  assert.equal(firstNew.style.getPropertyPriority("view-transition-name"), "important");
  f.motion.destroy(); f.clean();
});

test("layer names and inline priorities are restored on cancellation and native failures", async () => {
  for (const phase of ["cancel before capture", "cancel after capture", "start", "ready", "finished", "update"]) {
    const old = layer({ styles: { "view-transition-name": ["old-name", "important"] } }), next = layer({ styles: { "view-transition-name": ["next-name", "important"] } });
    const f = fixture({ throwOnStart: phase === "start", getLayers: route => [{ role: "title", element: route === "calendar" ? old : next }] });
    f.navigate("calendar", "tasks", phase === "update" ? { update: () => { throw new Error("Route update failed"); } } : {});
    if (phase === "cancel before capture") f.motion.cancel();
    if (phase === "cancel after capture") { f.native[0].capture(); f.motion.cancel(); }
    if (phase === "ready" || phase === "finished") f.native[0][phase].reject(new Error("Snapshot failed"));
    if (phase === "update") f.native[0].capture();
    await flush();
    assert.equal(old.style.getPropertyValue("view-transition-name"), "old-name", phase);
    assert.equal(old.style.getPropertyPriority("view-transition-name"), "important", phase);
    assert.equal(next.style.getPropertyValue("view-transition-name"), "next-name", phase);
    assert.equal(next.style.getPropertyPriority("view-transition-name"), "important", phase);
    f.clean(); f.motion.destroy();
  }
});

test("stale, reentrant and owner-changing callbacks cannot tag layers over the latest route", async () => {
  const calendar = layer(), tasks = layer(), notes = layer();
  const getLayers = route => [{ role: "title", element: { calendar, tasks, notes }[route] }];
  const f = fixture({ getLayers });
  f.navigate("calendar", "tasks"); const stale = f.native[0];
  f.navigate("calendar", "notes"); const latest = f.native[1];
  stale.capture(); stale.ready.resolve(); stale.finished.resolve(); await flush();
  assert.equal(calendar.style.getPropertyValue("view-transition-name"), "duck-route-old-title");
  assert.equal(tasks.style.properties.size, 0);
  latest.capture();
  assert.equal(notes.style.getPropertyValue("view-transition-name"), "duck-route-new-title");
  stale.capture(); await flush();
  assert.equal(notes.style.getPropertyValue("view-transition-name"), "duck-route-new-title");
  latest.finished.resolve(); await flush(); f.clean(); f.motion.destroy();

  const g = fixture({ getLayers });
  g.navigate("calendar", "tasks", { update: () => { g.updates.push("tasks"); g.navigate("tasks", "notes"); } });
  g.native[0].capture();
  assert.equal(tasks.style.getPropertyValue("view-transition-name"), "duck-route-old-title", "A nested navigation keeps ownership of its old phase");
  assert.equal(notes.style.properties.size, 0);
  g.native[0].finished.resolve(); await flush();
  assert.equal(tasks.style.getPropertyValue("view-transition-name"), "duck-route-old-title");
  g.native[1].capture();
  assert.equal(notes.style.getPropertyValue("view-transition-name"), "duck-route-new-title");
  g.motion.destroy(); g.clean();

  const h = fixture({ getLayers });
  h.navigate("calendar", "tasks", { update: () => { h.updates.push("tasks"); h.state.owner = "owner-B"; } });
  h.native[0].capture();
  assert.equal(tasks.style.properties.size, 0, "An owner change inside the update cannot assign destination capture names");
  h.motion.cancel();
  h.navigate("tasks", "notes");
  h.native[0].capture(); h.native[0].finished.resolve(); await flush();
  assert.equal(tasks.style.getPropertyValue("view-transition-name"), "duck-route-old-title", "Retired-owner callbacks cannot clear the new owner's source layer");
  h.native[1].capture();
  assert.equal(notes.style.getPropertyValue("view-transition-name"), "duck-route-new-title");
  h.motion.cancel();
  assert.ok([calendar, tasks, notes].every(element => element.style.properties.size === 0));
  h.clean(); h.motion.destroy();
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
