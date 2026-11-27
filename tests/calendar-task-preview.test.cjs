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
  const calls = [], pending = [], toasts = [], errors = [], editors = [], closing = [], motionCalls = [], selections = [];
  let groupIDs = null, groupExists = true;
  const groupKey = "2030-05-02-0", groupDate = "2030-05-02";
  const currentGroup = () => groupExists && groupIDs ? { key: groupKey, date: groupDate, tasks: groupIDs.map(id => tasks.find(task => task.id === id)).filter(Boolean) } : null;
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
    getDeadlineGroup: (key, date) => key === groupKey && date === groupDate ? currentGroup() : null,
    onSelectTask: id => selections.push(id),
  });
  return { api, doc, source, calendar, today, calls, pending, toasts, errors, editors, closing, motionCalls, selections,
    dialog: () => doc.querySelector("#calendar-task-preview"), button: name => doc.querySelector(`#calendar-preview-${name}`),
    click(name) { return this.dialog().fire("click", { target: this.button(name) }); },
    replaceTask(id, update) { tasks = tasks.map(task => task.id === id ? { ...task, ...update } : task); },
    deleteTask(id) { tasks = tasks.filter(task => task.id !== id); },
    group(ids = ["alpha", "beta"]) {
      groupIDs = ids;
      const trigger = doc.createElement("button"); trigger.dataset = { timedDeadlineGroup: groupKey, deadlineDate: groupDate };
      trigger.setAttribute("aria-expanded", "false"); calendar.append(trigger);
      return { ...currentGroup(), source: trigger };
    },
    hideGroup() { groupExists = false; },
    setOwner(value) { owner = value; version += 1; }, setView(value) { view = value; },
    get tasks() { return tasks; },
  };
}

test("daily Work lists are read-only, chronological and independent of the deadline date", () => {
  const f = fixture(); f.source.dataset = { dayList: "work", summaryDate: "2030-05-01" };
  f.replaceTask("beta", { scheduledStart: "2030-05-01T10:00", dueDate: "2030-05-04" });
  assert.equal(f.api.openDayList("2030-05-01", "work", f.source), true);
  const dialog = f.dialog(), rows = dialog.querySelectorAll("[data-deadline-preview-task]");
  assert.deepEqual(rows.map(row => row.dataset.deadlinePreviewTask), ["beta", "alpha"]);
  assert.match(rows[1].textContent, /time:23:30–time:01:00 \(\+1 day\)/);
  assert.match(rows[1].textContent, /<img src=x/); assert.equal(dialog.querySelector("img"), null);
  assert.equal(dialog.querySelector(".calendar-deadline-group-time").getAttribute("datetime"), "2030-05-01T10:00");
  assert.equal(f.source.getAttribute("aria-expanded"), "true");
  assert.equal(f.api.openDayList("2030-05-01", "work", f.source), true); assert.equal(f.dialog(), dialog);
  assert.equal(f.calls.length, 0); assert.equal(f.editors.length, 0);
});

test("daily Due lists include timed and date-only deadlines, update live and keep an honest empty state", () => {
  const f = fixture(); f.source.dataset = { dayList: "due", summaryDate: "2030-05-02" };
  f.replaceTask("beta", { dueDate: "2030-05-02", dueTime: "" });
  f.api.openDayList("2030-05-02", "due", f.source);
  let rows = f.dialog().querySelectorAll("[data-deadline-preview-task]");
  assert.deepEqual(rows.map(row => row.dataset.deadlinePreviewTask), ["alpha", "beta"]);
  assert.match(rows[1].textContent, /End of day/);
  rows[1].focus(); f.replaceTask("alpha", { completed: true }); f.api.sync();
  assert.equal(f.doc.activeElement, rows[1]); assert.equal(f.dialog().querySelectorAll("[data-deadline-preview-task]").length, 1);
  f.replaceTask("beta", { deleted_at: "2030-05-02" }); f.api.sync();
  assert.equal(f.dialog().querySelectorAll("[data-deadline-preview-task]").length, 0);
  assert.match(f.dialog().querySelector(".calendar-preview-status").textContent, /No remaining deadlines/);
  assert.equal(f.calls.length, 0);
});

