// Isolated real local/browser and real local QA Worker; user planner is never reused.
async (page) => {
  const browser = page.context().browser(), contexts = new Set(), cases = [], errors = [], failed = [];
  const out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/template-add-visibility/";
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 7000 });
  let stage = "setup", diagnostic = null;
  async function setup(origin, width = 835, touch = false, theme = "light") {
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: "America/Los_Angeles", hasTouch: touch, isMobile: touch && width < 700, reducedMotion: "reduce", serviceWorkers: "block" }); contexts.add(context);
    await context.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    if (origin.endsWith("8796")) {
      const response = await context.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `template-visible-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Fixture-${Date.now()}-LocalQA` } });
      check(response.status() === 201, "Local QA signup failed " + response.status());
    }
    const p = await context.newPage(); p.setDefaultTimeout(7000);
    p.on("pageerror", e => errors.push({ origin, width, message: e.message }));
    p.on("requestfailed", r => failed.push({ origin, width, path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
    await p.goto(origin + "/?qa=template-add-visibility#calendar"); await p.bringToFront();
    await wait(p, mode => typeof store !== "undefined" && store.mode === mode && (mode === "local" || store.user && store.supportsOrganization), origin.endsWith("8796") ? "cloud" : "local");
    const fixture = await p.evaluate(async () => {
      const klass = await store.upsertClass({ id: crypto.randomUUID(), name: "Visibility QA", color: "#c48b34", code: "QA" });
      const template = await store.upsertTemplate({ id: crypto.randomUUID(), title: "BC Calculus visibility QA", classId: klass.id, durationMinutes: 45, priority: "Medium", notes: "Keep the reusable template notes", reminderChoice: "off" });
      const existingCopy = await store.upsertItem({ ...DuckPlanLibrary.instantiateTemplate(template), title: "Previously saved unscheduled copy" });
      for (let index = 0; index < 11; index += 1) await store.upsertItem({ ...DuckPlanLibrary.instantiateTemplate(template), title: `Existing unscheduled copy ${index + 2}` });
      selectedDate = "2026-11-14"; calendarView = "week"; calendarUserScrolled = true; setView("calendar", true); renderAll({ autoScrollCalendar: false });
      return { template, existingCopy, ids: store.listItems().map(t => t.id), progress: document.querySelector("#daily-panel-progress").textContent, selectedDate };
    });
    await p.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    if (width < 700) await p.locator("#phone-task-summary").tap();
    await p.locator("#calendar-templates-tab").click();
    return { context, p, origin, width, touch, theme, mode: origin.endsWith("8796") ? "signed-in real local Worker" : "local browser storage", ...fixture };
  }
  async function close(f) { await f.context.close(); contexts.delete(f.context); }
  const add = f => f.p.getByRole("button", { name: "Add BC Calculus visibility QA to tasks", exact: true });
  async function clickAdd(f) { if (f.touch) await add(f).tap(); else await add(f).click(); }
  async function assertRevealed(f, id, hitTest = false) {
    await wait(f.p, id => {
      const buttons = [...document.querySelectorAll(`#daily-task-panel button[data-edit-task="${id}"]`)];
      return document.body.dataset.view === "calendar" && document.querySelector("#calendar-tasks-tab").getAttribute("aria-selected") === "true" && buttons.some(e => e.getClientRects().length && !e.closest("[hidden],[inert]"));
    }, id);
    const row = f.p.locator(`#daily-task-panel button.task-select[data-edit-task="${id}"]`);
    check(await row.isVisible(), "Created row is not visible");
    if (hitTest) {
      const visible = await row.evaluate(e => {
        const row = e.getBoundingClientRect(), panel = e.closest("#daily-task-panel").getBoundingClientRect(), toolbar = document.querySelector("#calendar-library-toolbar").getBoundingClientRect();
        const x = row.left + row.width / 2, y = row.top + row.height / 2, hit = document.elementFromPoint(x, y);
        return { row: row.toJSON(), panel: panel.toJSON(), toolbar: toolbar.toJSON(), centerUncovered: Boolean(hit && e.contains(hit)), inViewport: x >= Math.max(0, panel.left) && x <= Math.min(innerWidth, panel.right) && y >= Math.max(0, panel.top, toolbar.bottom) && y <= Math.min(innerHeight, panel.bottom) };
      });
      check(visible.centerUncovered && visible.inViewport, "Created row hidden beneath sticky toolbar/outside its scroller: " + JSON.stringify(visible));
    }
    return row;
  }
  async function assertCopy(f, beforeIds = f.ids) {
    const result = await f.p.evaluate(({ ids, template }) => ({
      copies: store.listItems().filter(t => !ids.includes(t.id)),
      template: store.listTemplates().find(t => t.id === template.id),
      selectedDate, progress: document.querySelector("#daily-panel-progress").textContent,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
    }), { ids: beforeIds, template: f.template });
    check(result.copies.length === 1, "Add created the wrong number of tasks");
    const copy = result.copies[0];
    check(copy.id !== f.template.id && !copy.scheduledStart && !copy.scheduledEnd && !copy.dueDate && !copy.dueTime, "Task acquired an invented schedule/deadline");
    for (const name of ["title", "classId", "durationMinutes", "priority", "notes", "reminderChoice"]) check(copy[name] === f.template[name], "Copy lost saved " + name);
    check(JSON.stringify(result.template) === JSON.stringify(f.template), "Source template changed");
    check(result.selectedDate === f.selectedDate && result.progress === f.progress, "Unscheduled copy changed daily date/progress");
    check(!result.pageOverflow, "Page overflow after revealing new copy");
    const row = await assertRevealed(f, copy.id, true);
    check(await row.getAttribute("draggable") === "true", "New unscheduled row cannot be dragged");
    return { copy, row, result };
  }
  async function functional(f) {
    await clickAdd(f);
    await wait(f.p, () => document.querySelector(".toast").classList.contains("show") && /Added/.test(document.querySelector("#toast-message").textContent));
    const { copy, row, result } = await assertCopy(f);
    await wait(f.p, () => !document.querySelector('#calendar-templates-tab.interaction-released,#calendar-templates-tab.interaction-pressed'));
    await f.p.screenshot({ path: out + (f.origin.endsWith("8796") ? "signed" : "local") + "-" + f.width + "-" + f.theme + "-revealed.png" });
    if (f.touch) await row.tap(); else await row.click();
    await f.p.locator("#task-modal").waitFor({ state: "visible" });
    const form = await f.p.locator("#task-form").evaluate(e => ({ title: e.elements.title.value, date: e.elements.scheduledDate.value, time: e.elements.scheduledTime.value, due: e.elements.dueDate.value, dueTime: e.elements.dueTime.value, duration: e.elements.durationMinutes.value, notes: e.elements.notes.value }));
    check(form.title === copy.title && !form.date && !form.time && !form.due && !form.dueTime && form.duration === "45" && form.notes === copy.notes, "Clicking new task opened wrong editor");
    await f.p.locator("#cancel-task").click(); await wait(f.p, () => !document.querySelector("#task-modal").open);
    await f.p.reload(); await wait(f.p, id => typeof store !== "undefined" && store.listItems().some(t => t.id === id), copy.id);
    if (f.width < 700) await f.p.locator("#phone-task-summary").tap();
    await f.p.locator("#calendar-tasks-tab").click();
    await assertRevealed(f, copy.id);
    check(await f.p.evaluate(({ id, template }) => store.listItems().some(t => t.id === id && !t.dueDate && !t.scheduledStart) && store.listTemplates().some(t => t.id === template), { id: copy.id, template: f.template.id }), "Copy/template lost after reload");
    cases.push({ test: "Add-reveals-independent-unscheduled-copy-editor-and-reload", mode: f.mode, width: f.width, touch: f.touch, theme: f.theme, status: "PASS", taskId: copy.id, sourceTemplateId: f.template.id, progress: result.progress, form });
    const previous = f.p.locator(`#backlog-task-list .task-select[data-edit-task="${f.existingCopy.id}"]`);
    check(await previous.isVisible(), "Previously saved undated copy is still hidden");
    check(await f.p.locator(`#backlog-task-list .task-select[data-edit-task="${copy.id}"]`).isVisible(), "New copy not in Unscheduled section");
    cases.push({ test: "new-and-existing-copies-visible-under-Unscheduled-after-reload", mode: f.mode, width: f.width, theme: f.theme, status: "PASS", existingCopyId: f.existingCopy.id });
    if (!f.touch) await dragNewTask(f, copy);
  }
  async function dragNewTask(f, copy) {
    await f.p.locator('[data-calendar-view="day"]').click();
    const row = f.p.locator(`#backlog-task-list .task-select[data-edit-task="${copy.id}"]`);
    await row.scrollIntoViewIfNeeded(); const source = await row.boundingBox();
    await f.p.mouse.move(source.x + source.width * .4, source.y + Math.min(18, source.height * .4)); await f.p.mouse.down();
    await f.p.mouse.move(source.x + source.width * .4 + 12, source.y + Math.min(18, source.height * .4) + 6, { steps: 6 });
    await wait(f.p, () => document.querySelectorAll(".template-drop-preview").length === 1);
    await f.p.evaluate(() => { calendarUserScrolled = true; document.querySelector("#planner-calendar").scrollTop = 8 * 62; });
    const target = await f.p.locator('.calendar-slot[data-slot-date="2026-11-14"][data-slot-time="09:00"]').boundingBox();
    await f.p.mouse.move(target.x + target.width / 2, target.y + 3, { steps: 12 }); await f.p.mouse.move(target.x + target.width / 2, target.y + 3);
    await wait(f.p, () => document.querySelector(".template-drop-preview")?.dataset.dragPlacement === "timeline");
    await f.p.mouse.up();
    await wait(f.p, () => document.querySelector(".toast").classList.contains("show") && /Scheduled/.test(document.querySelector("#toast-message").textContent));
    const saved = await f.p.evaluate(id => store.listItems().find(t => t.id === id), copy.id);
    check(saved.scheduledStart === "2026-11-14T09:00" && !saved.dueDate && !saved.dueTime && saved.notes === copy.notes && saved.durationMinutes === 45, "Backlog drag changed identity/deadline/settings");
    check(await f.p.locator(`#backlog-task-list .task-select[data-edit-task="${copy.id}"]`).count() === 0 && await f.p.locator(`#scheduled-task-list .task-select[data-edit-task="${copy.id}"]`).count() === 1, "Scheduled copy remains in Unscheduled or missing from Scheduled");
    await f.p.getByRole("button", { name: "Undo", exact: true }).click();
    await wait(f.p, id => store.listItems().some(t => t.id === id && !t.scheduledStart && !t.dueDate) && /undone/.test(document.querySelector("#toast-message").textContent), copy.id);
    check(await f.p.locator(`#backlog-task-list .task-select[data-edit-task="${copy.id}"]`).count() === 1 && await f.p.locator(`#scheduled-task-list .task-select[data-edit-task="${copy.id}"]`).count() === 0, "Undo did not return copy to Unscheduled exactly once");
    await f.p.reload(); await wait(f.p, id => typeof store !== "undefined" && store.listItems().some(t => t.id === id && !t.scheduledStart && !t.dueDate), copy.id);
    const restored = await f.p.evaluate(id => store.listItems().find(t => t.id === id), copy.id);
    for (const name of ["id", "title", "classId", "durationMinutes", "priority", "notes", "reminderChoice", "dueDate", "dueTime"]) check(restored[name] === copy[name], "Drag Undo changed " + name);
    cases.push({ test: "trusted-backlog-drag-to-Scheduled-Undo-to-Unscheduled-and-reload", mode: f.mode, width: f.width, theme: f.theme, status: "PASS", taskId: copy.id, scheduledStartBeforeUndo: saved.scheduledStart, scheduledStartAfterUndo: restored.scheduledStart });
  }
  try {
    for (const origin of ["http://127.0.0.1:8034", "http://127.0.0.1:8796"]) {
      stage = origin + " desktop visible copy"; const f = await setup(origin); try { await functional(f); } finally { await close(f); }
    }
    for (const width of [390, 768]) {
      stage = width + " touch visible copy"; const f = await setup("http://127.0.0.1:8034", width, true); try { await functional(f); } finally { await close(f); }
    }
    stage = "dark desktop visible copy"; const dark = await setup("http://127.0.0.1:8034", 835, false, "dark"); try { await functional(dark); } finally { await close(dark); }
    return { runtime: browser.version(), cases, errors, failed, allSyntheticContextsClosed: contexts.size === 0, scope: "Local browser storage and real signed-in local Worker; touch emulation is not physical Safari, installed PWA or native acceptance." };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, diagnostic, cases, errors, failed }; }
  finally { for (const context of contexts) await context.close(); }
}
