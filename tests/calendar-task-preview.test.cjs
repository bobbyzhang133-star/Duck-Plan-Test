const test = require("node:test");
const assert = require("node:assert/strict");
const Preview = require("../landing/calendar-task-preview.js");
const Model = require("../landing/planner-model.js");

class Element {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.parentNode = null;
    this.attributes = new Map(); this.dataset = {}; this.events = new Map(); this.style = { setProperty() {} };
    this.className = ""; this.hidden = false; this.disabled = false; this.open = false; this.value = ""; this._text = "";
    this.classList = { contains: value => this.className.split(/\s+/).includes(value) };
  }
  get isConnected() { return this === this.ownerDocument.body || Boolean(this.parentNode?.isConnected); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
  set textContent(value) { this._text = String(value); this.children.forEach(child => { child.parentNode = null; }); this.children = []; }
  append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  matches(selector) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    const attribute = /^\[([^\]]+)\]$/.exec(selector)?.[1];
    if (attribute?.startsWith("data-")) return Object.hasOwn(this.dataset, attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()));
    if (attribute === "tabindex") return this.tabIndex !== undefined;
    if (attribute) return this.attributes.has(attribute);
    return this.tagName.toLowerCase() === selector;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
  querySelectorAll(selector) {
    const selectors = selector.split(",").map(value => value.trim()), result = [];
    for (const child of this.children) { if (selectors.some(value => child.matches(value))) result.push(child); result.push(...child.querySelectorAll(selector)); }
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(name, callback) { this.events.set(name, callback); }
  fire(name, event = {}) { event.target ||= this; event.preventDefault ||= () => { event.prevented = true; }; return this.events.get(name)?.(event); }
  getClientRects() { return this.hidden ? [] : [{ width: 100, height: 40 }]; }
  getBoundingClientRect() { return { left: 100, top: 100, right: 500, bottom: 500, width: 400, height: 400 }; }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.fire("close"); }
}

function fixture({ deferredClose = false } = {}) {
  const doc = { defaultView: {}, activeElement: null };
  doc.createElement = tag => new Element(tag, doc); doc.body = doc.createElement("body");
  doc.querySelector = selector => doc.body.querySelector(selector);
  let owner = "A", version = 0, view = "calendar";
  let tasks = [
    { id: "alpha", title: '<img src=x onerror="bad()"> Alpha', notes: "First line\n<script>plain text</script>", priority: "High", dueDate: "2030-05-02", dueTime: "00:00", scheduledStart: "2030-05-01T23:30", durationMinutes: 90, completed: false },
    { id: "beta", title: "Beta", priority: "Medium", dueDate: "", scheduledStart: null, durationMinutes: 45, completed: false },
  ];
  const calendar = doc.createElement("section"); calendar.id = "planner-calendar";
  const today = doc.createElement("button"); today.id = "calendar-today";
  const source = doc.createElement("button"); source.className = "deadline-chip"; source.dataset = { editTask: "alpha", calendarKind: "deadline" };
  calendar.append(source); doc.body.append(today, calendar); doc.activeElement = source;
  const calls = [], pending = [], toasts = [], errors = [], editors = [], closing = [], motionCalls = [];
  const store = {
    mode: "cloud", get user() { return { id: owner }; }, listItems: () => tasks,
    toggleComplete(id, completed) { calls.push({ id, completed, owner }); const capturedOwner = owner; return new Promise((resolve, reject) => pending.push({
      reject, resolve() { if (capturedOwner === owner) tasks = tasks.map(task => task.id === id ? { ...task, completed } : task); resolve(); },
    })); },
  };
  const motion = {
    capture(element) { motionCalls.push(["capture", element]); return { element, rect: element?.getBoundingClientRect() }; },
    open(element, anchor, done) { motionCalls.push(["open", element, anchor]); done(); },
    close(element, anchor, done) { motionCalls.push(["close", element, anchor]); if (deferredClose) closing.push(done); else done(); },
    cancel(element) { motionCalls.push(["cancel", element]); },
  };
  const api = Preview.create({ document: doc, store, model: Model, motion, getOwnerVersion: () => version, getView: () => view,
    classInfo: () => ({ name: "Calculus", color: "#538fc5" }), formatShortDate: value => `short:${value}`, formatLongDate: value => `long:${value}`, formatTime: value => `time:${value}`,
    openTask: options => editors.push(options), showToast: value => toasts.push(value), reportError: error => errors.push(error),
  });
  return { api, doc, source, calendar, today, calls, pending, toasts, errors, editors, closing, motionCalls,
    dialog: () => doc.querySelector("#calendar-task-preview"), button: name => doc.querySelector(`#calendar-preview-${name}`),
    click(name) { return this.dialog().fire("click", { target: this.button(name) }); },
    replaceTask(id, update) { tasks = tasks.map(task => task.id === id ? { ...task, ...update } : task); },
    deleteTask(id) { tasks = tasks.filter(task => task.id !== id); },
    setOwner(value) { owner = value; version += 1; }, setView(value) { view = value; },
    get tasks() { return tasks; },
  };
}