test("day-list task handoff waits for closing and cannot cross an owner or list-membership change", () => {
  for (const invalidate of ["none", "owner", "date"]) {
    const f = fixture({ deferredClose: true }); f.source.dataset = { dayList: "work", summaryDate: "2030-05-01" };
    f.api.openDayList("2030-05-01", "work", f.source);
    const row = f.dialog().querySelector("[data-deadline-preview-task]");
    f.dialog().fire("click", { target: row }); assert.equal(f.selections.length, 0);
    if (invalidate === "owner") f.setOwner("B");
    if (invalidate === "date") f.replaceTask("alpha", { scheduledStart: "2030-05-03T09:00" });
    f.closing.shift()();
    assert.equal(f.selections.length, invalidate === "none" ? 1 : 0);
    if (invalidate === "none") assert.match(f.dialog().querySelector("#calendar-preview-title").textContent, /Alpha/);
    else assert.equal(f.dialog(), null);
    assert.equal(f.calls.length, 0);
  }
});

test("day-list source rebinding, Escape, view changes and invalid requests preserve focus and owner isolation", () => {
  const f = fixture(); f.source.dataset = { dayList: "work", summaryDate: "2030-05-01" };
  assert.equal(f.api.openDayList("2030-02-30", "work", f.source), false);
  assert.equal(f.api.openDayList("2030-05-01", "other", f.source), false);
  assert.equal(f.api.openDayList("2030-05-03", "work", f.source), false);
  f.api.openDayList("2030-05-01", "work", f.source);
  f.source.remove(); const replacement=f.doc.createElement("button");replacement.dataset={dayList:"work",summaryDate:"2030-05-01"};f.calendar.append(replacement);
  f.api.sync();assert.equal(replacement.getAttribute("aria-expanded"),"true");
  f.dialog().fire("cancel");assert.equal(f.dialog(),null);assert.equal(f.doc.activeElement,replacement);assert.equal(replacement.getAttribute("aria-expanded"),"false");
  f.api.openDayList("2030-05-01", "work", replacement);f.setView("tasks");f.api.sync();assert.equal(f.dialog(),null);
  f.api.destroy();assert.equal(f.api.openDayList("2030-05-01", "work", replacement),false);
});

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

test("task-list details restore the matching launcher after a list rerender and require Edit to open the editor", () => {
  const f = fixture({ deferredClose: true });
  const list = f.doc.createElement("section"); list.id = "view-tasks"; f.doc.body.append(list);
  const source = f.doc.createElement("button"); source.className = "task-select"; source.dataset.editTask = "alpha"; list.append(source);
  f.setView("tasks"); f.api.open("alpha", source);
  assert.equal(f.editors.length, 0);
  source.remove();
  const replacement = f.doc.createElement("button"); replacement.className = "task-select"; replacement.dataset.editTask = "alpha"; list.append(replacement);
  f.click("edit"); assert.equal(f.editors.length, 0);
  f.closing.shift()(); assert.deepEqual(f.editors, [{ id: "alpha", source: replacement }]);
});

