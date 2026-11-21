async (page) => {
  const browser = page.context().browser(), results = [];
  const root = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/exact-original-pop-20261121/";
  const assert = (value, message) => { if (!value) throw new Error(message); };
  for (const config of [
    { view: "calendar", width: 1156 }, { view: "calendar", width: 835 }, { view: "calendar", width: 390 },
    { view: "tasks", width: 1156 }, { view: "tasks", width: 390 }, { view: "tasks", width: 320 },
    { view: "home", width: 1156 }, { view: "matrix", width: 835 },
    { view: "tasks", width: 390, dark: true }, { view: "tasks", width: 390, reduced: true }, { view: "tasks", width: 390, motionOff: true }
  ]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 900 }, reducedMotion: config.reduced ? "reduce" : "no-preference" });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8034/#" + (config.view === "matrix" ? "tasks" : config.view));
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length);
      await p.evaluate(config => {
        const date = Model.todayKey();
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
          { id: "void-first", title: "Finish the first practice task", dueDate: date, dueTime: "17:00", scheduledStart: date + "T09:00", durationMinutes: 45, priority: "High", notes: "Preserve these task details", completed: false, schemaVersion: 2 },
          { id: "void-next", title: "Prepare the next practice task", dueDate: date, dueTime: "18:00", scheduledStart: date + "T10:00", durationMinutes: 45, priority: "High", completed: false, schemaVersion: 2 }
        ]));
        if (config.motionOff) localStorage.setItem("duckplan-ui-mascot-motion", "off");
      }, config);
      await p.reload();
      await p.waitForFunction(() => store.listItems().some(task => task.id === "void-first"));
      if (config.dark) await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      if (config.view === "tasks") await p.locator('[data-filter="today"]').click();
      if (config.view === "matrix") {
        await p.locator('[data-task-layout="matrix"]').click();
        const group = p.locator(".matrix-unclassified");
        if (!(await group.evaluate(element => element.open))) await group.locator("summary").first().click();
      }
      if (config.view === "calendar" && config.width === 390) await p.locator("#phone-task-summary").click();
      const area = config.view === "calendar" ? "#daily-task-panel" : config.view === "home" ? "#view-home" : config.view === "matrix" ? "#task-matrix-root" : "#view-tasks";
      const source = p.locator(area + ' input[data-task-id="void-first"]:visible');
      const next = p.locator(area + ' input[data-task-id="void-next"]:visible');
      await source.scrollIntoViewIfNeeded();
      const before = await next.evaluate((input, area) => {
        const row = input.closest(".daily-task-card,.all-task-row,.matrix-task-card").getBoundingClientRect(), root = document.querySelector(area).getBoundingClientRect();
        return { top: row.top - root.top, left: row.left - root.left };
      }, area);
      await source.focus();
      await source.press("Space");
      const samples = [];
      if (!config.reduced && !config.motionOff) {
        for (const delay of [100, 150]) {
          await p.waitForTimeout(delay);
          samples.push(await p.evaluate(({ area, before }) => {
            const next = document.querySelector(area + ' input[data-task-id="void-next"]');
            const echo = document.querySelector(".task-completion-echo"), copy = echo?.querySelector(".completion-exit-card");
            const duck = document.querySelector(".task-completion-gesture");
            const row = next.closest(".daily-task-card,.all-task-row,.matrix-task-card").getBoundingClientRect(), root = document.querySelector(area).getBoundingClientRect();
            return { nextY: row.top - root.top, nextX: row.left - root.left, before,
              sourceHeld: Boolean(document.querySelector(".completion-exit-source")), echo: Boolean(echo),
              sourceCompletedInStore: store.listItems().find(t => t.id === "void-first").completed,
              icons: copy?.querySelectorAll(".task-date-icon").length, duplicateIds: copy?.querySelectorAll("[id]").length,
              checked: copy?.querySelector("input[type=checkbox]")?.checked,
              fullDuck: Boolean(duck?.querySelector(".duck-feet") && duck?.querySelector(".duck-thumbs-up-wing")),
              duckVisible: duck ? Number(getComputedStyle(duck).opacity) : 0,
              scale: echo ? new DOMMatrix(getComputedStyle(echo).transform).a : null,
              overflow: document.documentElement.scrollWidth > innerWidth };
          }, { area, before }));
        }
        assert(samples.every(s => Math.abs(s.nextY - before.top) < 1 && Math.abs(s.nextX - before.left) < 1 && s.sourceHeld && s.echo && s.sourceCompletedInStore), "Save occurs now, but the next task must not move during the exit");
        assert(samples.every(s => s.icons === 0 && s.duplicateIds === 0 && s.checked && s.fullDuck && !s.overflow), "Original task snapshot has a checked box, no date icons/duplicate IDs, and a separate full duck");
        assert(samples[0].duckVisible > 0, "Duck starts with the task pop, without waiting for shrink completion");
        await p.screenshot({ path: root + `exit-${config.view}-${config.width}${config.dark ? "-dark" : ""}.png` });
      }
      await p.waitForTimeout(1200);
      const after = await next.evaluate((input, area) => {
        const row = input.closest(".daily-task-card,.all-task-row,.matrix-task-card").getBoundingClientRect(), root = document.querySelector(area).getBoundingClientRect();
        return { top: row.top - root.top, left: row.left - root.left };
      }, area);
      assert(Math.abs(after.top - before.top) > 10 || Math.abs(after.left - before.left) > 10, "The list closes its gap after the card disappears");
      assert(await p.locator(".task-completion-echo,.task-completion-gesture,.completion-exit-source").count() === 0, "No held rows or visual artifacts remain");
      const focused = await p.evaluate(() => document.activeElement?.dataset.taskId || document.activeElement?.className);
      assert(focused === "void-first" || focused === "void-next" || focused === "matrix-main-heading", "Keyboard focus survives the deferred render");
      await p.reload();
      await p.waitForFunction(() => store.listItems().some(t => t.id === "void-first" && t.completed));
      const task = await p.evaluate(() => store.listItems().find(t => t.id === "void-first"));
      assert(task.notes === "Preserve these task details" && task.durationMinutes === 45 && task.dueTime === "17:00", "Completion must preserve the rest of the task");
      assert(!errors.length, "No page errors");
      results.push({ config, before, samples, after, focused, completedAfterReload: true });
    } catch (error) { return { runtime: browser.version(), results, failedConfig: config, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local", results };
}
