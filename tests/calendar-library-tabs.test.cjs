const test = require("node:test");
const assert = require("node:assert/strict");
const Tabs = require("../landing/calendar-library-tabs.js");

function fixture() {
  let owner = "local";
  const changes = [];
  const doc = { activeElement: null };
  function element(dataset = {}) {
    const attributes = new Map();
    const listeners = new Map();
    return {
      dataset, attributes, listeners, members: [], tabIndex: 0,
      setAttribute(name, value) { attributes.set(name, value); },
      contains(value) { return this.members.includes(value); },
      closest() { return this; },
      focus() { doc.activeElement = this; },
      addEventListener(name, callback) { listeners.set(name, callback); },
      removeEventListener(name) { listeners.delete(name); },
    };
  }
  const toolbar = element();
  const scroller = { scrollTop: 0 };
  const buttons = [element({ calendarLibraryTab: "tasks" }), element({ calendarLibraryTab: "templates" })];
  const panels = [element(), element()];
  doc.querySelector = selector => ({ "#calendar-library-toolbar": toolbar, "#daily-task-panel": scroller, "#calendar-tasks-panel": panels[0], "#calendar-assignment-templates": panels[1] })[selector];
  doc.querySelectorAll = () => buttons;
  const tabs = Tabs.create({ document: doc, getOwner: () => owner, onChange: name => changes.push(name) });
  return { doc, toolbar, scroller, buttons, panels, tabs, changes, setOwner(value) { owner = value; } };
}

test("Calendar Tasks and Templates expose only one usable panel without replacing its content", () => {
  const f = fixture();
  const [tasks, templates] = f.panels;
  assert.equal(f.tabs.selected, "tasks");
  assert.equal(tasks.hidden, false); assert.equal(tasks.inert, false);
  assert.equal(templates.hidden, true); assert.equal(templates.inert, true);
  assert.equal(f.doc.activeElement, null, "Startup does not steal focus");
  assert.deepEqual(f.buttons.map(button => button.tabIndex), [0, -1]);
  const taskControl = {};
  tasks.members.push(taskControl); f.doc.activeElement = taskControl;
  f.tabs.select("templates");
  assert.equal(f.doc.activeElement, f.buttons[1], "Hiding focused task content moves focus to the visible tab");
  assert.equal(tasks.hidden, true); assert.equal(tasks.inert, true);
  assert.equal(templates.hidden, false); assert.equal(templates.inert, false);
  assert.equal(f.buttons[1].attributes.get("aria-selected"), "true");
  f.tabs.render();
  assert.equal(f.tabs.selected, "templates", "Store refresh retains the selected library section");
  assert.equal(tasks.members[0], taskControl, "Switching never replaces task DOM or popup launchers");
});

test("tab changes retain separate scroll positions and owner changes clear them", () => {
  const f = fixture();
  f.scroller.scrollTop = 180;
  f.tabs.select("templates"); assert.equal(f.scroller.scrollTop, 0);
  f.scroller.scrollTop = 95;
  f.tabs.select("tasks"); assert.equal(f.scroller.scrollTop, 180);
  f.tabs.select("templates"); assert.equal(f.scroller.scrollTop, 95);
  f.setOwner("cloud:second-person"); f.tabs.render();
  assert.equal(f.tabs.selected, "tasks");
  assert.equal(f.scroller.scrollTop, 0);
  assert.equal(f.panels[1].hidden, true); assert.equal(f.panels[1].inert, true);
  f.tabs.select("templates"); assert.equal(f.scroller.scrollTop, 0, "A new owner never inherits the previous library scroll state");
});

test("horizontal tab keyboard navigation activates and focuses its destination", () => {
  const f = fixture();
  const key = (index, value) => {
    let prevented = false;
    f.toolbar.listeners.get("keydown")({ target: f.buttons[index], key: value, preventDefault() { prevented = true; } });
    return prevented;
  };
  assert.equal(key(0, "ArrowRight"), true);
  assert.equal(f.tabs.selected, "templates"); assert.equal(f.doc.activeElement, f.buttons[1]);
  assert.equal(key(1, "ArrowRight"), true); assert.equal(f.tabs.selected, "tasks");
  key(0, "ArrowLeft"); assert.equal(f.tabs.selected, "templates");
  key(1, "Home"); assert.equal(f.tabs.selected, "tasks");
  key(0, "End"); assert.equal(f.tabs.selected, "templates");
  assert.equal(key(1, "Tab"), false, "Tab retains normal browser focus movement");
});

test("native clicks select tabs, invalid destinations are ignored and destruction detaches controls", () => {
  const f = fixture();
  f.toolbar.listeners.get("click")({ target: f.buttons[1] });
  assert.equal(f.tabs.selected, "templates");
  f.tabs.select("notes"); assert.equal(f.tabs.selected, "templates");
  assert.deepEqual(f.changes, ["templates"]);
  f.tabs.destroy();
  assert.equal(f.toolbar.listeners.size, 0);
  f.tabs.select("tasks"); f.tabs.render();
  assert.equal(f.tabs.selected, "templates");
  assert.equal(Tabs.create({ document: { querySelector() { return null; }, querySelectorAll() { return []; } } }), null);
});
