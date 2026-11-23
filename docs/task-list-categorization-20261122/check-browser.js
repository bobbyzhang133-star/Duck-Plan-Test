async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [{ width: 1280, view: "tasks" }, { width: 390, view: "tasks" }, { width: 320, view: "tasks" }, { width: 1280, view: "calendar" }, { width: 835, view: "calendar" }, { width: 390, view: "calendar" }]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 1000 }, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", e => errors.push(e.message));
      await p.goto("http://127.0.0.1:8042/?demo=completion-20261122-11#" + config.view);
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length === 8);
      await p.waitForTimeout(500);
      if (config.view === "tasks") {
        await p.evaluate(async () => {
          const today = Model.todayKey();
          await store.upsertItem({ id: "category-work-today-future-due", title: "Review the group project outline and prepare detailed questions for our next class", classId: "physics", dueDate: Model.addDays(today, 3), dueTime: "23:59", scheduledStart: today + "T16:00", durationMinutes: 45, priority: "High", completed: false, schemaVersion: 2 });
        });
        const before = await p.evaluate(() => JSON.stringify(store.listItems()));
        for (const mode of ["plan", "class", "priority"]) {
          await p.locator("#task-grouping").selectOption(mode);
          for (const filter of ["all", "today", "upcoming", "done"]) {
            await p.locator('#view-tasks [data-filter="' + filter + '"]').click();
            const state = await p.evaluate(filter => {
              const today = Model.todayKey();
              const expected = store.listItems().filter(t => filter === "done" ? t.completed : !t.completed && (filter === "all" || filter === "today" && (t.dueDate === today || Model.scheduledParts(t)?.date === today) || filter === "upcoming" && (t.dueDate > today || Model.scheduledParts(t)?.date > today))).map(t => t.id).sort();
              const actual = [...document.querySelectorAll("#all-task-list input[data-task-id]")].map(e => e.dataset.taskId).sort();
              const controls = [...document.querySelectorAll("#all-task-list [data-task-group-toggle]")].map(e => ({ count: Number(e.querySelector("strong").textContent), actual: document.getElementById(e.getAttribute("aria-controls")).querySelectorAll("input[data-task-id]").length }));
              return { expected, actual, controls, count: Number(document.querySelector('[data-task-filter-count="' + filter + '"]').textContent) };
            }, filter);
            if (JSON.stringify(state.expected) !== JSON.stringify(state.actual) || new Set(state.actual).size !== state.actual.length || state.count !== state.actual.length || state.controls.some(g => g.count !== g.actual)) throw Error("Wrong membership/counts " + JSON.stringify({ config, mode, filter, state }));
          }
        }
        await p.locator('#view-tasks [data-filter="all"]').click();
        const disclosure = p.locator("#all-task-list [data-task-group-toggle]").first();
        const controls = await disclosure.getAttribute("aria-controls");
        await disclosure.focus(); await disclosure.press("Space");
        if (!await p.locator("#" + controls).evaluate(e => e.hidden)) throw Error("Group did not collapse");
        await disclosure.press("Enter");
        if (await p.locator("#" + controls).evaluate(e => e.hidden)) throw Error("Group did not expand");
        if (before !== await p.evaluate(() => JSON.stringify(store.listItems()))) throw Error("View controls mutated tasks");
        await p.locator("#task-grouping").selectOption("plan");
        await p.locator('#view-tasks button.task-select[data-edit-task="completion-20261122-11-1"]').click();
        await p.waitForSelector("#task-modal[open]");
        await p.locator('#task-form input[name="title"]').fill("Sample: Calculus categories checked");
        await p.locator('#task-form button[type="submit"]').click();
        await p.waitForFunction(() => store.listItems().find(t => t.id === "completion-20261122-11-1")?.title === "Sample: Calculus categories checked");
        await p.waitForTimeout(300);
        const checkbox = p.locator('#view-tasks input[data-task-id="completion-20261122-11-1"]');
        await checkbox.scrollIntoViewIfNeeded(); await checkbox.focus(); await checkbox.press("Space");
        await p.waitForTimeout(2600);
        if (await p.locator('#all-task-list input[data-task-id="completion-20261122-11-1"]').count()) throw Error("Completed task remained active");
        await p.locator('#view-tasks [data-filter="done"]').click();
        const undo = p.locator('#all-task-list input[data-task-id="completion-20261122-11-1"]');
        await undo.focus(); await undo.press("Space");
        await p.waitForFunction(() => !store.listItems().find(t => t.id === "completion-20261122-11-1").completed);
        await p.locator('#view-tasks [data-filter="all"]').click();
        await p.reload(); await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().find(t => t.id === "completion-20261122-11-1")?.title === "Sample: Calculus categories checked");
      } else {
        const groups = await p.evaluate(() => Model.groupForDate(store.listItems(), selectedDate, nowKey()));
        for (const name of ["overdue", "scheduled", "backlog", "unscheduled"]) {
          const button = p.locator('#daily-task-panel [data-collapse="' + name + '"]');
          const controls = await button.getAttribute("aria-controls");
          if (await p.locator("#" + controls + " input[data-task-id]").count() !== groups[name].length) throw Error("Calendar count mismatch");
          await button.scrollIntoViewIfNeeded(); await button.focus(); await button.press("Space");
          if (!await p.locator("#" + controls).evaluate(e => e.hidden)) throw Error("Calendar disclosure did not collapse");
          await p.locator('#daily-task-panel [data-collapse="' + name + '"]').press("Enter");
          if (await p.locator("#" + controls).evaluate(e => e.hidden)) throw Error("Calendar disclosure did not expand");
        }
      }
      const bounds = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, controls: [...document.querySelectorAll('#view-tasks .filter-chip,#task-grouping,#daily-task-panel [data-collapse]')].filter(e => e.checkVisibility()).map(e => ({ name: e.getAttribute("aria-label") || e.textContent.trim(), height: e.getBoundingClientRect().height, clipped: e.scrollWidth > e.clientWidth + 1 })) }));
      if (errors.length || bounds.overflow > 1 || bounds.controls.some(e => e.height < 43 || e.clipped)) throw Error("Layout/target issue " + JSON.stringify({ config, errors, bounds }));
      await p.screenshot({ path: "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/task-list-categorization-20261122/verified-" + config.width + "-" + config.view + ".png" });
      results.push({ config, status: "PASS", bounds, errors });
    } catch (error) { return { runtime: browser.version(), results, failed: config, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), results };
}
