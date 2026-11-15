const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("landing/app.js", "utf8");
const focusEditor = source.match(/^function openTaskEditorWithFocus\(.*\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(focusEditor, "The task editor's real entrance-focus lifecycle is testable independently of unrelated form state");

function fixture({ nativeFocus = "close", immediate = false, geometry = null } = {}) {
  const listeners = new Map(), callbacks = [], focusCalls = [], focusOptions = [], scrollCalls = [];
  const document = { activeElement: null };
  const modal = {
    open: false, id: "task-modal",
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    contains(element) { return element === modal || element === form || Object.values(fields).includes(element); },
    fire(type, target) { for (const callback of [...(listeners.get(type) || [])]) callback({ type, target }); },
    focus() { document.activeElement = modal; modal.fire("focusin", modal); },
  };
  const fields = Object.fromEntries(["title", "scheduledDate", "scheduledTime", "notes", "close"].map(name => [name, {
    name: name === "close" ? "" : name, id: name === "close" ? "close-task-modal" : name,
    focus(options) { document.activeElement = this; focusCalls.push(name); focusOptions.push({ name, options }); modal.fire("focusin", this); },
    scrollIntoView(options) { scrollCalls.push({ name, options }); },
    getBoundingClientRect() { const top = (geometry?.positions?.[name] ?? (name === "title" ? 110 : 600)) - form.scrollTop; return { top, bottom: top + 40 }; },
  }]));
  const form = { id: "task-form", tagName: "FORM", elements: fields, focus() { document.activeElement = form; focusCalls.push("form"); modal.fire("focusin", form); } };
  let scrollTop = geometry?.scrollTop || 0;
  Object.defineProperty(form, "scrollTop", { get: () => scrollTop, set: value => { scrollTop = value; scrollCalls.push({ name: "form", top: value }); } });
  if (geometry) Object.assign(form, { clientTop: 2, clientHeight: 200, scrollHeight: geometry.scrollHeight ?? 1000, getBoundingClientRect: () => ({ top: 100, bottom: 304 }) });
  const outside = { id: "calendar-source" }; document.activeElement = outside;
  const context = vm.createContext({
    document, els: { modal, form }, modalAnchor: { element: outside },
    modalClosing: false, taskAlertEditorVersion: 3, plannerOwnerVersion: 10, cancelModalFocus() {},
    DuckPopupMotion: { open(element, anchor, done) {
      assert.equal(element, modal); assert.equal(anchor.element, outside);
      modal.open = true;
      if (nativeFocus === "dialog") modal.focus();
      else if (nativeFocus === "form") form.focus();
      else if (nativeFocus !== "outside") fields[nativeFocus].focus();
      if (immediate) done(); else callbacks.push(done);
    } },
  });
  vm.runInContext(focusEditor, context);
  return {
    context, document, modal, form, fields, outside, callbacks, focusCalls, focusOptions, scrollCalls,
    open(reschedule = true) { context.openTaskEditorWithFocus(reschedule, context.taskAlertEditorVersion, context.plannerOwnerVersion); },
    settle() { callbacks.shift()?.(); },
    listenerCount: () => [...listeners.values()].reduce((sum, values) => sum + values.size, 0),
    cancel() { context.cancelModalFocus(); },
  };
}

test("Reschedule overrides native default Close/form/dialog/title autofocus with the work-date field", () => {
  for (const nativeFocus of ["close", "form", "dialog", "title", "outside"]) {
    const f = fixture({ nativeFocus }); f.open();
    if (nativeFocus === "close") { assert.equal(f.document.activeElement.id, "close-task-modal"); assert.equal(f.document.activeElement.name, ""); }
    f.settle();
    assert.equal(f.document.activeElement, f.fields.scheduledDate, nativeFocus);
    assert.equal(f.focusOptions.at(-1).options.preventScroll, true, "Only the form scrollport may move; browser focus must not scroll the page");
    assert.equal(f.listenerCount(), 0);
  }
});

test("ordinary Add/Edit still focus the title after native dialog autofocus", () => {
  for (const nativeFocus of ["close", "form", "dialog", "outside"]) {
    const f = fixture({ nativeFocus }); f.open(false); f.settle();
    assert.equal(f.document.activeElement, f.fields.title, nativeFocus);
    assert.equal(f.focusOptions.at(-1).options.preventScroll, true, "Add/Edit reveal is confined to the task form");
    assert.equal(f.listenerCount(), 0);
  }
});

test("a deliberately focused control survives an unfinished Reschedule entrance", () => {
  for (const chosen of ["title", "scheduledTime", "notes", "close"]) {
    const f = fixture(); f.open(); f.fields[chosen].focus(); const before = f.focusCalls.length;
    f.settle();
    assert.equal(f.document.activeElement, f.fields[chosen], chosen);
    assert.equal(f.focusCalls.length, before, "Finishing animation must not steal the user's chosen focus");
    assert.equal(f.scrollCalls.length, 0, "Finishing animation must not scroll away from the user's chosen control");
    assert.equal(f.listenerCount(), 0);
  }
});

test("pointer, keyboard or input intent also prevents delayed focus when the active default has not changed", () => {
  for (const type of ["pointerdown", "keydown", "input"]) {
    const f = fixture({ nativeFocus: type === "input" ? "title" : "close" }); f.open();
    const chosen = f.document.activeElement, before = f.focusCalls.length;
    f.modal.fire(type, chosen); f.settle();
    assert.equal(f.document.activeElement, chosen, type);
    assert.equal(f.focusCalls.length, before);
  }
});

test("reduced-motion synchronous opening still places initial focus without leaving listeners", () => {
  for (const reschedule of [false, true]) {
    const f = fixture({ immediate: true }); f.open(reschedule);
    assert.equal(f.document.activeElement, reschedule ? f.fields.scheduledDate : f.fields.title);
    assert.equal(f.listenerCount(), 0);
  }
});

test("closed, closing, newer-editor and changed-owner callbacks cannot move focus", () => {
  const leave = [
    f => { f.modal.open = false; },
    f => { f.context.modalClosing = true; },
    f => { f.context.taskAlertEditorVersion += 1; },
    f => { f.context.plannerOwnerVersion += 1; },
  ];
  for (const change of leave) {
    const f = fixture(); f.open(); const before = f.focusCalls.length;
    change(f); f.settle();
    assert.equal(f.focusCalls.length, before); assert.equal(f.listenerCount(), 0);
  }
});

test("cancelled entrances retire listeners immediately and cannot refocus a later editor", () => {
  const f = fixture(); f.open(); const old = f.callbacks.shift();
  f.cancel(); assert.equal(f.listenerCount(), 0);
  f.context.taskAlertEditorVersion += 1; f.open(false);
  const before = f.focusCalls.length; old();
  assert.equal(f.focusCalls.length, before);
  f.settle(); assert.equal(f.document.activeElement, f.fields.title); assert.equal(f.listenerCount(), 0);
});

test("opening another editor retires the previous entrance's listener set and callback", () => {
  const f = fixture(); f.open(); const first = f.callbacks.shift();
  f.context.taskAlertEditorVersion += 1; f.open(false);
  assert.equal(f.listenerCount(), 4, "Only the current entrance owns interaction listeners");
  const before = f.focusCalls.length; first(); assert.equal(f.focusCalls.length, before);
  f.settle(); assert.equal(f.document.activeElement, f.fields.title); assert.equal(f.listenerCount(), 0);
});

test("initial focus reveals only the form scrollport for targets below, above or already inside its visible bounds", () => {
  const cases = [
    { name: "below", geometry: { scrollTop: 0, positions: { scheduledDate: 600 } }, expected: 346, writes: 1 },
    { name: "above", geometry: { scrollTop: 400, positions: { scheduledDate: 110 } }, expected: 0, writes: 1 },
    { name: "visible", geometry: { scrollTop: 100, positions: { scheduledDate: 250 } }, expected: 100, writes: 0 },
    { name: "clamped", geometry: { scrollTop: 0, positions: { scheduledDate: 1200 } }, expected: 800, writes: 1 },
  ];
  for (const item of cases) {
    const f = fixture({ geometry: item.geometry }); f.open(); f.settle();
    assert.equal(f.document.activeElement, f.fields.scheduledDate, item.name);
    assert.equal(f.form.scrollTop, item.expected, item.name);
    assert.equal(f.scrollCalls.length, item.writes, item.name);
    assert.ok(f.scrollCalls.every(call => call.name === "form"), "Reveal must not scroll another element or the page");
  }
});

test("Add/Edit reveal their title after Reschedule has scrolled, while early user choice causes no delayed scroll", () => {
  const f = fixture({ geometry: { scrollTop: 0 } }); f.open(); f.settle();
  assert.equal(f.form.scrollTop, 346);
  f.context.taskAlertEditorVersion += 1; f.open(false); f.settle();
  assert.equal(f.document.activeElement, f.fields.title); assert.equal(f.form.scrollTop, 0);
  const chosen = fixture({ geometry: { scrollTop: 0 } }); chosen.open(); chosen.fields.notes.focus();
  const focusCount = chosen.focusCalls.length; chosen.settle();
  assert.equal(chosen.document.activeElement, chosen.fields.notes);
  assert.equal(chosen.focusCalls.length, focusCount); assert.equal(chosen.scrollCalls.length, 0);
});
