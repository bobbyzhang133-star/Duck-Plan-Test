async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [
    { view: "calendar", width: 1156 }, { view: "calendar", width: 835 }, { view: "calendar", width: 390 },
    { view: "tasks", width: 390 }, { view: "tasks", width: 320, today: true }
  ]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 1000 }, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8042/#" + config.view);
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length);
      await p.evaluate(() => {
        const date = Model.todayKey();
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify(["strong-first", "strong-next"].map(id => ({ id, title: "Complete this practice task", dueDate: date, dueTime: "17:00", scheduledStart: date+"T09:00", durationMinutes: 45, completed: false, schemaVersion: 2 }))));
      });
      await p.reload();
      if (config.today) await p.locator('[data-filter="today"]').click();
      if (config.view === "calendar" && config.width === 390) { await p.locator("#phone-task-summary").click(); await p.waitForTimeout(500); }
      const area = config.view === "calendar" ? "#daily-task-panel" : "#view-tasks";
      await p.locator(area + ' input[data-task-id="strong-first"]:visible').click();
      const peak = await p.evaluate(async () => {
        const echo = document.querySelector(".task-completion-echo"), a = echo.getAnimations()[0];
        a.pause(); a.currentTime = 150.5;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const box = echo.getBoundingClientRect(), checkbox = echo.querySelector('input[type="checkbox"]');
        return { scale: new DOMMatrix(getComputedStyle(echo).transform).a, inside: box.left >= 7 && box.right <= innerWidth-7, contentClipped: echo.scrollWidth > echo.clientWidth+1, duration: a.effect.getTiming().duration, checked: checkbox.checked, checkBackground: getComputedStyle(checkbox).backgroundColor, checkboxTransition: getComputedStyle(checkbox).transitionDuration };
      });
      if (!peak.inside || peak.scale < 1.04 || peak.contentClipped || peak.duration !== 430 || !peak.checked || peak.checkBackground === "rgb(255, 255, 255)" || peak.checkboxTransition !== "0s") throw Error("Invalid larger pop/checked appearance: " + JSON.stringify(peak));
      await p.screenshot({ path: `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/stronger-completion-20261121/checked-peak-${config.view}-${config.width}.png` });
      await p.waitForTimeout(2200);
      const state = await p.evaluate(area => ({
        completed: store.listItems().find(t=>t.id==="strong-first").completed,
        rows: [...document.querySelectorAll(area+' input[data-task-id="strong-first"]')].map(e=>({ checked: e.checked, inCompletedGroup: Boolean(e.closest("#completed-task-list")), visible: e.checkVisibility() })),
        echo: Boolean(document.querySelector(".task-completion-echo")), held: Boolean(document.querySelector(".completion-exit-source")), duck: Boolean(document.querySelector(".completion-duck-reaction"))
      }), area);
      if (!state.completed || state.echo || state.held || state.duck || errors.length) throw Error("One-click completion/cleanup failed");
      if (config.view === "calendar" && state.rows.some(r=>!r.inCompletedGroup || !r.checked)) throw Error("Task remained in an unfinished Calendar group");
      if (config.today && state.rows.length) throw Error("Task remained in Today after completion");
      await p.reload();
      await p.waitForFunction(() => store.listItems().some(t=>t.id==="strong-first" && t.completed));
      results.push({ config, peak, state, completedAfterReload: true });
    } catch (error) { return { runtime: browser.version(), results, failedConfig: config, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), results };
}
