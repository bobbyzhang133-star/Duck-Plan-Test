const test = require("node:test");
const assert = require("node:assert/strict");
const Drag = require("../landing/task-list-drag.js");

function eventTarget() {
  const handlers = new Map();
  return {
    handlers,
    addEventListener(name, callback) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(callback); },
    removeEventListener(name, callback) { handlers.get(name)?.delete(callback); },
    dispatch(name, event = {}) { for (const callback of handlers.get(name) || []) callback(event); },
  };
}
function element(kind, id = null, parent = null) {
  const node = {
    kind, parent, dataset: id ? { dragTask: id } : {},
    contains(other) { return other === node || Boolean(other?.parent && node.contains(other.parent)); },
    closest(selector) {
      const matches = selector.split(",").some(part => {
        const value = part.trim();
        return value === "button[data-drag-task]" && kind === "source"
          || value === '.nav-item[data-view="calendar"]' && kind === "navigation"
          || value === '[data-view="calendar"]' && ["navigation", "calendar-body"].includes(kind)
          || value === '[data-go="calendar"]' && kind === "calendar-link";
      });
      return matches ? node : parent?.closest(selector) || null;
    },
  };
  return node;
}
function transfer(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    protected: false, effectAllowed: "all", dropEffect: "none",
    get types() { return [...values.keys()]; },
    clearData() { values.clear(); },
    setData(type, value) { values.set(type, value); },
    getData(type) { return this.protected ? "" : values.get(type) || ""; },
  };
}
function event(target, dataTransfer, fields = {}) {
  return {
    target, dataTransfer, detail: 1, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...fields,
  };
}
function fixture({ hover = true } = {}) {
  const doc = eventTarget(), win = eventTarget(), timers = new Map(), tasks = new Map();
  const state = { owner: "local-owner", time: 10, preview: [], clears: 0, saved: [], opened: [], errors: {}, scheduleResult: undefined };
  tasks.set("task-a", { id: "task-a", title: "Original task", durationMinutes: 45, dueDate: "2026-11-20", classId: "physics" });
  tasks.set("task-b", { id: "task-b", title: "Other task", durationMinutes: 30 });
  let timerId = 0;
  win.performance = { now: () => state.time };
  win.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: state.time + delay }); return id; };
  win.clearTimeout = id => timers.delete(id);
  const body = element("calendar-body"), calendar = element("calendar", null, body), invalid = element("outside");
  const source = element("source", "task-a"), otherSource = element("source", "task-b");
  const navigation = element("navigation"), navigationChild = element("span", null, navigation), calendarLink = element("calendar-link");
  const placement = { date: "2026-11-18", time: "09:30", minutes: 570 };
  const fail = name => { if (state.errors[name]) throw new Error(name + " callback failed"); };
  const controller = Drag.create({ window: win, document: doc,
    getTask(id) { fail("getTask"); return tasks.get(id); },
    getOwner() { fail("getOwner"); return state.owner; },
    getPlacement(e) { fail("getPlacement"); state.onPlacement?.(); return e.target === calendar ? placement : null; },
    showPreview(task, drop) { fail("showPreview"); state.preview.push({ task, drop }); },
    clearPreview() { state.clears += 1; fail("clearPreview"); },
    schedule(task, drop) { state.saved.push({ task, drop }); fail("schedule"); return state.scheduleResult; },
    ...(hover ? { openCalendar(target) { fail("openCalendar"); state.opened.push(target); } } : {}),
  });
  const emit = (name, target = source, data = undefined, fields = {}) => { const e = event(target, data, fields); doc.dispatch(name, e); return e; };
  const begin = (target = source, data = transfer({ "text/plain": "must not leak task details" })) => { const e = emit("dragstart", target, data); return { e, data }; };
  function tick(ms) {
    const end = state.time + ms;
    while (true) {
      const first = [...timers.entries()].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!first) break;
      timers.delete(first[0]); state.time = first[1].at; first[1].callback();
    }
    state.time = end;
  }
  return { doc, win, state, tasks, timers, body, source, otherSource, calendar, invalid, navigation, navigationChild, calendarLink, placement, controller, emit, begin, tick };
}

test("native task drags expose only the internal ID and allow an ordinary click before dragging", () => {
  const f = fixture();
  assert.equal(f.emit("click").prevented, false);
  const { e, data } = f.begin(element("span", null, f.source));
  assert.equal(e.prevented, false);
  assert.deepEqual(data.types, [Drag.TASK_MIME]);
  assert.equal(data.getData(Drag.TASK_MIME), "task-a");
  assert.equal(data.effectAllowed, "move");
  assert.equal(data.getData("text/plain"), "");
  f.controller.destroy();
});

