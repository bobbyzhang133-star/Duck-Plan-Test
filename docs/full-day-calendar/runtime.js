// Isolated real browser actions against local storage and the real local QA Worker.
// No user tabs, records, production accounts or transports are reused.
async (page) => {
  const browser = page.context().browser(), contexts = new Set(), cases = [], errors = [], failed = [];
  const out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/full-day-calendar/";
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 7000 });
  const fields = ["id", "title", "classId", "notes", "priority", "dueDate", "dueTime", "durationMinutes", "completed", "reminderChoice", "actualMinutes", "importance", "urgency"];
  let stage = "start", diagnostic = null;
  async function setup(origin, width = 1280, touch = false) {
    const c = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: touch, isMobile: touch && width < 700, timezoneId: "America/Los_Angeles", serviceWorkers: "block", reducedMotion: "reduce" });
    contexts.add(c);
    await c.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    await c.addInitScript(() => {
      window.__fullDayEvents = [];
      for (const type of ["dragstart", "drop", "dragend"]) document.addEventListener(type, e => window.__fullDayEvents.push({ type, trusted: e.isTrusted }), true);
    });
    if (origin.endsWith("8796")) {
      const r = await c.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `full-day-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Fixture-${Date.now()}-LocalQA` } });
      check(r.status() === 201, "Real local signup failed " + r.status());
    }
    const p = await c.newPage(); p.setDefaultTimeout(7000);
    p.on("pageerror", e => errors.push({ origin, width, message: e.message }));
    p.on("requestfailed", r => failed.push({ origin, width, path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
    await p.goto(origin + "/?qa=full-day-calendar#calendar"); await p.bringToFront();
    await wait(p, mode => typeof store !== "undefined" && store.mode === mode && (mode !== "cloud" || (store.user && store.supportsOrganization)), origin.endsWith("8796") ? "cloud" : "local");
    const fixture = await p.evaluate(async () => {
      const klass = await store.upsertClass({ id: crypto.randomUUID(), name: "Full Day QA", color: "#39896f", code: "QA" });
      const task = await store.upsertItem({ id: crypto.randomUUID(), title: "Full Day Task", classId: klass.id, type: "task", notes: "Keep these notes", priority: "High", dueDate: "2026-11-14", dueTime: "18:30", scheduledStart: null, scheduledEnd: null, durationMinutes: 45, completed: false, reminderChoice: "15", actualMinutes: 37, importance: "important", urgency: "not_urgent", source: "manual" });
      const template = await store.upsertTemplate({ id: crypto.randomUUID(), title: "Full Day Template", classId: klass.id, durationMinutes: 45, priority: "Medium", notes: "Keep template", reminderChoice: "off" });
      selectedDate = "2026-11-14"; calendarView = "week"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false });
      return { task, template, color: klass.color };
    });
    return { c, p, origin, width, touch, mode: origin.endsWith("8796") ? "signed-in real local Worker" : "local browser storage", ...fixture };
  }
  async function close(f) { await f.c.close(); contexts.delete(f.c); }
  const snapshot = f => f.p.evaluate(() => ({ tasks: store.listItems(), templates: store.listTemplates() }));
  async function prepare(f, kind = "task", view = "week") {
    await f.p.evaluate(async ({ id, view }) => {
      taskListDrag?.cancel(); clearTemplateDrag(); hideToast();
      const t = store.listItems().find(t => t.id === id); await store.upsertItem({ ...t, scheduledStart: null, scheduledEnd: null });
      selectedDate = "2026-11-14"; calendarView = view; calendarUserScrolled = true; setView("calendar", true); renderAll({ autoScrollCalendar: false });
      document.querySelector("#planner-calendar").scrollTop = 0; document.querySelector("#planner-calendar").scrollLeft = 0;
    }, { id: f.task.id, view });
    if (f.width < 700 && !await f.p.evaluate(() => document.body.classList.contains("task-panel-open"))) await f.p.locator("#phone-task-summary").tap();
    await f.p.locator(kind === "template" ? "#calendar-templates-tab" : "#calendar-tasks-tab").click();
  }
  function source(f, kind) {
    return f.p.locator(kind === "template" ? `#calendar-assignment-templates [data-library-template="${f.template.id}"]` : `#daily-task-panel button[data-drag-task="${f.task.id}"]`);
  }
  async function start(f, kind) {
    const s = source(f, kind); await s.scrollIntoViewIfNeeded(); const b = await s.boundingBox();
    await f.p.mouse.move(b.x + b.width * .4, b.y + Math.min(18, b.height * .4)); await f.p.mouse.down();
    await f.p.mouse.move(b.x + b.width * .4 + 12, b.y + Math.min(18, b.height * .4) + 6, { steps: 6 });
    await wait(f.p, () => document.querySelectorAll(".template-drop-preview").length === 1);
  }
  async function moveTo(f, time) {
    await f.p.evaluate(time => {
      calendarUserScrolled = true; const v = document.querySelector("#planner-calendar"), column = document.querySelector(".timeline-column");
      const minute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
      const y = column.offsetTop + minute * column.offsetHeight / 1440;
      v.scrollTop = Math.max(0, y - v.clientHeight / 2);
    }, time);
    const date = "2026-11-14", t = f.p.locator(`.calendar-slot[data-slot-date="${date}"][data-slot-time="${time}"]`);
    await t.scrollIntoViewIfNeeded(); const b = await t.boundingBox();
    await f.p.mouse.move(b.x + b.width / 2, b.y + 3, { steps: 12 }); await f.p.mouse.move(b.x + b.width / 2, b.y + 3);
    await wait(f.p, () => document.querySelector(".template-drop-preview")?.dataset.dragPlacement === "timeline");
    const q = await f.p.evaluate(date => {
      const e = document.querySelector(".template-drop-preview"), c = document.querySelector(`.timeline-column[data-column-date="${date}"]`), s = getComputedStyle(e);
      return { count: document.querySelectorAll(".template-drop-preview").length, rect: e.getBoundingClientRect().toJSON(), column: c.getBoundingClientRect().toJSON(), caption: e.querySelector("small").textContent, transform: s.transform, color: s.getPropertyValue("--course-color").trim(), scrollTop: document.querySelector("#planner-calendar").scrollTop };
    }, date);
    const minute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)), hh = q.column.height / 24;
    check(q.count === 1 && q.transform === "none" && q.color === f.color, "Preview count/color/transform changed");
    check(Math.abs(q.rect.top - (q.column.top + minute * hh / 60)) < .2 && Math.abs(q.rect.width - (q.column.width - 6)) < .2 && Math.abs(q.rect.height - Math.max(30, 45 * hh / 60)) < .2, "Full-day preview geometry incorrect " + JSON.stringify(q));
    check(q.caption.startsWith(time === "00:00" ? "12:00 AM" : "11:00 PM"), "Stale preview time " + q.caption);
    return q;
  }
  async function persist(f, kind, before, time) {
    await f.p.mouse.up();
    await wait(f.p, () => document.querySelector(".toast").classList.contains("show") && /scheduled/i.test(document.querySelector("#toast-message").textContent));
    await wait(f.p, ({ id, time, kind, before }) => kind === "task" ? store.listItems().find(t => t.id === id)?.scheduledStart === "2026-11-14T" + time : store.listItems().length === before + 1, { id: f.task.id, time, kind, before: before.tasks.length });
    await wait(f.p, () => !document.querySelector(".calendar-drag-ghost,.calendar-native-drag-image,.calendar-drop-target,.is-drag-source"));
    const after = await snapshot(f); let saved;
    if (kind === "task") {
      saved = after.tasks.find(t => t.id === f.task.id); const old = before.tasks.find(t => t.id === f.task.id);
      check(after.tasks.length === before.tasks.length, "Task drag created a copy");
      for (const field of fields) check(JSON.stringify(old[field]) === JSON.stringify(saved[field]), "Task field changed " + field);
    } else {
      const copies = after.tasks.filter(t => !before.tasks.some(old => old.id === t.id)); check(copies.length === 1, "Template copy count incorrect"); saved = copies[0];
      check(JSON.stringify(before.templates) === JSON.stringify(after.templates), "Source template changed");
      for (const field of ["title", "classId", "durationMinutes", "priority", "notes", "reminderChoice"]) check(saved[field] === f.template[field], "Copied field changed " + field);
      check(!saved.dueDate && !saved.dueTime, "Template work time changed deadline");
    }
    check(saved.scheduledStart === "2026-11-14T" + time, "Wrong saved edge time");
    const events = await f.p.evaluate(() => window.__fullDayEvents.splice(0)); check(events.some(e => e.type === "dragstart" && e.trusted) && events.some(e => e.type === "drop" && e.trusted), "No trusted drag/drop evidence");
    await f.p.reload(); await wait(f.p, ({ id, time }) => typeof store !== "undefined" && store.listItems().find(t => t.id === id)?.scheduledStart === "2026-11-14T" + time, { id: saved.id, time });
    return { savedId: saved.id, scheduledStart: saved.scheduledStart, deadline: [saved.dueDate, saved.dueTime], taskCount: after.tasks.length, events };
  }
  try {
    for (const origin of ["http://127.0.0.1:8034", "http://127.0.0.1:8796"]) {
      stage = "setup " + origin; const f = await setup(origin);
      try {
        for (const view of ["day", "week"]) {
          stage = f.mode + " " + view + " full-day slots"; await prepare(f, "task", view); await f.p.locator(`[data-calendar-view="${view}"]`).click();
          const q = await f.p.evaluate(() => ({ columns: [...document.querySelectorAll(".timeline-column")].map(c => ({ date: c.dataset.columnDate, height: c.getBoundingClientRect().height, slots: [...c.querySelectorAll(".calendar-slot")].map(s => s.dataset.slotTime) })), labels: [...document.querySelectorAll(".time-axis span")].map(s => s.textContent) }));
          check(q.columns.length === (view === "day" ? 1 : 7), "Wrong number of days");
          check(q.labels.length === 24 && q.labels[0] === "12:00 AM" && q.labels.at(-1) === "11:00 PM", "Missing full-day labels");
          check(q.columns.every(c => c.slots.length === 24 && c.slots[0] === "00:00" && c.slots.at(-1) === "23:00" && c.height === 24 * 62), "Full-day columns incorrect");
          cases.push({ test: "24-hour-Day-Week-slots-labels-geometry", mode: f.mode, view, status: "PASS", columns: q.columns.length, labels: q.labels });
        }
        for (const kind of ["task", "template"]) for (const time of ["00:00", "23:00"]) {
          stage = f.mode + " " + kind + " drag " + time; await prepare(f, kind, "day"); const before = await snapshot(f); await start(f, kind); const preview = await moveTo(f, time);
          await f.p.screenshot({ path: out + (origin.endsWith("8796") ? "signed" : "local") + "-" + kind + "-" + time.replace(":", "") + ".png" });
          const saved = await persist(f, kind, before, time); cases.push({ test: "trusted-edge-drag-exact-preview-and-reload", mode: f.mode, kind, time, status: "PASS", preview, saved });
        }
        stage = f.mode + " keyboard edge bounds"; await prepare(f, "task", "day");
        const midnight = f.p.locator('.calendar-slot[data-slot-date="2026-11-14"][data-slot-time="00:00"]'); await midnight.focus(); await f.p.keyboard.press("ArrowUp");
        check(await f.p.evaluate(() => document.activeElement.dataset.slotTime === "00:00"), "ArrowUp escaped midnight");
        const last = f.p.locator('.calendar-slot[data-slot-date="2026-11-14"][data-slot-time="23:00"]'); await last.focus(); await f.p.keyboard.press("ArrowDown");
        check(await f.p.evaluate(() => document.activeElement.dataset.slotTime === "23:00"), "ArrowDown escaped day end"); await f.p.keyboard.press("Enter");
        await f.p.locator("#task-modal").waitFor({ state: "visible" }); check(await f.p.locator('#task-form [name="scheduledTime"]').inputValue() === "23:00", "Keyboard slot editor prefill wrong"); await f.p.locator("#cancel-task").click();
        cases.push({ test: "keyboard-midnight-and-23-bounds-editor", mode: f.mode, status: "PASS" });
        if (origin.endsWith("8034")) {
          stage = "current-time line before7 and after22";
          for (const [time, minutes] of [["00:30", 30], ["23:30", 1410]]) {
            await f.p.clock.setFixedTime(new Date("2026-11-14T" + time + ":00-08:00"));
            await f.p.evaluate(() => { selectedDate = "2026-11-14"; calendarView = "day"; renderCalendar({ autoScroll: false }); });
            const line = await f.p.locator(".current-time-line").evaluate(e => ({ top: parseFloat(e.style.top), columnHeight: e.parentElement.getBoundingClientRect().height }));
            check(Math.abs(line.top - minutes * 62 / 60) < .1, "Current-time line has old day offset");
            cases.push({ test: "current-time-line-full-day", time, status: "PASS", line });
          }
          stage = "drag autoscroll full-day range"; await prepare(f, "task", "day"); await start(f, "task");
          await f.p.evaluate(() => document.querySelector("#planner-calendar").scrollTop = 0);
          const b = await f.p.locator("#planner-calendar").boundingBox(); await f.p.mouse.move(b.x + b.width * .6, b.y + b.height - 12, { steps: 10 });
          await wait(f.p, () => document.querySelector("#planner-calendar").scrollTop > 100); const scroll = await f.p.locator("#planner-calendar").evaluate(e => e.scrollTop);
          await f.p.keyboard.press("Escape"); await f.p.mouse.up(); await wait(f.p, () => !document.querySelector(".template-drop-preview"));
          check((await snapshot(f)).tasks.find(t => t.id === f.task.id).scheduledStart === null, "Autoscroll cancel saved task"); cases.push({ test: "long-day-edge-autoscroll-and-cancel", status: "PASS", scroll });
        }
      } finally { await close(f); }
    }
    for (const width of [390, 768]) {
      stage = "touch setup " + width; const f = await setup("http://127.0.0.1:8034", width, true);
      try {
        for (const time of ["00:00", "23:00"]) {
          stage = "touch Schedule " + width + " " + time; await prepare(f, "template", "day"); const before = await snapshot(f);
          const card = source(f, "template").locator(".."); await card.locator('[data-library-action="schedule-template"]').tap(); await f.p.locator("#task-modal").waitFor({ state: "visible" });
          await f.p.locator('#task-form [name="scheduledDate"]').fill("2026-11-14"); await f.p.locator('#task-form [name="scheduledTime"]').fill(time); await f.p.locator("#save-task").tap();
          await wait(f.p, n => store.listItems().length === n + 1, before.tasks.length);
          const after = await snapshot(f), copy = after.tasks.find(t => !before.tasks.some(x => x.id === t.id)); check(copy?.scheduledStart === "2026-11-14T" + time && !copy.dueDate && !copy.dueTime, "Touch Schedule wrong work time/deadline");
          check(JSON.stringify(before.templates) === JSON.stringify(after.templates), "Touch Schedule changed source"); await f.p.reload(); await wait(f.p, id => typeof store !== "undefined" && store.listItems().some(t => t.id === id), copy.id);
          await f.p.evaluate(time => { selectedDate = "2026-11-14"; calendarView = "day"; calendarUserScrolled = false; renderAll({ autoScrollCalendar: true }); }, time);
          await wait(f.p, id => !!document.querySelector(`[data-calendar-drag-task="${id}"]`), copy.id);
          const q = await f.p.evaluate(({ id, width }) => { const c = document.querySelector(".timeline-column"), e = document.querySelector(`[data-calendar-drag-task="${id}"]`); return { pageOverflow: document.documentElement.scrollWidth > innerWidth, columns: document.querySelectorAll(".timeline-column").length, slots: c.querySelectorAll(".calendar-slot").length, taskRect: e.getBoundingClientRect().toJSON(), taskPane: document.querySelector("#daily-task-panel").getBoundingClientRect().toJSON(), calendar: document.querySelector("#planner-calendar").getBoundingClientRect().toJSON(), sheetClosed: !document.body.classList.contains("task-panel-open") }; }, { id: copy.id, width });
          check(!q.pageOverflow && q.slots === 24 && q.columns === 1, "Touch full-day layout broken"); if (width < 700) check(q.sheetClosed, "Phone sheet not collapsed after reload"); else check(q.taskPane.right <= q.calendar.left + 1, "Tablet task/calendar composition changed");
          await f.p.screenshot({ path: out + "touch-" + width + "-" + time.replace(":", "") + ".png" }); cases.push({ test: "touch-Schedule-day-edges-and-reload-layout", width, time, status: "PASS", savedId: copy.id, layout: q });
        }
      } finally { await close(f); }
    }
    return { runtime: browser.version(), cases, errors, failed, allSyntheticContextsClosed: contexts.size === 0, scope: "Local and real signed-in local Worker; touch/viewport emulation is not physical Safari/native/PWA acceptance." };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, diagnostic, cases, errors, failed }; }
  finally { for (const c of contexts) await c.close(); }
}
