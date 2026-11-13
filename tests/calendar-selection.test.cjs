const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("calendar task selection preserves popup launchers, scroll and focus across selection changes", () => {
  const source = fs.readFileSync("landing/app.js", "utf8");
  const selectTask = source.match(/^function selectTask\(id\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(selectTask);
  const controls = ["essay", "essay", "quiz"].map((id) => ({
    dataset: { selectTask: id }, isConnected: true, selected: false,
    classList: { toggle(name, enabled) { controls.find((control) => control.classList === this).selected = enabled; } },
  }));
  const calendar = { scrollTop: 360, querySelectorAll() { return controls; } };
  let dailyRenders = 0;
  const context = vm.createContext({
    selectedTaskId: null, els: { calendar }, activeElement: controls[0],
    renderDailyPlan() { dailyRenders += 1; }, setupButtonMaterial() {},
    renderCalendar() {
      controls.forEach((control) => { control.isConnected = false; });
      calendar.scrollTop = 0;
    },
  });
  vm.runInContext(selectTask, context);
  vm.runInContext('selectTask("essay")', context);
  assert.deepEqual(controls.map((control) => control.selected), [true, true, false]);
  vm.runInContext('selectTask("quiz")', context);
  assert.deepEqual(controls.map((control) => control.selected), [false, false, true]);
  vm.runInContext('selectTask("quiz")', context);
  assert.deepEqual(controls.map((control) => control.selected), [false, false, false]);
  assert.equal(context.selectedTaskId, null);
  assert.equal(dailyRenders, 3);
  assert.ok(controls.every((control) => control.isConnected));
  assert.equal(calendar.scrollTop, 360);
  assert.equal(context.activeElement, controls[0]);
});
