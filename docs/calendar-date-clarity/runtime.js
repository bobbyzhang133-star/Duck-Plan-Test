// Affected calendar clarity acceptance in isolated local/current-cloud browser contexts.
async (page) => {
  const browser = page.context().browser(), contexts = [], cases = [], errors = [];
  let fixturePrefix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  const id = n => `${fixturePrefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const base = { classId: id(90), priority: "Medium", durationMinutes: 60, notes: "Keep deadline and work time independent", completed: false, source: "manual", schemaVersion: 2 };
  const manualAlerts = { version: 1, timeZone: "America/Los_Angeles", alarm: { enabled: true, mode: "manual", at: "2026-11-21T16:30", sound: "gentle", snoozeMinutes: 10 }, notification: { enabled: true, mode: "manual", at: "2026-11-21T17:15" } };
  const rows = [
    { title: "Overdue but working today", dueDate: "2026-11-19", dueTime: "18:00", scheduledStart: "2026-11-20T14:00" },
    { title: "Overdue with future work", dueDate: "2026-11-19", dueTime: "17:00", scheduledStart: "2026-11-21T15:00" },
    { title: "Due today with future work", dueDate: "2026-11-20", dueTime: "17:00", scheduledStart: "2026-11-21T10:00" },
    { title: "Work and due on same day", dueDate: "2026-11-20", dueTime: "16:00", scheduledStart: "2026-11-20T10:00" },
    { title: "Work finishes after same-day deadline", dueDate: "2026-11-20", dueTime: "09:00", scheduledStart: "2026-11-20T08:30", durationMinutes: 90 },
    { title: "Overnight work crosses deadline", dueDate: "2026-11-21", dueTime: "00:15", scheduledStart: "2026-11-20T23:30", durationMinutes: 60 },
    { title: "Drag keeps manual alerts and deadline", dueDate: "2026-11-22", dueTime: "17:00", scheduledStart: "2026-11-20T16:00", workAlerts: manualAlerts },
    { title: "Unscheduled backlog", dueDate: "", dueTime: "", scheduledStart: null },
    { title: "Due today without work slot", dueDate: "2026-11-20", dueTime: "19:00", scheduledStart: null },
    { title: "Completed work and due today", dueDate: "2026-11-20", dueTime: "18:00", scheduledStart: "2026-11-20T11:00", completed: true },
    { title: "Overdue without work", dueDate: "2026-11-18", dueTime: "17:00", scheduledStart: null },
    { title: 'Quoted" data-fixture-injected="yes <img src=x onerror="1"> & extra-long name', dueDate: "2026-11-20", dueTime: "20:00", scheduledStart: null },
    { title: "Overflow deadline five", dueDate: "2026-11-20", dueTime: "21:00", scheduledStart: null },
    { title: "Overflow deadline six", dueDate: "2026-11-20", dueTime: "22:00", scheduledStart: null },
    { title: "Date-only overflow deadline", dueDate: "2026-11-20", dueTime: "", scheduledStart: null },
    { title: "Quiet month dual occurrence", dueDate: "2026-11-23", dueTime: "18:00", scheduledStart: "2026-11-23T11:00" },
    { title: "Completed month dual occurrence", dueDate: "2026-11-24", dueTime: "14:00", scheduledStart: "2026-11-24T11:00", completed: true },
  ].map((t, i) => ({ ...base, dueDate: "", dueTime: "", scheduledStart: null, ...t, id: id(i + 1) }));
  const classes = [{ id: id(90), name: "Fixture Science", color: "#39896f", code: "QA", teacher: "Fixture", period: "2", archived: false }];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 15000 });
  const artifacts = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-date-clarity/";
  let stage = "setup", diagnostic = null;
  async function setup(config) {
    fixturePrefix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
    rows.forEach((row, index) => { row.id = id(index + 1); row.classId = id(90); }); classes[0].id = id(90);
    const origin = config.cloud ? "http://127.0.0.1:8796" : "http://127.0.0.1:8034";
    const c = await browser.newContext({ viewport: { width: config.width, height: config.height || 1000 }, timezoneId: "America/Los_Angeles", locale: "en-US", hasTouch: Boolean(config.touch), isMobile: config.width < 700, colorScheme: config.dark ? "dark" : "light", reducedMotion: config.reduce ? "reduce" : "no-preference", serviceWorkers: "block" }); contexts.push(c);
    await c.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    if (config.cloud) {
      const signup = await c.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `calendar-clarity-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Fixture-${Date.now()}-OnlyLocalQA` } }); assert(signup.status() === 201, "Synthetic signup failed");
      const response = await c.request.post(origin + "/api/import", { headers: { Origin: origin }, data: { classRows: classes.map(t => ({ id: t.id, name: t.name, color: t.color, code: t.code, teacher: t.teacher, period: t.period })), itemRows: rows.map(t => ({ id: t.id, class_id: t.classId, title: t.title, due_date: t.dueDate || null, due_time: t.dueTime || null, scheduled_start: t.scheduledStart, duration_minutes: t.durationMinutes, completed: t.completed, priority: t.priority, notes: t.notes, ...(t.workAlerts ? { work_alerts: JSON.stringify(t.workAlerts) } : {}) })) } }); assert(response.ok(), "Synthetic fixture import failed " + response.status());
    } else await c.addInitScript(({ rows, classes }) => {
      if (localStorage.getItem("calendar-clarity-fixture-v1")) return;
      localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify(rows)); localStorage.setItem("duckplan-demo-classes-v1", JSON.stringify(classes)); localStorage.setItem("calendar-clarity-fixture-v1", "ready");
    }, { rows, classes });
    const p = await c.newPage(); p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(60000); p.on("pageerror", e => errors.push({ mode: config.cloud ? "cloud" : "local", width: config.width, error: e.message }));
    await p.clock.install({ time: new Date("2026-11-20T12:00:00-08:00") }); await p.goto(origin + "/?qa=calendar-date-clarity#calendar", { waitUntil: "domcontentloaded" }); await p.bringToFront();
    await wait(p, ({ cloud, target }) => typeof store !== "undefined" && workAlertContextReady && store.mode === (cloud ? "cloud" : "local") && store.listItems().some(t => t.id === target), { cloud: config.cloud, target: id(16) });
    await p.evaluate(dark => { document.documentElement.dataset.theme = dark ? "dark" : "light"; selectedDate = "2026-11-20"; calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); }, config.dark);
    return { c, p, origin, ...config, mode: config.cloud ? "signed-in isolated real Worker" : "local browser storage" };
  }
  const act = (f, locator) => f.touch ? locator.tap() : locator.click();
  async function panel(f, open = true) {
    if (f.width < 700 && await f.p.evaluate(() => document.body.classList.contains("task-panel-open")) !== open) await act(f, open ? f.p.locator("#phone-task-summary") : f.p.locator("#calendar-library-toolbar [data-close-task-panel]"));
    if (open) await act(f, f.p.locator("#calendar-tasks-tab"));
  }
  async function close(f) { await f.c.close(); contexts.splice(contexts.indexOf(f.c), 1); }
  async function checkCountsAndDates(f) {
    await panel(f);
    const expected = { overdue: [2,11], scheduled: [1,4,5,6,7], unscheduled: [3,9,12,13,14,15], backlog: [8], completed: [10] };
    const actual = await f.p.evaluate(() => Object.fromEntries(["overdue","scheduled","unscheduled","backlog","completed"].map(name => [name, [...document.querySelectorAll(`#${name}-task-list [data-task-card]`)].map(e => e.dataset.taskCard)])));
    for (const [name, values] of Object.entries(expected)) assert(JSON.stringify([...actual[name]].sort()) === JSON.stringify(values.map(id).sort()), `${name} primary memberships differ: ${JSON.stringify(actual[name])}`);
    const all = Object.values(actual).flat(); assert(all.length === 15 && new Set(all).size === 15, "A task has duplicate primary cards");
    const progress = await f.p.evaluate(() => ({ copy: els.dailyPanelProgress.textContent, counts: Object.fromEntries(Object.entries(els.counts).map(([name,e])=>[name,Number(e.textContent)])), remaining: els.phoneTaskSummaryCopy?.textContent }));
    assert(/1 of 12/.test(progress.copy), "Progress does not count unique selected-day tasks: " + progress.copy);
    for (const [name, values] of Object.entries(expected)) assert(progress.counts[name] === values.length, "Incorrect section count " + name);
    assert(/14 remaining/.test(progress.remaining), "Remaining count duplicates or omits primary tasks: " + progress.remaining);
    for (const n of [1,2,3,4,5,6,7]) {
      const card = f.p.locator(`#daily-task-panel [data-task-card="${id(n)}"]`);
      const text = await card.textContent();
      assert(/Due|Deadline/i.test(text) && /Work/i.test(text), "Task card hides due or work context " + n + ": " + text);
      if ([1,2,5].includes(n)) assert(/Overdue/.test(text), "Overdue status missing from scheduled or future-work card " + n);
      if ([1,2,3,5,6].includes(n)) assert(/after.*deadline|deadline.*after/i.test(text), "Work-end warning missing " + n + ": " + text);
      const lines = await card.locator('.task-date-line').allTextContents();
      assert(lines.length === 2 && /^Due:/.test(lines[0]) && /^Work:/.test(lines[1]), "Dates are not separately labeled " + n);
      if ([2,3].includes(n)) assert(/Nov 21/.test(lines[1]), "Future work date is hidden on due/overdue task " + n);
      if (n === 6) assert(/Nov 21/.test(lines[1]), "Overnight work end hides its next-day date");
    }
    await openCorrectTask(f, f.p.locator(`#daily-task-panel [data-task-card="${id(5)}"] .task-reschedule`), 5);
    const long = await f.p.locator(`#daily-task-panel [data-task-card="${id(12)}"] .task-title`).textContent();
    assert(long === rows[11].title && !await f.p.evaluate(() => Boolean(window.fixtureInjection)) && await f.p.locator('#daily-task-panel img[src="x"]').count() === 0 && await f.p.locator('[data-fixture-injected]').count() === 0, "Task title escaped incorrectly or injected attributes");
    for (const container of ["#daily-task-panel", "#all-task-list"]) assert(await f.p.locator(`${container} .task-edit[data-edit-task="${id(12)}"]`).getAttribute("aria-label") === "Edit " + rows[11].title, "Quoted title truncated accessible task label " + container);
    assert(await f.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Page horizontal overflow in task panel");
    return { memberships: actual, progress };
  }
  async function openCorrectTask(f, control, number) {
    const calendarControl = await control.evaluate(el => Boolean(el.closest("#planner-calendar")));
    await act(f, control);
    if (calendarControl) {
      await wait(f.p, () => document.querySelector("#calendar-task-preview")?.open);
      assert(!await f.p.locator("#task-modal").evaluate(e => e.open), "Calendar click skipped compact preview");
      assert((await f.p.locator("#calendar-task-preview").textContent()).includes(rows[number - 1].title), "Compact preview shows wrong task");
      await f.p.keyboard.press("Escape"); await wait(f.p, () => !document.querySelector("#calendar-task-preview")?.open);
      assert(await control.evaluate(el => document.activeElement === el), "Compact preview Escape did not restore source focus");
      await act(f, control); await wait(f.p, () => document.querySelector("#calendar-task-preview").open); await act(f, f.p.locator("#calendar-preview-edit"));
    }
    await wait(f.p, () => document.querySelector("#task-modal").open);
    const state = await f.p.evaluate(() => ({ id: editingTaskId, title: els.form.elements.title.value, due: els.form.elements.dueDate.value, work: els.form.elements.scheduledDate.value, start: els.form.elements.scheduledTime.value }));
    assert(state.id === id(number) && state.title === rows[number - 1].title, "Calendar control opened the wrong task");
    assert(state.due === rows[number - 1].dueDate && state.work === (rows[number - 1].scheduledStart?.slice(0,10) || ""), "Editor conflates deadline and work date");
    await f.p.keyboard.press("Escape"); await wait(f.p, () => !document.querySelector("#task-modal").open);
    return state;
  }
  async function geometry(f) {
    return f.p.evaluate(taskID => {
      const calendar = document.querySelector("#planner-calendar"), column = calendar.querySelector('.timeline-column[data-column-date="2026-11-20"]');
      const header = calendar.querySelector(".timeline-days"), deadline = calendar.querySelector(".timeline-deadlines"), line = column.querySelector(".current-time-line");
      const cb = column.getBoundingClientRect(), hb = header.getBoundingClientRect(), db = deadline.getBoundingClientRect(), vb = calendar.getBoundingClientRect();
      const slots = [...column.querySelectorAll(".calendar-slot")], now = new Date(), minutes = now.getHours() * 60 + now.getMinutes();
      return { height: cb.height, slots: slots.length, first: slots[0].dataset.slotTime, last: slots.at(-1).dataset.slotTime, headerOffset: hb.top - vb.top, deadlineGap: db.top - hb.bottom,
        lineOffset: line.getBoundingClientRect().top - cb.top, expectedLine: minutes * cb.height / (24 * 60), eventOffset: column.querySelector('[data-calendar-drag-task="' + taskID + '"]').getBoundingClientRect().top - cb.top };
    }, id(5));
  }
  async function deadlineOverflowAndGrid(f) {
    await panel(f, false);
    const cell = () => f.p.locator('.deadline-cell[data-deadline-date="2026-11-20"]');
    assert(await cell().locator('.deadline-chip').count() === 3, "Default deadline layer is silently truncated or unbounded");
    const more = () => cell().locator('[data-deadline-overflow="2026-11-20"]');
    assert(/5 more/.test(await more().textContent()), "Deadline overflow omits hidden task count");
    await act(f, more()); await wait(f.p, () => document.querySelector('[data-deadline-overflow="2026-11-20"]').getAttribute("aria-expanded") === "true");
    assert(await cell().locator('.deadline-chip').count() === 8, "Expanded deadlines omit a task");
    assert(/End of day/.test(await cell().locator(`[data-edit-task="${id(15)}"]`).textContent()), "Date-only deadline does not explain its end-of-day meaning");
    await openCorrectTask(f, cell().locator(`[data-edit-task="${id(15)}"]`), 15);
    const focusReturned = await f.p.evaluate(id => document.activeElement?.dataset.editTask === id, id(15));
    assert(focusReturned, "Deadline task close did not return focus to its marker");
    await act(f, more()); await wait(f.p, () => document.querySelector('[data-deadline-overflow="2026-11-20"]').getAttribute("aria-expanded") === "false");
    assert(await cell().locator('.deadline-chip').count() === 3, "Collapse did not restore compact deadline layer");
    await f.p.locator("#planner-calendar").evaluate(el => { el.scrollTop = 600; });
    const metrics = await geometry(f);
    assert(metrics.slots === 24 && metrics.first === "00:00" && metrics.last === "23:00" && Math.abs(metrics.height - 24 * 62) < 1, "Sticky deadline changes broke 24-hour grid geometry: " + JSON.stringify(metrics));
    assert(Math.abs(metrics.headerOffset) <= 2 && Math.abs(metrics.deadlineGap) <= 2, "Day/deadline headers do not stay together: " + JSON.stringify(metrics));
    assert(Math.abs(metrics.lineOffset - metrics.expectedLine) <= 2 && Math.abs(metrics.eventOffset - 8.5 * 62) <= 2, "Current-time or event position shifted against the hour grid");
    await f.p.screenshot({ path: artifacts + `day-${f.cloud ? "cloud" : "local"}-${f.width}.png` });
    return { metrics, focusReturned };
  }
  async function weekLayers(f) {
    await panel(f, false); await act(f, f.p.locator('[data-calendar-view="week"]')); await wait(f.p, () => calendarView === "week");
    const columns = await f.p.locator(".timeline-column").count(); assert(columns === (f.width < 700 ? 1 : 7), "Week lost its intended day columns");
    if (f.width < 700) assert(await f.p.locator('.phone-week-day').count() === 7 && await f.p.locator('.phone-week-day[aria-pressed="true"]').getAttribute("data-date") === "2026-11-20", "Phone week selector lost selected day");
    const due = f.p.locator('.deadline-cell[data-deadline-date="2026-11-20"]');
    assert(await due.locator('.deadline-chip').count() === 3 && /5 more/.test(await due.locator('.deadline-overflow').textContent()), "Week deadline overflow is inaccessible");
    await f.p.locator("#planner-calendar").evaluate(el => { el.scrollTop = 600; }); const metrics = await geometry(f);
    assert(Math.abs(metrics.headerOffset) <= 2 && Math.abs(metrics.deadlineGap) <= 2 && Math.abs(metrics.lineOffset - metrics.expectedLine) <= 2, "Week sticky bands/grid not aligned");
    await act(f, f.p.locator('[data-calendar-view="day"]')); await wait(f.p, () => calendarView === "day");
    return { columns, metrics };
  }
  async function monthLayers(f) {
    await panel(f, false); await act(f, f.p.locator('[data-calendar-view="month"]')); await wait(f.p, () => Boolean(document.querySelector(".calendar-layered-month")));
    const day = date => f.p.locator(`.month-day[data-date="${date}"]`);
    assert(await f.p.locator("button button").count() === 0, "Month task controls are nested buttons");
    const busyLabel = await day("2026-11-20").locator('.month-date-button').getAttribute("aria-label");
    assert(/9 deadlines/.test(busyLabel) && /6 work sessions/.test(busyLabel) && /12 tasks/.test(busyLabel), "Month counts double-count task occurrences: " + busyLabel);
    await act(f, day("2026-11-23").locator('.month-date-button')); await wait(f.p, () => selectedDate === "2026-11-23");
    const quietLabel = await day("2026-11-23").locator('.month-date-button').getAttribute("aria-label");
    assert(/1 deadline/.test(quietLabel) && /1 work session/.test(quietLabel) && /1 task(?:\D|$)/.test(quietLabel), "Same task's work/deadline does not count as one task: " + quietLabel);
    assert(await day("2026-11-23").locator(`[data-edit-task="${id(16)}"]`).count() === 2, "Quiet Month day lost one occurrence");
    if (f.width < 700) {
      const agenda = () => f.p.locator('.month-selected-agenda');
      assert(await agenda().isVisible(), "Phone Month hides its selected-day agenda");
      assert(await agenda().locator(`[data-edit-task="${id(16)}"][data-calendar-kind="work"]`).count() === 1 && await agenda().locator(`[data-edit-task="${id(16)}"][data-calendar-kind="deadline"]`).count() === 1, "Phone agenda merges work and deadline occurrences");
      await openCorrectTask(f, agenda().locator(`[data-edit-task="${id(16)}"][data-calendar-kind="work"]`), 16);
      await act(f, day("2026-11-20").locator('.month-date-button')); await wait(f.p, () => selectedDate === "2026-11-20");
      assert(await agenda().locator('[data-calendar-kind="work"]').count() === 6 && await agenda().locator('[data-calendar-kind="deadline"]').count() === 9, "Phone busy-day agenda hides work/deadline overflow");
    } else {
      await openCorrectTask(f, day("2026-11-23").locator(`[data-edit-task="${id(16)}"][data-calendar-kind="deadline"]`), 16);
      await act(f, day("2026-11-20").locator('.month-overflow')); await wait(f.p, () => calendarView === "day");
      assert(await f.p.locator('.timeline-column[data-column-date="2026-11-20"]').count() === 1, "Month More did not open the correct day");
      await act(f, f.p.locator('[data-calendar-view="month"]')); await wait(f.p, () => Boolean(document.querySelector(".calendar-layered-month")));
    }
    const completedCell = day("2026-11-24");
    const completedLabel = await completedCell.locator('.month-date-button').getAttribute("aria-label");
    assert(/1 deadline/.test(completedLabel) && /1 work session/.test(completedLabel) && /1 task(?:\D|$)/.test(completedLabel), "Completed Month task disappeared or duplicated unique count");
    assert(await completedCell.locator(`[data-edit-task="${id(17)}"].is-completed`).count() === 2 && /Completed/.test(await completedCell.locator(`[data-edit-task="${id(17)}"]`).first().getAttribute("aria-label")), "Completed Month occurrences lack clear status");
    if (f.width < 700) {
      await act(f, completedCell.locator('.month-date-button')); await wait(f.p, () => selectedDate === "2026-11-24");
      assert(await f.p.locator(`.month-selected-agenda [data-edit-task="${id(17)}"].is-completed`).count() === 2 && /Completed/.test(await f.p.locator('.month-selected-agenda').textContent()), "Phone completed agenda omitted occurrences or status");
      await openCorrectTask(f, f.p.locator(`.month-selected-agenda [data-edit-task="${id(17)}"][data-calendar-kind="deadline"]`), 17);
      await act(f, day("2026-11-20").locator('.month-date-button')); await wait(f.p, () => selectedDate === "2026-11-20");
    } else await openCorrectTask(f, completedCell.locator(`[data-edit-task="${id(17)}"][data-calendar-kind="deadline"]`), 17);
    assert(!/Completed/.test(await day("2026-11-20").locator('.month-entries').textContent()), "Completed occurrences displace unfinished work/deadlines in limited Month previews");
    assert(await f.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Month page horizontal overflow");
    await f.p.screenshot({ path: artifacts + `month-${f.cloud ? "cloud" : "local"}-${f.width}.png` });
    return { busyLabel, quietLabel, completedLabel };
  }
  async function previewActions(f) {
    await panel(f, false);
    const block = f.p.locator(`.calendar-event-block[data-edit-task="${id(4)}"]`);
    const style = await block.evaluate(el => { const css = getComputedStyle(el); return { left: parseFloat(css.borderLeftWidth), right: parseFloat(css.borderRightWidth), background: css.backgroundColor }; });
    assert(style.left <= Math.max(1, style.right), "Work block retains a colored left stripe");
    await act(f, block); await wait(f.p, () => document.querySelector("#calendar-task-preview").open);
    const preview = f.p.locator("#calendar-task-preview"), text = await preview.textContent();
    assert(text.includes(rows[3].title) && /Due|Deadline/.test(text) && /Work/.test(text), "Compact preview hides one timing context");
    await act(f, f.p.locator("#calendar-preview-complete")); await wait(f.p, taskId => store.listItems().find(t => t.id === taskId)?.completed, id(4));
    await wait(f.p, () => document.querySelector("#calendar-task-preview").open && /incomplete/i.test(document.querySelector("#calendar-preview-complete").textContent) && /Completed/.test(document.querySelector("#calendar-task-preview").textContent));
    assert(await preview.evaluate(e => e.open), "Preview completion did not retain a clear reversible state");
    await act(f, f.p.locator("#calendar-preview-complete")); await wait(f.p, taskId => !store.listItems().find(t => t.id === taskId)?.completed, id(4));
    await f.p.keyboard.press("Escape"); await wait(f.p, () => !document.querySelector("#calendar-task-preview")?.open);
    await panel(f); const checkbox = f.p.locator(`#daily-task-panel input[data-task-id="${id(4)}"]`); await checkbox.check(); await wait(f.p, taskId => store.listItems().find(t => t.id === taskId)?.completed, id(4)); await checkbox.uncheck(); await wait(f.p, taskId => !store.listItems().find(t => t.id === taskId)?.completed, id(4));
    assert(!await f.p.locator("#task-modal").evaluate(e => e.open), "Completion checkbox opened task editor");
    await panel(f, false); await act(f, f.p.locator(`.calendar-event-block[data-edit-task="${id(7)}"]`)); await wait(f.p, () => document.querySelector("#calendar-task-preview").open);
    await act(f, f.p.locator("#calendar-preview-reschedule")); await wait(f.p, () => document.querySelector("#task-modal").open);
    const reschedule = await f.p.evaluate(() => ({ id: editingTaskId, date: els.form.elements.scheduledDate.value, time: els.form.elements.scheduledTime.value, focus: document.activeElement?.name }));
    assert(reschedule.id === id(7) && reschedule.date === "2026-11-20" && reschedule.time === "16:00", "Preview Reschedule opened wrong work context");
    await f.p.keyboard.press("Escape"); await wait(f.p, () => !document.querySelector("#task-modal").open);
    return { style, reschedule };
  }
  async function scheduleAndUndo(f) {
    await act(f, f.p.locator('[data-calendar-view="day"]')); await wait(f.p, () => calendarView === "day");
    await f.p.evaluate(() => { selectedDate = "2026-11-20"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); }); await panel(f);
    if (f.cloud) { await f.p.evaluate(() => store.refresh()); await f.p.waitForLoadState("networkidle"); }
    const before = await f.p.evaluate(taskId => ({ task: structuredClone(store.listItems().find(t => t.id === taskId)), count: store.listItems().length }), id(7));
    if (!f.touch) {
      const source = f.p.locator(`#daily-task-panel .task-select[data-drag-task="${id(7)}"]`), target = f.p.locator('[data-slot-date="2026-11-20"][data-slot-time="14:00"]');
      await source.scrollIntoViewIfNeeded(); await target.scrollIntoViewIfNeeded(); const a = await source.boundingBox(), b = await target.boundingBox();
      await f.p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await f.p.mouse.down(); await f.p.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 }); await f.p.mouse.move(b.x + b.width / 2, b.y + 4, { steps: 15 }); await f.p.mouse.move(b.x + b.width / 2 + 1, b.y + 4);
      await wait(f.p, () => Boolean(document.querySelector('.template-drop-preview[data-drag-placement="timeline"]:not([hidden])')));
      const visual = await f.p.evaluate(() => { const preview = document.querySelector('.template-drop-preview:not([hidden])'), col = document.querySelector('.timeline-column.calendar-drop-target'); return { count: document.querySelectorAll('.template-drop-preview:not([hidden])').length, width: preview.getBoundingClientRect().width, expected: col.getBoundingClientRect().width - 6, top: preview.getBoundingClientRect().top - col.getBoundingClientRect().top, caption: preview.querySelector('small').textContent }; });
      assert(visual.count === 1 && Math.abs(visual.width - visual.expected) < 1 && Math.abs(visual.top - 14 * 62) < 2 && /2:00 PM/.test(visual.caption), "Sticky band broke fitted drag placement: " + JSON.stringify(visual));
      await f.p.mouse.up(); await wait(f.p, taskId => store.listItems().find(t => t.id === taskId)?.scheduledStart === "2026-11-20T14:00", id(7));
      const moved = await f.p.evaluate(taskId => ({ task: structuredClone(store.listItems().find(t => t.id === taskId)), count: store.listItems().length }), id(7));
      assert(moved.count === before.count && moved.task.dueDate === before.task.dueDate && moved.task.dueTime === before.task.dueTime && JSON.stringify(moved.task.workAlerts) === JSON.stringify(before.task.workAlerts), "Drag changes deadline/manual alert preferences or identity/count");
      await act(f, f.p.locator("#toast-action")); await wait(f.p, taskId => store.listItems().find(t => t.id === taskId)?.scheduledStart === "2026-11-20T16:00", id(7));
      await wait(f.p, () => /undone|previous time/i.test(document.querySelector("#toast-message").textContent));
      if (f.cloud) { await f.p.evaluate(() => store.refresh()); await f.p.waitForLoadState("networkidle"); }
      assert(JSON.stringify(await f.p.evaluate(taskId => store.listItems().find(t => t.id === taskId).workAlerts, id(7))) === JSON.stringify(before.task.workAlerts), "Undo changes manual alert choices");
      await source.scrollIntoViewIfNeeded(); const cancelSource = await source.boundingBox(); await f.p.mouse.move(cancelSource.x + cancelSource.width / 2, cancelSource.y + cancelSource.height / 2); await f.p.mouse.down(); await f.p.mouse.move(cancelSource.x + cancelSource.width / 2 + 15, cancelSource.y + cancelSource.height / 2 + 15, { steps: 4 }); await f.p.keyboard.press("Escape"); await f.p.mouse.up();
      assert(await f.p.locator(".template-drop-preview").count() === 0 && await f.p.evaluate(taskId => store.listItems().find(t => t.id === taskId).scheduledStart === "2026-11-20T16:00", id(7)), "Escape drag cancellation leaked preview or changed work time");
      return { input: "trusted mouse/native HTML drag + Undo + Escape", visual };
    }
    await openCorrectTask(f, f.p.locator(`#daily-task-panel .task-select[data-edit-task="${id(7)}"]`), 7);
    await act(f, f.p.locator(`#daily-task-panel .task-select[data-edit-task="${id(7)}"]`)); await wait(f.p, () => document.querySelector("#task-modal").open);
    await f.p.locator('[name="scheduledTime"]').fill("16:15"); await f.p.locator('[name="scheduledTime"]').press("Tab"); await act(f, f.p.locator("#save-task")); await wait(f.p, () => !document.querySelector("#task-modal").open);
    const saved = await f.p.evaluate(taskId => store.listItems().find(t => t.id === taskId), id(7));
    assert(saved.scheduledStart === "2026-11-20T16:15" && saved.dueDate === before.task.dueDate && saved.dueTime === before.task.dueTime && JSON.stringify(saved.workAlerts) === JSON.stringify(before.task.workAlerts), "Touch work-time editing changes deadline or manual alerts");
    await f.p.reload({ waitUntil: "domcontentloaded" }); await wait(f.p, taskId => typeof store !== "undefined" && workAlertContextReady && store.listItems().find(t => t.id === taskId)?.scheduledStart === "2026-11-20T16:15", id(7));
    return { input: "touch editor alternative + persistence", savedWork: saved.scheduledStart };
  }
  async function ownerCleanup(f) {
    if (!f.cloud) return { status: "NOT RUN", reason: "Owner switch applies to signed-in fixtures" };
    await panel(f, false); await act(f, f.p.locator(`.calendar-event-block[data-edit-task="${id(7)}"]`)); await wait(f.p, () => document.querySelector("#calendar-task-preview").open);
    await f.c.request.post(f.origin + "/api/auth/sign-out", { headers: { Origin: f.origin } }); await f.p.evaluate(() => store.refresh()); await wait(f.p, () => store.mode === "local" && !store.user);
    assert(!await f.p.locator("#task-modal").evaluate(e => e.open) && !await f.p.evaluate(() => document.querySelector("#calendar-task-preview")?.open) && await f.p.evaluate(ids => editingTaskId === null && !store.listItems().some(t => ids.includes(t.id)), rows.map(t => t.id)), "Owner change retained old task editor or records");
    assert(await f.p.locator('.template-drop-preview').count() === 0, "Owner change retained drag preview");
    return { status: "PASS", action: "real fixture session invalidation + normal session refresh" };
  }
  const configs = [
    { cloud: false, width: 1280, height: 1000, touch: false, dark: false, reduce: false },
    { cloud: true, width: 1280, height: 1000, touch: false, dark: true, reduce: true },
    { cloud: false, width: 835, height: 1112, touch: true, dark: true, reduce: true },
    { cloud: true, width: 768, height: 1024, touch: true, dark: false, reduce: false },
    { cloud: false, width: 390, height: 844, touch: true, dark: false, reduce: true },
    { cloud: true, width: 390, height: 844, touch: true, dark: true, reduce: false },
    { cloud: false, width: 320, height: 740, touch: true, dark: true, reduce: true },
    { cloud: true, width: 320, height: 740, touch: true, dark: false, reduce: true },
  ];
  try {
    for (const config of configs) {
      stage = `setup ${config.cloud ? "cloud" : "local"} ${config.width}`; const f = await setup(config);
      try {
        const evidence = { mode: f.mode, width: f.width, height: f.height, touchEmulation: f.touch, theme: f.dark ? "dark" : "light", reducedMotion: f.reduce, checks: {} };
        stage = `primary grouping/metadata ${f.mode} ${f.width}`; evidence.checks.primary = await checkCountsAndDates(f);
        stage = `deadline/geometry ${f.mode} ${f.width}`; evidence.checks.deadline = await deadlineOverflowAndGrid(f);
        stage = `preview actions ${f.mode} ${f.width}`; evidence.checks.preview = await previewActions(f);
        stage = `Week layers ${f.mode} ${f.width}`; evidence.checks.week = await weekLayers(f);
        stage = `Month layers ${f.mode} ${f.width}`; evidence.checks.month = await monthLayers(f);
        stage = `schedule persistence ${f.mode} ${f.width}`; evidence.checks.schedule = await scheduleAndUndo(f);
        stage = `owner cleanup ${f.mode} ${f.width}`; evidence.checks.owner = await ownerCleanup(f);
        evidence.status = "PASS"; cases.push(evidence);
      } catch (error) {
        diagnostic = await f.p.evaluate(() => ({ view: document.body.dataset.view, selectedDate, calendarView, modal: document.querySelector("#task-modal")?.open, preview: document.querySelector("#calendar-task-preview")?.open, taskError: document.querySelector("#task-form-error")?.textContent, alertError: document.querySelector("#task-alarm-save-error")?.textContent, overflow: document.documentElement.scrollWidth > innerWidth, mode: store.mode }));
        await f.p.screenshot({ path: artifacts + `failure-${f.cloud ? "cloud" : "local"}-${f.width}.png` }).catch(() => {}); throw error;
      } finally { await close(f); }
    }
    return { runtime: browser.version(), cases, errors, passed: errors.length === 0, allSyntheticContextsClosed: contexts.length === 0,
      scope: "Affected frontend calendar flows only; signed-in writes use real isolated Worker/schema0001–0006. Touch emulation does not establish native or physical Safari behavior. No deployment or native bundle sync." };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, diagnostic, cases, errors }; }
  finally { for (const c of contexts) await c.close(); }
}
