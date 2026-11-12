const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("inline task panels stay interactive when startup, navigation or resize closes a drawer", () => {
  const source = fs.readFileSync("landing/app.js", "utf8");
  const setTaskPanel = source.match(/^function setTaskPanel\(.*\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(setTaskPanel);
  for (const compact of [true, false]) {
    const attributes = new Map([["aria-hidden", "true"]]);
    const classes = new Set(["motion-preview", "task-panel-open"]);
    let focusMoves = 0;
    const panel = {
      inert: true, setAttribute(name, value) { attributes.set(name, value); },
      removeAttribute(name) { attributes.delete(name); },
    };
    const scrim = { hidden: false };
    const context = vm.createContext({
      compactPlannerQuery: { matches: compact },
      phonePlannerQuery: { matches: false },
      document: { body: { classList: {
        contains(name) { return classes.has(name); },
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
      } } },
      els: {
        taskPanel: panel, taskPanelScrim: scrim,
        taskPanelToggle: { setAttribute() {}, focus() { focusMoves += 1; } },
      },
    });
    vm.runInContext(setTaskPanel, context);
    for (const open of [false, true, false]) {
      context.open = open;
      vm.runInContext("setTaskPanel(open)", context);
      assert.equal(panel.inert, false);
      assert.equal(attributes.has("aria-hidden"), false);
      assert.equal(classes.has("task-panel-open"), false);
      assert.equal(scrim.hidden, true);
      assert.equal(focusMoves, 0, "Never focus a hidden drawer toggle");
    }
  }
});

test("phone tasks start collapsed, isolate the sheet, restore its launcher and return to inline tablet layout", () => {
  const source = fs.readFileSync("landing/app.js", "utf8");
  const setTaskPanel = source.match(/^function setTaskPanel\(.*\) \{[\s\S]*?^\}/m)?.[0];
  const classes = new Set(["motion-preview"]);
  let focused = null;
  const element = () => ({
    inert: false, isConnected: true, attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    focus() { focused = this; },
  });
  const panel = element();
  const close = element();
  const launcher = element();
  const calendar = element();
  const navigation = element();
  const scrim = { hidden: false };
  const phoneQuery = { matches: true };
  const context = vm.createContext({
    taskPanelLauncher: null, phonePlannerQuery: phoneQuery, compactPlannerQuery: { matches: true },
    document: {
      activeElement: launcher,
      body: { classList: {
        contains(name) { return classes.has(name); },
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
      } },
      querySelector() { return close; },
    },
    els: { taskPanel: panel, taskPanelToggle: element(), phoneTaskSummary: launcher,
      taskPanelScrim: scrim, calendarPanel: calendar, phoneNavigation: navigation },
  });
  vm.runInContext(setTaskPanel, context);
  vm.runInContext("setTaskPanel(false)", context);
  assert.equal(panel.inert, true);
  assert.equal(panel.attributes.get("aria-hidden"), "true");
  assert.equal(focused, null, "Startup does not steal focus");
  vm.runInContext("setTaskPanel(true)", context);
  assert.equal(panel.inert, false);
  assert.equal(panel.attributes.get("role"), "dialog");
  assert.equal(calendar.inert, true);
  assert.equal(navigation.inert, true);
  assert.equal(scrim.hidden, false);
  assert.equal(focused, close);
  vm.runInContext("setTaskPanel(false)", context);
  assert.equal(focused, launcher);
  assert.equal(calendar.inert, false);
  assert.equal(navigation.inert, false);
  assert.equal(launcher.attributes.get("aria-expanded"), "false");
  vm.runInContext("setTaskPanel(true)", context);
  phoneQuery.matches = false;
  vm.runInContext("setTaskPanel(false, false)", context);
  assert.equal(panel.inert, false, "Tablet tasks remain usable inline after resizing");
  assert.equal(panel.attributes.has("aria-hidden"), false);
  assert.equal(panel.attributes.has("aria-modal"), false);
  assert.equal(panel.attributes.has("role"), false);
  assert.equal(classes.has("task-panel-open"), false);
  assert.equal(scrim.hidden, true);
  assert.equal(calendar.inert, false);
  assert.equal(navigation.inert, false);
});
