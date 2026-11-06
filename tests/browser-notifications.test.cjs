const test = require("node:test");
const assert = require("node:assert/strict");
const Notifications = require("../landing/browser-notifications.js");

test("notification capability reports browser permission states", () => {
  assert.equal(Notifications.capability(undefined), "unsupported");
  assert.equal(Notifications.capability({ permission: "default", requestPermission() {} }), "default");
  assert.equal(Notifications.capability({ permission: "granted", requestPermission() {} }), "granted");
  assert.equal(Notifications.capability({ permission: "denied", requestPermission() {} }), "denied");
  assert.equal(Notifications.capability({ permission: "mystery", requestPermission() {} }), "unsupported");
});

test("notification settings copy keeps permission prompts explicit", () => {
  assert.deepEqual(Notifications.settingsCopy("default"), {
    label: "Not allowed yet", action: "Allow device notifications", disabled: false,
  });
  assert.equal(Notifications.settingsCopy("granted").action, "Send test notification");
  assert.equal(Notifications.settingsCopy("denied").disabled, true);
  assert.equal(Notifications.settingsCopy("unsupported").disabled, true);
});

test("task notifications have stable per-deadline tags and useful copy", () => {
  const deadline = new Date(2026, 10, 6, 15, 30).getTime();
  const payload = Notifications.taskNotification({
    id: "essay", title: "Submit essay", className: "English", dueDate: "2026-11-06", dueTime: "15:30",
  }, deadline, { locale: "en-US", icon: "duck.png" });
  assert.equal(payload.title, "DuckPlan deadline reminder");
  assert.match(payload.options.body, /Submit essay\nEnglish · Due Nov 6, 3:30 PM/);
  assert.equal(payload.options.tag, "duckplan-deadline-essay-2026-11-06-15:30");
  assert.equal(payload.options.icon, "duck.png");
  assert.deepEqual(payload.options.data, { taskId: "essay" });
});

test("test notification explains the current open-tab limitation", () => {
  const payload = Notifications.testNotification({ icon: "duck.png" });
  assert.match(payload.options.body, /while DuckPlan is open/);
  assert.equal(payload.options.tag, "duckplan-notification-test");
});