test("unknown marked tasks cannot start a drag and unrelated/template drags are untouched", () => {
  const f = fixture();
  assert.equal(f.begin(element("source", "missing")).e.prevented, true);
  const data = transfer({ "application/x-duckplan-template": "template-one" });
  assert.equal(f.emit("dragstart", f.invalid, data).prevented, false);
  f.emit("dragover", f.calendar, data); f.emit("drop", f.calendar, data); f.emit("dragend", f.invalid, data);
  assert.deepEqual(data.types, ["application/x-duckplan-template"]);
  assert.equal(f.state.preview.length, 0); assert.equal(f.state.saved.length, 0); assert.equal(f.state.clears, 0);
  f.controller.destroy();
});

test("protected dragover previews a valid destination; invalid areas offer no drop", () => {
  const f = fixture(), { data } = f.begin();
  data.protected = true;
  const valid = f.emit("dragover", f.calendar, data);
  assert.equal(valid.prevented, true); assert.equal(data.dropEffect, "move");
  assert.equal(f.state.preview.at(-1).task, f.tasks.get("task-a"));
  assert.equal(f.state.preview.at(-1).drop, f.placement);
  const invalid = f.emit("dragover", f.invalid, data);
  assert.equal(invalid.prevented, false); assert.equal(data.dropEffect, "none"); assert.equal(f.state.clears, 1);
  f.controller.destroy();
});

test("drop schedules the latest same-ID task once, preserving its existing properties", () => {
  const f = fixture(), { data } = f.begin();
  const updated = { ...f.tasks.get("task-a"), title: "Edited during drag", notes: "Keep these notes", reminderChoice: "off", actualMinutes: 12 };
  f.tasks.set("task-a", updated);
  const drop = f.emit("drop", f.calendar, data);
  f.emit("drop", f.calendar, data); f.emit("dragend");
  assert.equal(drop.prevented, true); assert.equal(f.state.saved.length, 1);
  assert.equal(f.state.saved[0].task, updated); assert.equal(f.state.saved[0].drop, f.placement);
  assert.equal(updated.scheduledStart, undefined, "Persistence and mutation belong to the host store");
  assert.equal(f.timers.size, 0);
  f.controller.destroy();
});

test("drop rechecks the current task after destination calculation and respects a prevented dragstart", () => {
  const f = fixture(), data = transfer();
  f.emit("dragstart", f.source, data, { defaultPrevented: true });
  assert.equal(data.types.length, 0);
  const started = f.begin();
  const newest = { ...f.tasks.get("task-a"), notes: "Latest saved notes" };
  f.state.onPlacement = () => f.tasks.set("task-a", newest);
  f.emit("drop", f.calendar, started.data);
  assert.equal(f.state.saved[0].task, newest);
  f.controller.destroy();
});

test("invalid drops, external IDs, foreign MIME and unreadable drop payloads never schedule", () => {
  for (const mode of ["invalid-area", "external-only", "wrong-id", "template", "protected-drop"]) {
    const f = fixture();
    let data;
    if (mode === "external-only") data = transfer({ [Drag.TASK_MIME]: "task-a" });
    else ({ data } = f.begin());
    if (mode === "wrong-id") data.setData(Drag.TASK_MIME, "task-b");
    if (mode === "template") { data.clearData(); data.setData("application/x-duckplan-template", "task-a"); }
    if (mode === "protected-drop") data.protected = true;
    const drop = f.emit("drop", mode === "invalid-area" ? f.invalid : f.calendar, data);
    assert.equal(drop.prevented, false, mode); assert.equal(f.state.saved.length, 0, mode);
    f.controller.destroy();
  }
});

test("an owner change or task deletion retires the drag before preview, timer or persistence", () => {
  for (const action of ["dragover", "drop", "timer", "deleted", "placement-owner-change"]) {
    const f = fixture(), { data } = f.begin();
    f.emit("dragover", f.navigation, data);
    if (action === "deleted") f.tasks.delete("task-a");
    else if (action === "placement-owner-change") f.state.onPlacement = () => { f.state.owner = "different-owner"; };
    else f.state.owner = "different-owner";
    if (action === "timer") f.tick(400);
    else f.emit(action === "dragover" ? "dragover" : "drop", f.calendar, data);
    assert.equal(f.state.saved.length, 0, action); assert.equal(f.state.opened.length, 0, action); assert.equal(f.timers.size, 0, action);
    f.controller.destroy();
  }
});

test("dragend, Escape, blur, pagehide and explicit cancel clear previews and hover work", () => {
  for (const action of ["dragend", "Escape", "blur", "pagehide", "cancel"]) {
    const f = fixture(), { data } = f.begin();
    f.emit("dragover", f.calendar, data); f.emit("dragover", f.navigation, data);
    if (action === "Escape") f.emit("keydown", f.source, data, { key: "Escape" });
    else if (action === "blur" || action === "pagehide") f.win.dispatch(action);
    else if (action === "cancel") f.controller.cancel();
    else f.emit(action);
    f.tick(500); f.emit("drop", f.calendar, data);
    assert.equal(f.state.opened.length, 0, action); assert.equal(f.state.saved.length, 0, action);
    assert.equal(f.timers.size, 0, action); assert.ok(f.state.clears > 0, action);
    f.controller.destroy();
  }
});

