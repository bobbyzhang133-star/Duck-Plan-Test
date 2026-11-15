// Disposable browser context only. Never reads or edits the user's current planner.
async (page) => {
  const browser = page.context().browser();
  const origin = "http://127.0.0.1:8034";
  const context = await browser.newContext({ viewport: { width: 835, height: 746 }, timezoneId: "America/Los_Angeles", reducedMotion: "reduce", serviceWorkers: "block" });
  const errors = [];
  let stage = "setup";
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  try {
    await context.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    const p = await context.newPage(); p.setDefaultTimeout(6000);
    p.on("pageerror", e => errors.push(e.message));
    await p.goto(origin + "/?qa=template-add-baseline#calendar");
    await p.waitForFunction(() => typeof store !== "undefined" && store.mode === "local" && store.listItems().length > 0);
    const fixture = await p.evaluate(async () => {
      const template = await store.upsertTemplate({ id: crypto.randomUUID(), title: "BC Calculus visibility QA", classId: "personal", durationMinutes: 45, priority: "Medium", notes: "Keep these reusable notes", reminderChoice: "off" });
      selectedDate = "2026-11-14"; calendarView = "week"; calendarUserScrolled = true;
      setView("calendar", true); renderAll({ autoScrollCalendar: false });
      return { template, ids: store.listItems().map(t => t.id) };
    });
    await p.locator("#calendar-templates-tab").click();
    stage = "trusted Add to tasks click";
    await p.getByRole("button", { name: "Add BC Calculus visibility QA to tasks", exact: true }).click();
    await p.waitForFunction(() => /Added a new task/.test(document.querySelector("#toast-message").textContent));
    const result = await p.evaluate(({ ids, template }) => {
      const copies = store.listItems().filter(t => !ids.includes(t.id));
      const copy = copies[0];
      const groups = Model.groupForDate(store.listItems(), selectedDate, nowKey());
      return {
        copyCount: copies.length, copy,
        selectedTab: calendarLibraryTabs.selected,
        calendarGroupCount: Object.values(groups).flat().filter(t => t.id === copy?.id).length,
        sourceTemplate: store.listTemplates().find(t => t.id === template.id),
        toast: document.querySelector("#toast-message").textContent,
      };
    }, fixture);
    check(result.copyCount === 1 && result.copy && !result.copy.scheduledStart && !result.copy.dueDate && !result.copy.dueTime, "Add did not make an independent unscheduled copy");
    check(JSON.stringify(result.sourceTemplate) === JSON.stringify(fixture.template), "Template mutated");
    check(result.selectedTab === "templates" && result.calendarGroupCount === 0, "Baseline hidden-copy behavior not reproduced");
    await p.locator("#calendar-tasks-tab").click();
    result.calendarRowCount = await p.locator(`#daily-task-panel [data-edit-task="${result.copy.id}"]`).count();
    check(result.calendarRowCount === 0, "Copy unexpectedly visible in the selected day's task panel");
    await p.reload();
    await p.waitForFunction(id => typeof store !== "undefined" && store.listItems().some(t => t.id === id), result.copy.id);
    result.reloadPersisted = true;
    result.status = "REPRODUCED";
    return { runtime: browser.version(), mode: "local browser storage / disposable fixture", sourceBase: "75c6914", result, errors, scope: "Trusted click saves successfully, but undated unscheduled copy is absent from Calendar groups. User planner untouched." };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, errors }; }
  finally { await context.close(); }
}
