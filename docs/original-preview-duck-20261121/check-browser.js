async (page) => {
  const browser = page.context().browser(), results = [];
  for (const config of [
    { view: "calendar", width: 1156 }, { view: "calendar", width: 835 }, { view: "calendar", width: 390 },
    { view: "tasks", width: 390 }, { view: "tasks", width: 320 }, { view: "tasks", width: 390, dark: true },
    { view: "tasks", width: 390, reduced: true }
  ]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 900 }, reducedMotion: config.reduced ? "reduce" : "no-preference" });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8042/#" + config.view);
      await p.waitForFunction(() => document.querySelector("input[data-task-id]"));
      if (config.dark) await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      if (config.view === "calendar" && config.width === 390) await p.locator("#phone-task-summary").click();
      const area = config.view === "calendar" ? "#daily-task-panel" : "#view-tasks";
      const id = await p.locator(area + " input[data-task-id]:visible:not(:checked)").first().getAttribute("data-task-id");
      const normalIcons = await p.locator(area + " .task-date-icon").count();
      await p.locator(area + ' input[data-task-id="' + id + '"]:visible').click();
      let graphic = null;
      if (!config.reduced) {
        graphic = await p.evaluate(async () => {
          const echo = document.querySelector(".task-completion-echo"), a = echo.getAnimations()[0];
          a.pause(); a.currentTime = 150.5;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const duck = echo.querySelector(".completion-approval-duck"), r = duck.getBoundingClientRect();
          return { name: a.animationName, duration: a.effect.getTiming().duration, easing: getComputedStyle(echo).animationTimingFunction,
            frames: a.effect.getKeyframes().map(f => ({ offset: f.offset, transform: f.transform, opacity: f.opacity })),
            oldIcons: echo.querySelectorAll(".task-date-icon").length, ducks: echo.querySelectorAll(".completion-approval-duck").length,
            fullBody: Boolean(duck.querySelector(".duck-feet") && duck.querySelector(".duck-body") && duck.querySelector(".duck-thumbs-up-wing")),
            wingVisible: getComputedStyle(duck.querySelector(".duck-thumbs-up-wing")).display === "inline",
            width: r.width, height: r.height, inert: echo.inert && echo.getAttribute("aria-hidden") === "true" };
        });
        if (graphic.name !== "task-finish" || graphic.duration !== 430 || graphic.easing !== "ease" || graphic.oldIcons || graphic.ducks !== 1 || !graphic.fullBody || !graphic.wingVisible || !graphic.inert) throw new Error("Original motion or requested duck replacement differs");
        await p.screenshot({ path: `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/original-preview-duck-20261121/duck-${config.view}-${config.width}${config.dark ? "-dark" : ""}.png` });
      }
      await p.waitForTimeout(1100);
      if (await p.locator(".task-completion-echo").count()) throw new Error("Original effect failed to clean up");
      await p.reload();
      await p.waitForFunction(id => store.listItems().some(t => t.id === id && t.completed), id);
      if (!normalIcons || errors.length) throw new Error("Normal task UI or startup failed");
      results.push({ config, normalIcons, graphic, completedAfterReload: true });
    } catch (error) { return { runtime: browser.version(), results, failedConfig: config, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local", results };
}