test("calendar preview uses one native dialog with plaintext details and complete overnight work/deadline dates", () => {
  const f = fixture(); assert.equal(f.api.open("alpha", f.source), true);
  const dialog = f.dialog();
  assert.equal(dialog.tagName, "DIALOG"); assert.equal(dialog.querySelector("form"), null);
  assert.equal(dialog.classList.contains("task-modal"), false);
  assert.equal(dialog.querySelector("#calendar-preview-title").textContent, f.tasks[0].title);
  assert.equal(dialog.querySelector("script"), null);
  assert.match(dialog.querySelector(".calendar-preview-notes").textContent, /<script>plain text<\/script>/);
  assert.match(dialog.querySelector(".calendar-preview-dates").textContent, /short:2030-05-01 · time:23:30–short:2030-05-02 · time:01:00/);
  assert.match(dialog.querySelector(".calendar-preview-warning").textContent, /Work ends after the deadline/);
  assert.equal(f.calls.length, 0); assert.equal(f.editors.length, 0);
  assert.equal(f.api.open("alpha", f.source), true);
  assert.equal(f.doc.body.querySelectorAll("dialog").length, 1);
  assert.equal(f.api.open("missing", f.source), false);
  f.api.destroy(); assert.equal(f.api.isOpen, false);
});

test("Edit and Reschedule wait for preview closing and keep the original calendar launcher", () => {
  for (const action of ["edit", "reschedule"]) {
    const f = fixture({ deferredClose: true }); f.api.open("alpha", f.source); f.click(action);
    assert.equal(f.editors.length, 0); assert.equal(f.dialog().inert, true);
    f.closing.shift()();
    assert.equal(f.api.isOpen, false); assert.equal(f.editors.length, 1);
    assert.equal(f.editors[0].id, "alpha"); assert.equal(f.editors[0].source, f.source);
    assert.equal(Boolean(f.editors[0].reschedule), action === "reschedule");
    assert.equal(f.calls.length, 0);
  }
});

test("Complete suppresses duplicate clicks, preserves task identity and refreshes the existing preview controls", async () => {
  const f = fixture(); f.api.open("alpha", f.source); const dialog = f.dialog(), button = f.button("complete");
  const operation = f.click("complete"); f.click("complete");
  assert.equal(f.calls.length, 1); assert.deepEqual(f.calls[0], { id: "alpha", completed: true, owner: "A" });
  assert.equal(button.disabled, true); assert.equal(dialog.getAttribute("aria-busy"), "true");
  f.replaceTask("alpha", { notes: "Remote notes during save" }); f.api.sync();
  assert.equal(f.dialog(), dialog); assert.equal(f.button("complete"), button); assert.equal(button.disabled, true);
  f.pending.shift().resolve(); await operation;
  assert.equal(f.tasks.length, 2); assert.equal(f.tasks[0].completed, true); assert.equal(f.tasks[1].completed, false);
  assert.equal(button.disabled, false); assert.equal(button.textContent, "Mark incomplete");
  assert.equal(dialog.querySelector(".calendar-preview-status").textContent, "Completed");
  assert.deepEqual(f.toasts, ["Task completed."]); assert.equal(f.doc.activeElement, button);
  assert.equal(dialog.querySelector(".calendar-preview-warning").hidden, true);
  const reopen = f.click("complete"); f.pending.shift().resolve(); await reopen;
  assert.equal(f.tasks[0].completed, false); assert.equal(button.textContent, "Mark complete");
});

