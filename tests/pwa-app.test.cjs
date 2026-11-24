const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const landing = path.join(root, "landing");

test("web app manifest defines an installable standalone DuckPlan app", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(landing, "app.webmanifest"), "utf8"));
  assert.equal(manifest.name, "DuckPlan");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/#calendar");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose.includes("maskable")));
  manifest.icons.forEach((icon) => assert.ok(fs.existsSync(path.join(landing, icon.src.replace(/^\//, "")))));
});

test("planner markup exposes install metadata and an accessible install control", () => {
  const html = fs.readFileSync(path.join(landing, "index.html"), "utf8");
  const styles = fs.readFileSync(path.join(landing, "styles.css"), "utf8");
  assert.match(html, /rel="manifest" href="\.\/app\.webmanifest"/);
  assert.ok(html.indexOf("./task-list-drag.js") >= 0 && html.indexOf("./task-list-drag.js") < html.indexOf("./app.js"), "Task scheduling loads before planner startup");
  assert.match(html, /id="install-app-settings" aria-labelledby="install-app-heading"/);
  assert.match(html, /<button\b(?=[^>]*\bid="install-app-button")(?=[^>]*\stype="button")(?=[^>]*\shidden(?=\s|>))[^>]*>Install app<\/button>/);
  assert.match(html, /src="\.\/app-install\.js\?v=app-1"/);
  assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test("service worker caches the shell, leaves APIs online-only, and handles notification clicks", () => {
  const worker = fs.readFileSync(path.join(landing, "service-worker.js"), "utf8");
  assert.match(worker, /const CACHE_VERSION = "duckplan-app-[a-z\d-]+-v[1-9]\d*"/);
  assert.match(worker, /key\.startsWith\("duckplan-app-"\) && key !== CACHE_VERSION/);
  assert.ok(worker.includes('"./task-list-drag.js"'), "Offline planner includes the scheduling controller");
  assert.ok(worker.includes('"./calendar-swipe.js"'), "Offline calendar includes touch period navigation");
  for (const asset of ["planner-clarity.css", "planner-clarity.js", "planner-presentation.js", "duck-mascot.js", "phone-navigation.css", "phone-navigation.js", "calendar-library-tabs.js", "calendar-library-tabs.css", "view-transitions.js", "page-stack.css", "planner-actions.css"]) assert.ok(worker.includes(`"./${asset}"`), `Offline shell includes ${asset}`);
  assert.match(worker, /event\.request\.mode === "navigate"/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /notificationclick/);
  assert.match(worker, /duckplan-notification-open/);
  assert.match(worker, /clients\.openWindow/);
});

test("install controller registers the worker and supports native install prompts", () => {
  const controller = fs.readFileSync(path.join(landing, "app-install.js"), "utf8");
  assert.match(controller, /navigator\.serviceWorker\.register\("\.\/service-worker\.js"/);
  assert.match(controller, /beforeinstallprompt/);
  assert.match(controller, /appinstalled/);
  assert.match(controller, /Add to Home Screen/);
});

test("a new offline shell bypasses stale browser HTTP assets during install", async () => {
  const listeners = {};
  let installed;
  const worker = fs.readFileSync(path.join(landing, "service-worker.js"), "utf8");
  vm.runInNewContext(worker, {
    self: { addEventListener: (name, handler) => { listeners[name] = handler; }, skipWaiting() {} },
    Request: class {
      constructor(url, options) { this.url = url; this.cache = options?.cache || "default"; }
    },
    caches: { open: async () => ({ addAll: async requests => { installed = requests; } }) },
  });
  let installation;
  listeners.install({ waitUntil: promise => { installation = promise; } });
  await installation;
  assert.ok(installed.length > 20, "The complete offline shell is still requested");
  for (const request of installed) assert.equal(request.cache, "reload", `${request.url} must bypass stale HTTP responses`);
  for (const asset of ["./index.html", "./planner-motion.css", "./planner-actions.css"]) {
    assert.ok(installed.some(request => request.url === asset), `${asset} stays available offline`);
  }
});
