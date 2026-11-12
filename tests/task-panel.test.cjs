const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("inline task panels stay interactive when startup, navigation or resize closes a drawer", () => {
  const source = fs.readFileSync("landing/app.js", "utf8");
  const setTaskPanel = source.match(/^function setTaskPanel\(open, moveFocus = true\) \{[\s\S]*?^\}/m)?.[0];
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