test("a failed completion keeps the preview open with an error and permits a single retry", async () => {
  const f = fixture(); f.api.open("alpha", f.source); const dialog = f.dialog();
  const saving = f.click("complete"); f.pending.shift().reject(new Error("Server unavailable")); await saving;
  assert.equal(f.api.isOpen, true); assert.equal(f.dialog(), dialog); assert.equal(f.tasks[0].completed, false);
  assert.equal(dialog.querySelector(".calendar-preview-error").textContent, "Server unavailable");
  assert.equal(dialog.querySelector(".calendar-preview-error").hidden, false);
  assert.equal(f.button("complete").disabled, false); assert.equal(f.toasts.length, 0); assert.equal(f.errors.length, 1);
  const retry = f.click("complete"); f.pending.shift().resolve(); await retry;
  assert.equal(f.calls.length, 2); assert.equal(dialog.querySelector(".calendar-preview-error").hidden, true);
});

test("late completion success and failure cannot change another owner's dialog or report old errors", async () => {
  for (const fail of [false, true]) {
    const f = fixture(); f.api.open("alpha", f.source); const operation = f.click("complete");
    f.setOwner("B"); f.api.sync(); assert.equal(f.api.isOpen, false);
    f.replaceTask("beta", { title: "B private task" }); f.api.open("beta", f.source); const current = f.dialog();
    if (fail) f.pending.shift().reject(new Error("A private failure")); else f.pending.shift().resolve();
    await operation;
    assert.equal(f.dialog(), current); assert.equal(current.querySelector("#calendar-preview-title").textContent, "B private task");
    assert.equal(f.toasts.length, 0); assert.equal(f.errors.length, 0);
    assert.equal(f.button("complete").disabled, false);
  }
});

test("an old handoff callback cannot open an editor after an owner change or another preview", () => {
  const f = fixture({ deferredClose: true }); f.api.open("alpha", f.source); f.click("reschedule");
  f.setOwner("B"); f.api.sync(); f.api.open("beta", f.source);
  f.closing.shift()();
  assert.equal(f.editors.length, 0); assert.equal(f.dialog().querySelector("#calendar-preview-title").textContent, "Beta");
});

test("sync closes deleted or routed-away previews and keeps live details/focus when a task changes", () => {
  const f = fixture(); f.api.open("alpha", f.source); const button = f.button("reschedule"); button.focus();
  f.replaceTask("alpha", { title: "Updated elsewhere", notes: "New notes" }); f.api.sync();
  assert.equal(f.doc.activeElement, button); assert.equal(f.dialog().querySelector("#calendar-preview-title").textContent, "Updated elsewhere");
  f.deleteTask("alpha"); f.source.remove(); f.api.sync();
  assert.equal(f.api.isOpen, false); assert.equal(f.doc.activeElement, f.today);
  f.api.open("beta", f.today); f.setView("tasks"); f.api.sync(); assert.equal(f.api.isOpen, false);
});

test("Escape/backdrop dismissal and Tab wrap preserve keyboard access and rebind detached source by kind", () => {
  const f = fixture(); f.api.open("alpha", f.source); const dialog = f.dialog(), controls = dialog.querySelectorAll("button");
  controls.at(-1).focus(); const forward = { key: "Tab", shiftKey: false }; dialog.fire("keydown", forward);
  assert.equal(forward.prevented, true); assert.equal(f.doc.activeElement, controls[0]);
  const backward = { key: "Tab", shiftKey: true }; dialog.fire("keydown", backward);
  assert.equal(backward.prevented, true); assert.equal(f.doc.activeElement, controls.at(-1));
  f.source.remove();
  const work = f.doc.createElement("button"); work.dataset = { editTask: "alpha", calendarKind: "work" };
  const deadline = f.doc.createElement("button"); deadline.dataset = { editTask: "alpha", calendarKind: "deadline" };
  f.calendar.append(work, deadline);
  const cancel = {}; dialog.fire("cancel", cancel);
  assert.equal(cancel.prevented, true); assert.equal(f.api.isOpen, false); assert.equal(f.doc.activeElement, deadline);
  assert.equal(f.motionCalls.filter(call => call[0] === "close").at(-1)[2].element, deadline);
  f.api.open("alpha", deadline); f.dialog().fire("click", { clientX: 50, clientY: 50 }); assert.equal(f.api.isOpen, false);
});
