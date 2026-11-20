const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Model = require("../landing/planner-model.js");
const Presentation = require("../landing/calendar-date-presentation.js");

const source = fs.readFileSync("landing/app.js", "utf8");
const functions = ["layoutEvents", "renderTimeline", "relevantCalendarMinutes"]
  .map(name => source.match(new RegExp(`^function ${name}\\(.*\\) \\{[\\s\\S]*?^\\}`, "m"))?.[0]);
assert.ok(functions.every(Boolean), "Use the real timeline rendering and initial-scroll functions");
const date = "2030-05-02";
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const task = (id, values = {}) => ({ id, title: `Task ${id}`, dueDate: date, dueTime: null,
  scheduledStart: null, durationMinutes: 45, completed: false, ...values });

function fixture(tasks) {
  const classInfo = () => ({ name: "Calculus", color: "#538fc5", soft: "#e3eef7" });
  const calendarDates = Presentation.create({ model: Model, classInfo, formatTime: value => value });
  const context = vm.createContext({ tasks, Model, calendarDates, classInfo,
    CALENDAR_START_HOUR: 0, CALENDAR_END_HOUR: 24, selectedDate: date, selectedTaskId: null,
    expandedDeadlineDates: new Set(), calendarFocusSlot: { date, time: "09:00" },
    nowKey: () => "2030-05-01", dateObject: value => new Date(`${value}T12:00`),
    formatLongDate: value => value, formatTime: value => value, safeText: escape,
    taskScheduleText: () => "Scheduled work", Date, Intl,
  });
  vm.runInContext(functions.join("\n"), context);
  return { render: () => context.renderTimeline([date]), relevant: () => context.relevantCalendarMinutes([date]) };
}

test("timed deadlines retain exact times while date-only deadlines stay accessible in the heading Due list without a duplicate band", () => {
  const tasks = [task("due", { dueTime: "17:00", scheduledStart: `${date}T15:00`, durationMinutes: 60 }), task("date-only")];
  const before = structuredClone(tasks), f = fixture(tasks), html = f.render();
  assert.doesNotMatch(html, /timeline-deadline-label|timeline-deadlines|calendar-date-only-deadlines|data-toggle-deadline-row/);
  assert.match(html, /data-day-list="due"[^>]*data-summary-date="2030-05-02"[^>]*aria-label="Show 2 deadlines/);
  const grid = html.slice(html.indexOf('<div class="timeline-columns">'));
  assert.match(grid, /data-calendar-kind="work" data-calendar-drag-task="due"/);
  assert.match(grid, /class="timed-deadline-marker[^\"]*"[^>]*data-select-task="due"[^>]*data-calendar-kind="deadline"/);
  assert.match(grid, /data-deadline-minute="1020"/);
  assert.doesNotMatch(grid, /data-select-task="date-only"/);
  assert.deepEqual(tasks, before, "Rendering never changes task identity, dates or duration");
});

test("a timed-only day removes the empty top strip and initially scrolls to its real due time", () => {
  const f = fixture([task("night", { dueTime: "23:59" })]);
  assert.doesNotMatch(f.render(), /timeline-deadline-label|timeline-deadlines/);
  assert.equal(f.relevant(), 1439);
  assert.equal(fixture([task("date-only")]).relevant(), 540, "A date-only deadline does not invent a23:59 visual location");
});

test("deadline labels share space with overlapping work without changing either time", () => {
  const settings = { version: 1, alarm: { enabled: false } };
  const tasks = [task("work", { scheduledStart: `${date}T16:30`, durationMinutes: 90, dueTime: "17:00", workAlerts: settings }),
    task("near", { dueTime: "17:05" }), task("separate", { scheduledStart: `${date}T11:00`, dueDate: null })];
  const before = structuredClone(tasks), html = fixture(tasks).render();
  assert.match(html, /data-calendar-drag-task="work"[^>]*width:calc\(56% - 6px\)/);
  assert.match(html, /data-calendar-drag-task="separate"[^>]*width:calc\(100% - 6px\)/);
  assert.match(html, /data-overlaps-work="true"/);
  assert.match(html, /data-timed-deadline-group="2030-05-02-1020"/);
  assert.match(html, /data-deadline-minute="1020"/);
  assert.match(html, /data-deadline-minute="1025"/);
  assert.deepEqual(tasks, before);
});

test("overlapping work keeps a shared horizontal area when only its longer session reaches a deadline", () => {
  const tasks = [task("short", { scheduledStart: `${date}T16:00`, durationMinutes: 30, dueDate: null }),
    task("long", { scheduledStart: `${date}T16:00`, durationMinutes: 120, dueDate: null }), task("due", { dueTime: "17:00" })];
  const html = fixture(tasks).render();
  assert.match(html, /data-calendar-drag-task="short"[^>]*left:calc\(0% \+ 3px\);width:calc\(28% - 6px\)/);
  assert.match(html, /data-calendar-drag-task="long"[^>]*left:calc\(28% \+ 3px\);width:calc\(28% - 6px\)/);
});

test("pointer activation resolves a visible diamond to its own group while keyboard activation keeps its focused control", () => {
  const resolve = source.match(/^function deadlineControlAtPointer\(.*\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(resolve);
  const first = { key: "17:00-group" }, later = { key: "17:50-group" };
  const point = (control, top) => ({ getBoundingClientRect: () => ({ left: 10, right: 20, top, bottom: top + 10 }),
    closest: () => ({ querySelector: () => control }) });
  const column = { querySelectorAll: () => [point(first, 100), point(later, 107)] };
  const receivingAnchor = { getBoundingClientRect: () => ({ left: 10 }) };
  const context = vm.createContext({ getComputedStyle: () => ({ getPropertyValue: () => "18px" }) }); vm.runInContext(resolve, context);
  const event = { detail: 1, clientX: 15, clientY: 105, target: { closest: selector => selector.includes("timeline-column") ? column : receivingAnchor } };
  assert.equal(context.deadlineControlAtPointer(event), first, "A transparent following hit rectangle must not steal the earlier diamond");
  assert.equal(context.deadlineControlAtPointer({ ...event, clientY: 112 }), later);
  assert.equal(context.deadlineControlAtPointer({ ...event, clientX: 30 }), null);
  assert.equal(context.deadlineControlAtPointer({ ...event, detail: 0 }), null, "Keyboard activation needs no pointer-coordinate override");
  receivingAnchor.getBoundingClientRect = () => ({ left: -10 });
  assert.equal(context.deadlineControlAtPointer(event), null, "A pin hidden under another label's opaque surface cannot steal that label's click");
  assert.equal(context.deadlineControlAtPointer({ ...event, target: { closest: () => null } }), null, "Sticky headers and outside controls do not resolve obscured pins");
});
