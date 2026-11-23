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
const compactBlockHeight = source.match(/^const CALENDAR_COMPACT_BLOCK_HEIGHT = \d+;/m)?.[0];
assert.ok(compactBlockHeight, "Use the real compact block threshold");
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
  vm.runInContext([compactBlockHeight, ...functions].join("\n"), context);
  return { render: () => context.renderTimeline([date]), relevant: () => context.relevantCalendarMinutes([date]), layout: () => context.layoutEvents(tasks) };
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

test("deadline labels overlay full-width work without changing either time", () => {
  const settings = { version: 1, alarm: { enabled: false } };
  const tasks = [task("work", { scheduledStart: `${date}T16:30`, durationMinutes: 90, dueTime: "17:00", workAlerts: settings }),
    task("near", { dueTime: "17:05" }), task("separate", { scheduledStart: `${date}T11:00`, dueDate: null })];
  const before = structuredClone(tasks), html = fixture(tasks).render();
  assert.match(html, /data-calendar-drag-task="work"[^>]*width:100%/);
  assert.match(html, /data-calendar-drag-task="separate"[^>]*width:100%/);
  assert.match(html, /data-overlaps-work="true"/);
  assert.match(html, /data-timed-deadline-group="2030-05-02-1020"/);
  assert.match(html, /data-deadline-minute="1020"/);
  assert.match(html, /data-deadline-minute="1025"/);
  assert.deepEqual(tasks, before);
});

test("close work headings share overlapping columns independently of a deadline", () => {
  const tasks = [task("short", { scheduledStart: `${date}T16:00`, durationMinutes: 30, dueDate: null }),
    task("long", { scheduledStart: `${date}T16:00`, durationMinutes: 120, dueDate: null }), task("due", { dueTime: "17:00" })];
  const html = fixture(tasks).render();
  assert.match(html, /data-calendar-drag-task="long"[^>]*left:0%;width:85%/);
  assert.match(html, /data-calendar-drag-task="short"[^>]*left:50%;width:50%/);
});

test("separated overlapping headings keep full width with a five percent inset", () => {
  const tasks = [task("earlier", { scheduledStart: `${date}T14:00`, durationMinutes: 135 }),
    task("later", { scheduledStart: `${date}T14:45`, durationMinutes: 90 })];
  const before = structuredClone(tasks), layout = fixture(tasks).layout();
  assert.deepEqual(Array.from(layout, e => [e.task.id, e.left, e.width, e.stack]), [["earlier", 0, 100, 1], ["later", 5, 95, 2]]);
  assert.deepEqual(tasks, before);
});

test("one connected conflict group shares its peak columns, including earlier cards", () => {
  const tasks = [task("long", { scheduledStart: `${date}T09:00`, durationMinutes: 180 }),
    task("first", { scheduledStart: `${date}T09:00`, durationMinutes: 45 }),
    task("second", { scheduledStart: `${date}T09:30`, durationMinutes: 90 }),
    task("separate", { scheduledStart: `${date}T14:00`, durationMinutes: 60 })];
  const layout = fixture(tasks).layout();
  assert.ok(layout.slice(0, 3).every(e => e.lanes === 3));
  assert.deepEqual(Array.from(layout, e => e.left), [0, 100 / 3, 200 / 3, 0]);
  assert.equal(layout[3].width, 100);
  assert.equal(layout[3].overlapping, false);
});

test("adjacent sessions separate cleanly, while minimum-height short cards avoid hidden headings", () => {
  let layout = fixture([task("a", { scheduledStart: `${date}T09:00`, durationMinutes: 60 }), task("b", { scheduledStart: `${date}T10:00`, durationMinutes: 60 })]).layout();
  assert.ok(layout.every(e => e.left === 0 && e.width === 100 && !e.overlapping));
  layout = fixture([task("a", { scheduledStart: `${date}T09:00`, durationMinutes: 10 }), task("b", { scheduledStart: `${date}T09:10`, durationMinutes: 10 })]).layout();
  assert.equal(layout[0].height, 30);
  assert.deepEqual(Array.from(layout, e => e.left), [0, 50]);
});

test("reused lanes and input reordering keep deterministic bounded overlap geometry", () => {
  const tasks = [task("long", { scheduledStart: `${date}T09:00`, durationMinutes: 180 }),
    task("early", { scheduledStart: `${date}T09:00`, durationMinutes: 45 }),
    task("reuse", { scheduledStart: `${date}T10:00`, durationMinutes: 45 })];
  const layout = fixture(tasks).layout(), reverse = fixture([...tasks].reverse()).layout();
  const values = list => Array.from(list, e => [e.task.id, e.left, e.width, e.stack]);
  assert.deepEqual(values(layout), values(reverse));
  assert.equal(layout[1].lane, layout[2].lane);
  assert.ok(layout.every(e => e.left >= 0 && e.width > 0 && e.left + e.width <= 100));
});

test("a long chain caps the inset and resets full width after the conflict ends", () => {
  const tasks = Array.from({ length: 14 }, (_, i) => task(`chain-${i}`, { scheduledStart: `${date}T${String(1 + Math.floor(i * 45 / 60)).padStart(2, "0")}:${String(i * 45 % 60).padStart(2, "0")}`, durationMinutes: 60 }));
  tasks.push(task("separate", { scheduledStart: `${date}T20:00`, durationMinutes: 45 }));
  const layout = fixture(tasks).layout();
  assert.ok(layout.slice(0, -1).every(e => e.left <= 40 && e.width >= 60));
  assert.equal(layout.at(-1).left, 0);
  assert.equal(layout.at(-1).width, 100);
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
