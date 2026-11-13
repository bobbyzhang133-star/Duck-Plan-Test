const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const PlannerUI = require("../landing/planner-ui.js");

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

test("template calendar drops use the target day, including the deadline band, without changing the selected day", () => {
  const source = fs.readFileSync("landing/app.js", "utf8");
  const renderTimeline = source.match(/^function renderTimeline\(dates\) \{[\s\S]*?^\}/m)?.[0];
  const dropHandler = source.match(/^document\.addEventListener\("drop", \(event\) => \{[\s\S]*?^\}\);/m)?.[0];
  const placement = source.match(/^function templateCalendarPlacement\(event, template\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(renderTimeline);
  assert.ok(dropHandler);
  assert.ok(placement);
  let onDrop;
  let scheduled;
  const calendar = {};
  const context = vm.createContext({
    selectedDate: "2026-11-12", calendarFocusSlot: { date: "2026-11-12", time: "09:00" },
    selectedTaskId: null, tasks: [], PlannerUI, clearTemplateDrag() {}, showToast() {},
    dateObject: (date) => new Date(`${date}T12:00:00`),
    nowKey: () => "2026-11-12", formatTime: (time) => time, formatLongDate: (date) => date,
    deadlineChips: () => "", layoutEvents: () => [], Model: { scheduledParts: () => null },
    document: {
      addEventListener(type, handler) { assert.equal(type, "drop"); onDrop = handler; },
      querySelector() { return null; },
    },
    taskLibrary: {
      readTemplateDrop: () => "reusable-template",
      draftForTemplate: () => ({ durationMinutes: 35 }),
      handleTemplateDrop(event, options) { scheduled = options; },
    },
  });
  vm.runInContext(renderTimeline, context);
  vm.runInContext(placement, context);
  vm.runInContext(dropHandler, context);
  const html = vm.runInContext('renderTimeline(["2026-11-09", "2026-11-12"])', context);
  const deadlineCells = [...html.matchAll(/<div class="deadline-cell"([^>]*)>/g)];
  assert.equal(deadlineCells.length, 2);
  assert.match(deadlineCells[0][1], /data-deadline-date="2026-11-09"/);
  // A deadline click must retain its popup launcher instead of triggering the date-navigation handler.
  assert.doesNotMatch(deadlineCells[0][1], /\bdata-date=/);

  const targetFor = (attributes, column = null) => {
    const target = {
      dataset: attributes,
      closest(selector) {
        if (selector === "#planner-calendar") return calendar;
        if (selector === "[data-column-date]") return column;
        const requested = selector.split(",").map((part) => part.trim());
        const selectors = {
          slotDate: "[data-slot-date]", date: "[data-date]", deadlineDate: "[data-deadline-date]",
        };
        return Object.keys(attributes).some((key) => requested.includes(selectors[key])) ? target : null;
      },
    };
    return target;
  };
  const column = {
    dataset: { columnDate: "2026-11-09" },
    getBoundingClientRect: () => ({ top: 100, height: 930 }),
  };
  const cases = [
    { target: targetFor({ deadlineDate: "2026-11-09" }), time: "09:00" },
    { target: targetFor({ date: "2026-11-09" }), time: "09:00" },
    { target: targetFor({ slotDate: "2026-11-09", slotTime: "10:00" }, column), time: "10:30" },
    { target: targetFor({}, column), time: "10:30" },
  ];
  for (const { target, time } of cases) {
    let prevented = false;
    onDrop({ target, dataTransfer: {}, clientY: 100 + 3.5 * 62, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(scheduled.date, "2026-11-09");
    assert.equal(scheduled.time, time);
    assert.equal(context.selectedDate, "2026-11-12");
  }
  scheduled = null;
  onDrop({ target: targetFor({}), dataTransfer: {}, clientY: 110, preventDefault() {} });
  assert.equal(scheduled, null, "An undated gutter cannot silently schedule on the selected day");
});
