async (page) => {
  const results = [];
  const browser = page.context().browser();
  const root = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/completion-feedback-cleanup-20261120/";
  const assert = (value, message) => { if (!value) throw new Error(message); };
  for (const config of [
    { width: 1280, height: 900 }, { width: 835, height: 1112 },
    { width: 390, height: 844 }, { width: 320, height: 740 },
    { width: 390, height: 844, dark: true },
    { width: 390, height: 844, reducedMotion: "reduce" },
    { width: 390, height: 844, motionOff: true },
    { width: 835, height: 1112, matrix: true }
  ]) {
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, reducedMotion: config.reducedMotion || "no-preference" });
    try {
      const p = await context.newPage();
      const errors = [];
      p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8034/#tasks");
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length);
      await p.evaluate(config => {
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
          { id: "feedback-overdue", title: "Finish the overdue reading response", dueDate: "2020-01-01", dueTime: "12:00", priority: "Medium", completed: false, schemaVersion: 2 },
          { id: "feedback-future", title: "Prepare tomorrow's practice questions", dueDate: "2099-01-01", dueTime: "12:00", priority: "Medium", completed: false, schemaVersion: 2 }
        ]));
        if (config.motionOff) localStorage.setItem("duckplan-ui-mascot-motion", "off");
      }, config);
      await p.reload();
      await p.waitForFunction(() => store.listItems().some(task => task.id === "feedback-overdue"));
      if (config.dark) await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      if (config.matrix) {
        await p.locator('[data-task-layout="matrix"]').click();
        const unclassified = p.locator(".matrix-unclassified");
        if (!(await unclassified.evaluate(element => element.open))) await unclassified.locator("summary").first().click();
      }
      for (const id of ["feedback-overdue", "feedback-future"]) {
        const checkbox = p.locator('#view-tasks input[data-task-id="' + id + '"]:visible');
        const before = await checkbox.evaluate(input => ({
          checked: input.checked,
          dateIcons: input.closest(".all-task-row,.matrix-task-card").querySelectorAll(".task-date-icon").length
        }));
        assert(!before.checked, "Fixture must start incomplete");
        if (id === "feedback-future" && !config.matrix) await checkbox.focus();
        if (id === "feedback-future" && !config.matrix) await checkbox.press("Space"); else await checkbox.click();
        await p.waitForTimeout(90);
        const during = await p.evaluate(() => {
          const echo = document.querySelector(".task-completion-echo");
          const icon = echo?.querySelector("svg")?.getBoundingClientRect();
          return {
            echo: Boolean(echo),
            icons: echo?.querySelectorAll("svg").length || 0,
            oldIcons: echo?.querySelectorAll(".task-date-icon").length || 0,
            controls: echo?.querySelectorAll("input,button,[id]").length || 0,
            inert: echo?.inert, hidden: echo?.getAttribute("aria-hidden"),
            title: echo?.querySelector("strong")?.textContent,
            caption: echo?.querySelector(".completion-echo-copy > span")?.textContent,
            icon: icon ? { width: icon.width, height: icon.height } : null,
            overflow: document.documentElement.scrollWidth > innerWidth,
            focusedTask: document.activeElement?.dataset.taskId
          };
        });
        if (config.reducedMotion || config.motionOff) assert(!during.echo, "Motion-disabled completion must have no echo");
        else {
          assert(during.echo && during.icons === 1 && !during.oldIcons && !during.controls, "Completion has one check and no cloned date icons/controls");
          assert(during.inert && during.hidden === "true", "Decorative completion must be inert and hidden");
          assert(during.icon.width <= 25 && during.icon.height <= 25, "Check icon must remain bounded");
          assert(during.caption === (id === "feedback-overdue" ? "Overdue task completed" : "Completed"), "Caption must reflect the original deadline state");
          if (id === "feedback-overdue") await p.screenshot({ path: root + `completion-${config.width}${config.dark ? "-dark" : ""}${config.matrix ? "-matrix" : ""}.png` });
        }
        assert(!during.overflow, "Completion must not introduce page overflow");
        await p.waitForTimeout(1000);
        const after = await p.evaluate(id => ({
          completed: store.listItems().find(task => task.id === id)?.completed,
          echoes: document.querySelectorAll(".task-completion-echo").length,
          particles: document.querySelectorAll(".completion-particle").length
        }), id);
        assert(after.completed && !after.echoes && !after.particles, "Completion must persist and clean up effects");
        results.push({ config, id, before, during, after, errors: [...errors] });
      }
      await p.reload();
      await p.waitForFunction(() => store.listItems().filter(task => task.id.startsWith("feedback-") && task.completed).length === 2);
      assert(!errors.length, "Completion should not produce page errors");
      await p.waitForTimeout(500);
      assert(await p.locator(".task-completion-echo").count() === 0, "Reload should not replay completion");
    } catch (error) { return { runtime: browser.version(), mode: "isolated local", results, failedConfig: config, error: error.message }; }
    finally { await context.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local", results };
}
