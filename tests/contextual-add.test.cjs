const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("section Add actions name and open their own editors without creating tasks in personal sections", () => {
  const source = fs.readFileSync("landing/app.js", "utf8");
  const functions = ["updatePrimaryAction", "openPrimaryAction"].map(name => source.match(new RegExp(`^function ${name}\\([^]*?^\\}`, "m"))?.[0]);
  assert.ok(functions.every(Boolean));
  const button = { setAttribute() {} }, search = {}, calls = [];
  const context = vm.createContext({
    document: { body: { dataset: {} }, querySelector: () => button },
    els: { search: { closest: () => search } }, store: { supportsPersonal: true },
    calendarLibraryTabs: { selected: "tasks" },
    taskLibrary: { openNewTemplate: options => calls.push(["template", options.source]) },
    personalGoals: { openAddChooser: options => calls.push(["goal-habit", options.source]) },
    personalNotes: { openNote: options => calls.push(["note", options.source]) },
    openClassEditor: source => calls.push(["class", source]),
    openModal: options => calls.push(["task", options.source]),
    selectedDate: "2026-11-12", nowKey: () => "2026-11-12", launcher: button,
  });
  vm.runInContext(functions.join("\n"), context);
  for (const [view, label, kind] of [
    ["calendar", "Add task", "task"], ["tasks", "Add task", "task"], ["home", "Add task", "task"],
    ["notes", "Add note", "note"], ["goals", "Add goal / habit", "goal-habit"], ["classes", "Add class", "class"],
  ]) {
    context.view = view; context.document.body.dataset.view = view;
    vm.runInContext("updatePrimaryAction(view); openPrimaryAction(launcher);", context);
    assert.equal(button.textContent, `＋ ${label}`);
    assert.equal(button.hidden, false);
    assert.equal(calls.at(-1)[0], kind);
    assert.equal(calls.at(-1)[1], button, "Editors receive the actual toolbar launcher");
    assert.equal(search.hidden, !["calendar", "tasks", "home"].includes(view));
  }
  context.calendarLibraryTabs.selected = "templates";
  context.document.body.dataset.view = "calendar";
  vm.runInContext('updatePrimaryAction("calendar"); openPrimaryAction(launcher);', context);
  assert.equal(button.textContent, "＋ New template");
  assert.deepEqual(calls.at(-1), ["template", button], "The Calendar Templates action creates a template from the actual launcher");
  context.store.supportsOrganization = false;
  vm.runInContext('updatePrimaryAction("calendar")', context);
  assert.equal(button.disabled, true, "Unavailable template storage disables the contextual action");
  context.document.body.dataset.view = "settings";
  const before = calls.length;
  vm.runInContext('updatePrimaryAction("settings"); openPrimaryAction(launcher);', context);
  assert.equal(button.hidden, true);
  assert.equal(calls.length, before);
  context.store.supportsPersonal = false;
  vm.runInContext('updatePrimaryAction("notes")', context);
  assert.equal(button.disabled, true);
  vm.runInContext('updatePrimaryAction("tasks")', context);
  assert.equal(button.disabled, false, "Older backends retain normal task actions");
});