test("only the following mouse click on the dragged task is suppressed; keyboard and other tasks remain usable", () => {
  const f = fixture(), { data } = f.begin();
  f.emit("drop", f.calendar, data);
  assert.equal(f.emit("click", f.otherSource).prevented, false);
  assert.equal(f.emit("click", f.source, undefined, { detail: 0 }).prevented, false);
  const following = f.emit("click", element("span", null, f.source));
  assert.equal(following.prevented, true); assert.equal(following.stopped, true);
  assert.equal(f.emit("click").prevented, false, "A genuine second activation is immediate");
  const again = f.begin(); f.emit("dragend", f.source, again.data); f.tick(651);
  assert.equal(f.emit("click").prevented, false, "The suppression window expires");
  f.controller.destroy();
});

test("click suppression cannot affect a replacement owner with a matching task ID", () => {
  const f = fixture(), { data } = f.begin(); f.emit("dragend", f.source, data);
  f.state.owner = "replacement-owner";
  assert.equal(f.emit("click").prevented, false);
  f.controller.destroy();
});

test("a fresh pointer press can edit immediately after a canceled drag", () => {
  const f = fixture();
  f.begin(); f.emit("dragend");
  f.emit("pointerdown");
  const click = f.emit("click");
  assert.equal(click.prevented, false);
  assert.equal(click.stopped, false);
  f.controller.destroy();
});

test("Calendar arrival opens after a stationary hover without requiring another dragover", () => {
  const f = fixture(), { data } = f.begin();
  f.emit("dragenter", f.navigationChild, data); f.tick(400);
  assert.deepEqual(f.state.opened, [f.navigation]);
  assert.equal(f.state.saved.length, 0);
  f.controller.destroy();
});

test("Calendar hover opens once after 400ms and leaving or ending cancels the pending switch", () => {
  const f = fixture(), { data } = f.begin();
  f.emit("dragover", f.navigationChild, data); f.tick(399);
  assert.equal(f.state.opened.length, 0);
  f.emit("dragleave", f.navigationChild, data, { relatedTarget: f.navigation }); f.tick(1);
  assert.deepEqual(f.state.opened, [f.navigation]);
  f.emit("dragover", f.navigation, data); f.tick(500);
  assert.equal(f.state.opened.length, 1, "Repeated dragover cannot continually switch routes");
  f.emit("dragover", f.calendar, data);
  f.emit("dragover", f.calendarLink, data); f.tick(100);
  f.emit("dragleave", f.calendarLink, data, { relatedTarget: f.invalid }); f.tick(500);
  assert.equal(f.state.opened.length, 1);
  f.emit("dragover", f.calendarLink, data); f.tick(400);
  assert.equal(f.state.opened.at(-1), f.calendarLink);
  f.controller.destroy();
});

test("Calendar content/body never arms navigation hover, and the route callback is optional", () => {
  for (const enabled of [false, true]) {
    const f = fixture({ hover: enabled }), { data } = f.begin();
    f.emit("dragover", f.calendar, data); f.tick(500);
    assert.equal(f.state.opened.length, 0); assert.equal(f.timers.size, 0);
    if (!enabled) { f.emit("dragover", f.navigation, data); f.tick(500); assert.equal(f.state.opened.length, 0); }
    f.controller.destroy();
  }
});

test("callback failures leave no live drag and rejected saves do not cancel a newer drag", async () => {
  for (const name of ["getTask", "getOwner", "getPlacement", "showPreview", "clearPreview", "schedule", "openCalendar"]) {
    const f = fixture(), { data } = f.begin();
    f.state.errors[name] = true;
    assert.doesNotThrow(() => {
      if (name === "schedule") f.emit("drop", f.calendar, data);
      else if (name === "openCalendar") { f.emit("dragover", f.navigation, data); f.tick(400); }
      else { f.emit("dragover", f.calendar, data); f.controller.cancel(); }
    }, name);
    assert.equal(f.timers.size, 0, name);
    f.controller.destroy();
  }
  const f = fixture(); let reject;
  f.state.scheduleResult = new Promise((resolve, no) => { reject = no; });
  const first = f.begin(); f.emit("drop", f.calendar, first.data);
  const second = f.begin(f.otherSource); reject(new Error("Store rejected the old save"));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.emit("dragover", f.calendar, second.data).prevented, true);
  f.controller.destroy();
});

test("destroy removes listeners and timers and remains safe when repeated", () => {
  const f = fixture(), { data } = f.begin(); f.emit("dragover", f.navigation, data);
  f.controller.destroy(); f.controller.destroy(); f.tick(500);
  assert.equal(f.timers.size, 0); assert.equal(f.state.opened.length, 0);
  assert.ok([...f.doc.handlers.values(), ...f.win.handlers.values()].every(set => set.size === 0));
  assert.equal(f.emit("dragstart", f.source, data).prevented, false);
});
