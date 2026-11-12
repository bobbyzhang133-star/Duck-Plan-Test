const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("Calendar is the default while explicit section links and the Dashboard remain available", () => {
  const source = fs.readFileSync("landing/app.js", "utf8");
  const setView = source.match(/^function setView\(name, preserveDrawer = false\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(setView);
  const names = ["calendar", "home", "tasks", "classes", "goals", "notes", "settings"];
  const views = names.map((name) => ({
    id: `view-${name}`, dataset: { pageTitle: name, eyebrow: name },
    classList: { toggle() {} },
  }));
  const document = { body: { dataset: {} }, querySelector(selector) {
    assert.equal(selector, "#view-calendar");
    return views[0];
  } };
  let route;
  const workspace = { scrollTop: 420, scrollLeft: 30, scrollTo({ top, left }) { this.scrollTop = top; this.scrollLeft = left; } };
  const context = vm.createContext({
    document, workspace, els: { views, navItems: [], pageTitle: {}, pageEyebrow: {} },
    history: { replaceState(state, title, url) { route = url; } },
    window: { scrollTo() {} }, setTaskPanel() {}, setSidebar() {},
    requestAnimationFrame(callback) { callback(); }, setupButtonMaterial() {},
  });
  vm.runInContext(setView, context);
  for (const name of ["", "unknown", "broken[route"]) {
    context.name = name;
    vm.runInContext("setView(name)", context);
    assert.equal(document.body.dataset.view, "calendar");
    assert.equal(route, "#calendar");
  }
  for (const name of names) {
    context.name = name;
    vm.runInContext("setView(name)", context);
    assert.equal(document.body.dataset.view, name);
    assert.equal(route, `#${name}`);
    assert.equal(workspace.scrollTop, 0, "A section's scroll position cannot hide the next screen's toolbar");
    assert.equal(workspace.scrollLeft, 0);
    workspace.scrollTop = 420;
    workspace.scrollLeft = 30;
  }
  vm.runInContext('setView("today")', context);
  assert.equal(document.body.dataset.view, "home", "Existing Today deep links remain compatible");
});

test("initial markup, brand link and installed-app launch all point to Calendar", () => {
  const html = fs.readFileSync("landing/index.html", "utf8");
  const manifest = JSON.parse(fs.readFileSync("landing/app.webmanifest", "utf8"));
  assert.match(html, /class="brand" href="#calendar" data-go="calendar"/);
  assert.match(html, /class="view active" id="view-calendar"/);
  assert.match(html, /class="nav-item active"[^>]*data-view="calendar"/);
  assert.match(html, /id="view-home" data-page-title="Dashboard"/);
  assert.equal(manifest.start_url, "/#calendar");
  assert.equal(manifest.shortcuts[0].url, "/#calendar");
});