test("closing task details after its filtered row disappears focuses the visible Add task action", () => {
  const f = fixture();
  const add = f.doc.createElement("button"); add.id = "open-task-modal"; f.doc.body.append(add);
  const source = f.doc.createElement("button"); source.className = "task-select"; source.dataset.editTask = "alpha"; f.doc.body.append(source);
  f.setView("tasks"); f.api.open("alpha", source); source.remove();
  f.api.close(); assert.equal(f.doc.activeElement, add);
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

test("a grouped deadline list uses plaintext exact times, current unfinished tasks and no editing or writes", () => {
  const f = fixture(); f.replaceTask("beta", { dueDate: "2030-05-02", dueTime: "00:15" });
  const group = f.group(["beta", "alpha", "alpha"]);
  assert.equal(f.api.openDeadlineGroup(group, group.source), true);
  const dialog = f.dialog(), entries = dialog.querySelectorAll(".calendar-deadline-group-item");
  assert.equal(dialog.classList.contains("calendar-deadline-group-preview"), true);
  assert.equal(dialog.querySelector("#calendar-preview-title").textContent, "2 deadlines");
  assert.deepEqual(entries.map(entry => entry.dataset.deadlinePreviewTask), ["alpha", "beta"]);
  assert.equal(entries[0].querySelector(".calendar-deadline-group-time").textContent, "time:00:00");
  assert.equal(entries[1].querySelector("time").getAttribute("datetime"), "2030-05-02T00:15");
  assert.equal(entries[0].querySelector("strong").textContent, f.tasks[0].title);
  assert.equal(dialog.querySelector("img"), null); assert.equal(dialog.querySelector("form"), null);
  assert.equal(dialog.querySelector("#calendar-preview-edit"), null);
  assert.equal(group.source.getAttribute("aria-expanded"), "true");
  assert.equal(group.source.getAttribute("aria-controls"), "calendar-task-preview");
  assert.equal(f.api.openDeadlineGroup(group, group.source), true);
  assert.equal(f.dialog(), dialog); assert.equal(f.doc.body.querySelectorAll("dialog").length, 1);
  assert.equal(f.calls.length, 0); assert.equal(f.editors.length, 0);
});

test("choosing a grouped deadline waits for closing and shows its details before Edit, without a write", () => {
  const f = fixture({ deferredClose: true }); f.replaceTask("beta", { dueDate: "2030-05-02", dueTime: "00:15" });
  const group = f.group(); f.api.openDeadlineGroup(group, group.source);
  const list = f.dialog(), entry = list.querySelectorAll(".calendar-deadline-group-item")[1];
  list.fire("click", { target: entry });
  assert.equal(f.dialog(), list); assert.equal(list.inert, true); assert.equal(f.calls.length, 0);
  assert.equal(f.selections.length, 0); assert.equal(f.editors.length, 0);
  group.source.remove(); const replacement = f.doc.createElement("button"); replacement.dataset = { ...group.source.dataset }; f.calendar.append(replacement);
  f.closing.shift()();
  assert.equal(f.dialog().querySelector("#calendar-preview-title").textContent, "Beta");
  assert.deepEqual(f.selections, ["beta"]); assert.equal(f.calls.length, 0);
  assert.deepEqual(f.editors, []);
  f.click("edit"); assert.equal(f.editors.length, 0);
  f.closing.shift()(); assert.deepEqual(f.editors, [{ id: "beta", source: replacement }]);
  assert.equal(replacement.getAttribute("aria-expanded"), "false");
});

test("group sync re-reads canonical tasks, preserves live row focus, filters completed/deleted entries and closes a missing group", () => {
  const f = fixture(); f.replaceTask("beta", { dueDate: "2030-05-02", dueTime: "00:15" });
  const group = f.group(); f.api.openDeadlineGroup(group, group.source);
  const dialog = f.dialog(), entry = dialog.querySelectorAll(".calendar-deadline-group-item")[1]; entry.focus();
  f.replaceTask("beta", { title: "Changed elsewhere", dueTime: "00:25" }); f.api.sync();
  assert.equal(f.dialog(), dialog); assert.equal(f.doc.activeElement, entry);
  assert.equal(entry.querySelector("strong").textContent, "Changed elsewhere");
  assert.equal(entry.querySelector("time").textContent, "time:00:25");
  f.replaceTask("beta", { completed: true }); f.api.sync();
  assert.equal(dialog.querySelector("#calendar-preview-title").textContent, "1 deadline");
  assert.equal(dialog.querySelectorAll(".calendar-deadline-group-item").length, 1);
  assert.equal(f.doc.activeElement.getAttribute("aria-label"), "Close deadline list");
  f.replaceTask("alpha", { deleted_at: 123 }); f.api.sync();
  assert.equal(f.api.isOpen, false); assert.equal(group.source.getAttribute("aria-expanded"), "false");
  f.replaceTask("alpha", { deleted_at: null }); f.api.openDeadlineGroup(group, group.source);
  f.hideGroup(); group.source.remove(); f.api.sync();
  assert.equal(f.api.isOpen, false); assert.equal(f.doc.activeElement, f.today);
  assert.equal(f.calls.length, 0);
});

test("a delayed grouped-deadline handoff cannot cross an owner change or replace another preview", () => {
  for (const changeOwner of [false, true]) {
    const f = fixture({ deferredClose: true }); const group = f.group(["alpha"]); f.api.openDeadlineGroup(group, group.source);
    f.dialog().fire("click", { target: f.dialog().querySelector(".calendar-deadline-group-item") });
    if (changeOwner) { f.setOwner("B"); f.api.sync(); }
    f.api.open("beta", f.source); const next = f.dialog();
    f.closing.shift()();
    assert.equal(f.dialog(), next); assert.equal(next.querySelector("#calendar-preview-title").textContent, "Beta");
    assert.equal(f.selections.length, 0); assert.equal(f.calls.length, 0); assert.equal(f.editors.length, 0);
  }
});

test("group keyboard dismissal rebinds its launcher, resets aria and routed/destroyed groups cannot linger", () => {
  const f = fixture(); const group = f.group(["alpha"]); f.api.openDeadlineGroup(group, group.source);
  const dialog = f.dialog(), controls = dialog.querySelectorAll("button"); controls.at(-1).focus();
  const tab = { key: "Tab" }; dialog.fire("keydown", tab); assert.equal(tab.prevented, true); assert.equal(f.doc.activeElement, controls[0]);
  group.source.remove(); const replacement = f.doc.createElement("button"); replacement.dataset = { ...group.source.dataset }; f.calendar.append(replacement);
  f.api.sync(); assert.equal(replacement.getAttribute("aria-expanded"), "true");
  const escape = {}; dialog.fire("cancel", escape);
  assert.equal(escape.prevented, true); assert.equal(f.doc.activeElement, replacement);
  assert.equal(group.source.getAttribute("aria-expanded"), "false"); assert.equal(replacement.getAttribute("aria-expanded"), "false");
  assert.equal(replacement.getAttribute("aria-controls"), null);
  f.api.openDeadlineGroup(group, replacement); f.setView("tasks"); f.api.sync(); assert.equal(f.api.isOpen, false);
  f.setView("calendar"); f.api.openDeadlineGroup(group, replacement); f.api.destroy();
  assert.equal(f.api.isOpen, false); assert.equal(replacement.getAttribute("aria-expanded"), "false");
  assert.equal(f.api.openDeadlineGroup(group, replacement), false);
});

test("events from a detached deadline dialog cannot dismiss its replacement preview", () => {
  const f = fixture(); const group = f.group(["alpha"]); f.api.openDeadlineGroup(group, group.source);
  const previous = f.dialog(), dismiss = previous.querySelector(".close-button");
  f.api.open("beta", f.source); const next = f.dialog();
  previous.fire("click", { target: dismiss }); previous.fire("click", { clientX: 20, clientY: 20 });
  assert.equal(f.dialog(), next); assert.equal(f.api.isOpen, true);
  assert.equal(next.querySelector("#calendar-preview-title").textContent, "Beta");
});


test("deadline-only and work-only details offer only the missing linked component", () => {
  const due = fixture({ deferredClose: true }); due.replaceTask("alpha", { scheduledStart: null }); due.api.open("alpha", due.source);
  assert.equal(due.button("add-work").hidden, false); assert.equal(due.button("add-due").hidden, true); assert.equal(due.button("reschedule").hidden, true);
  const before = JSON.stringify(due.tasks); due.click("add-work"); assert.equal(due.editors.length, 0, "handoff waits for closing motion"); due.closing.shift()();
  assert.equal(due.editors[0].id, "alpha"); assert.equal(due.editors[0].reschedule, true); assert.equal(JSON.stringify(due.tasks), before, "opening creates no duplicate or draft write");
  const work = fixture(); work.replaceTask("alpha", { dueDate: "", dueTime: "" }); work.api.open("alpha", work.source);
  assert.equal(work.button("add-due").hidden, false); assert.equal(work.button("add-work").hidden, true); work.click("add-due");
  assert.equal(work.editors[0].id, "alpha"); assert.equal(work.editors[0].addDueDate, true); assert.equal(work.editors[0].reschedule, undefined);
});

test("details update missing-component actions after saved changes without replacing the dialog", () => {
  const f = fixture(); f.api.open("beta", f.source); const dialog = f.dialog();
  assert.equal(f.button("add-work").hidden, false); assert.equal(f.button("add-due").hidden, false);
  f.replaceTask("beta", { dueDate: "2030-05-02", scheduledStart: "2030-05-01T10:00" }); f.api.sync();
  assert.equal(f.dialog(), dialog); assert.equal(f.button("add-work").hidden, true); assert.equal(f.button("add-due").hidden, true); assert.equal(f.button("reschedule").hidden, false);
});
