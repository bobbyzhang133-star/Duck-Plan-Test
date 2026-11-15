// Small disposable fixture for a readable proof image; functional stress evidence is separate.
async (page) => {
  const browser = page.context().browser(), origin = "http://127.0.0.1:8034";
  const context = await browser.newContext({ viewport: { width: 835, height: 746 }, timezoneId: "America/Los_Angeles", reducedMotion: "reduce", serviceWorkers: "block" });
  try {
    await context.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    const p = await context.newPage(); p.setDefaultTimeout(6000);
    await p.goto(origin + "/?qa=template-add-proof#calendar");
    await p.waitForFunction(() => typeof store !== "undefined" && store.mode === "local" && store.listItems().length > 0);
    const fixture = await p.evaluate(async () => {
      for (const task of store.listItems()) await store.deleteItem(task.id);
      const template = await store.upsertTemplate({ id: crypto.randomUUID(), title: "BC Calculus", classId: "personal", durationMinutes: 45, priority: "Medium", notes: "Reusable calculus practice", reminderChoice: "off" });
      selectedDate = "2026-11-14"; calendarView = "week"; calendarUserScrolled = true; setView("calendar", true); renderAll({ autoScrollCalendar: false });
      return { template };
    });
    await p.locator("#calendar-templates-tab").click();
    await p.getByRole("button", { name: "Add BC Calculus to tasks", exact: true }).click();
    await p.waitForFunction(() => document.querySelector("#calendar-tasks-tab").getAttribute("aria-selected") === "true" && document.querySelector("#backlog-task-list .task-select") && /Added/.test(document.querySelector("#toast-message").textContent));
    await p.waitForFunction(() => !document.querySelector('#calendar-templates-tab.interaction-released,#calendar-templates-tab.interaction-pressed'));
    const source = await p.locator("#backlog-task-list .task-select").evaluate(e => ({ text: e.textContent, box: e.getBoundingClientRect().toJSON(), heading: e.closest(".task-section").querySelector(".task-section-heading").textContent }));
    await p.screenshot({ path: "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/template-add-visibility/local-835-proof.png" });
    return { runtime: browser.version(), purpose: "Proof image only; no additional functional pass claimed", source, fixtureTemplateId: fixture.template.id };
  } finally { await context.close(); }
}
