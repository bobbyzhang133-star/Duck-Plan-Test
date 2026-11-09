const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadController({ reducedMotion = false } = {}) {
  const listeners = {};
  const windowListeners = {};
  class Element {}
  const link = new Element();
  link.href = "https://duckplan.test/fur-lab.html";
  link.target = "";
  link.dataset = {};
  link.isConnected = true;
  link.attributes = new Map([["data-page-navigation", "button"]]);
  link.closest = (selector) => selector === "a[data-page-navigation]" ? link : null;
  link.hasAttribute = (name) => link.attributes.has(name);
  link.getAttribute = (name) => link.attributes.get(name) || null;
  link.removeAttribute = (name) => { link.attributes.delete(name); delete link.dataset.activated; };
  link.getAnimations = () => [{ animationName: "duckplan-page-wave", finished: Promise.resolve() }];
  link.clickCount = 0;
  link.click = () => { link.clickCount += 1; };
  const document = {
    addEventListener(name, handler) { listeners[name] = handler; },
    querySelectorAll() { return [link]; },
  };
  const window = {
    addEventListener(name, handler) { windowListeners[name] = handler; },
    matchMedia() { return { matches: reducedMotion }; },
  };
  const context = {
    Element,
    URL,
    document,
    window,
    location: new URL("https://duckplan.test/index.html#settings"),
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { callback(); },
  };
  vm.runInNewContext(fs.readFileSync("landing/page-navigation-feedback.js", "utf8"), context);
  return { link, listeners, windowListeners };
}

test("page-changing links wait for the wave and replay the original link once", async () => {
  const { link, listeners } = loadController();
  let prevented = false;
  const event = {
    target: link,
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault() { prevented = true; },
  };
  listeners.click(event);
  listeners.click(event);
  assert.equal(prevented, true);
  assert.equal(link.dataset.activated, "true");
  assert.equal(link.clickCount, 0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(link.clickCount, 1);
});

test("modified clicks and in-page navigation are never delayed", () => {
  const { link, listeners } = loadController();
  const event = {
    target: link,
    defaultPrevented: false,
    button: 0,
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault() { throw new Error("modified click must not be prevented"); },
  };
  listeners.click(event);
  assert.equal(link.dataset.activated, undefined);
  assert.equal(link.clickCount, 0);

  event.metaKey = false;
  link.href = "https://duckplan.test/index.html#home";
  listeners.click(event);
  assert.equal(link.dataset.activated, undefined);
});

test("reduced motion navigates immediately without waiting for animation", () => {
  const { link, listeners } = loadController({ reducedMotion: true });
  listeners.click({
    target: link,
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault() {},
  });
  assert.equal(link.clickCount, 1);
});
