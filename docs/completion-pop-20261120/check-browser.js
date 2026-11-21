async (page) => {
  const browser = page.context().browser(), results = [];
  const root = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/completion-pop-20261120/";
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  for (const config of [
    { width: 1280 }, { width: 835 }, { width: 390 }, { width: 320 },
    { width: 390, dark: true }, { width: 390, reduced: true }, { width: 390, motionOff: true }
  ]) {
    const context = await browser.newContext({ viewport: { width: config.width, height: 900 }, reducedMotion: config.reduced ? "reduce" : "no-preference" });
    try {
      const p = await context.newPage(), errors = [];
      p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8034/#tasks");
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length);
      await p.evaluate(config => {
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
          { id: "pop-overdue", title: "Finish the overdue reading response", dueDate: "2020-01-01", dueTime: "12:00", completed: false, schemaVersion: 2 },
          { id: "pop-future", title: "Prepare the next practice questions", dueDate: "2099-01-01", completed: false, schemaVersion: 2 }
        ]));
        if (config.motionOff) localStorage.setItem("duckplan-ui-mascot-motion", "off");
      }, config);
      await p.reload();
      await p.waitForFunction(() => store.listItems().some(task => task.id === "pop-overdue"));
      if (config.dark) await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      for (const id of ["pop-overdue", "pop-future"]) {
        const checkbox = p.locator('#view-tasks input[data-task-id="' + id + '"]:visible');
        await checkbox.click();
        const entry = { config, id, phases: [] };
        if (config.reduced || config.motionOff) {
          await p.waitForTimeout(120);
          assert(await p.locator(".task-completion-echo").count() === 0, "Motion-disabled completion has no echo");
        } else {
          await p.waitForFunction(() => document.querySelector(".task-completion-echo"));
          for (const time of [0, 180, 322, 434, 550]) {
            const phase = await p.evaluate(async time => {
              const echo = document.querySelector(".task-completion-echo");
              const animations = document.getAnimations().filter(animation => echo.contains(animation.effect?.target));
              for (const animation of animations) { animation.pause(); animation.currentTime = time; }
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              const copy = echo.querySelector(".completion-echo-copy"), mark = echo.querySelector(".completion-echo-mark");
              const cardRect = copy.getBoundingClientRect(), markRect = mark.getBoundingClientRect(), echoRect = echo.getBoundingClientRect();
              return {
                time, copyWidth: cardRect.width, copyOpacity: Number(getComputedStyle(copy).opacity),
                markWidth: markRect.width, markOpacity: Number(getComputedStyle(mark).opacity),
                markBase: mark.offsetWidth, checkSize: getComputedStyle(mark.querySelector("svg")).width,
                centerDelta: Math.abs(markRect.left + markRect.width / 2 - echoRect.left - echoRect.width / 2),
                caption: copy.querySelector("span").textContent,
                icons: echo.querySelectorAll("svg").length,
                inert: echo.inert && echo.getAttribute("aria-hidden") === "true",
                overflow: document.documentElement.scrollWidth > innerWidth
              };
            }, time);
            assert(phase.icons === 1 && phase.inert && !phase.overflow, "One decorative check with no page overflow");
            assert(phase.markBase === 72 && phase.checkSize === "44px" && phase.centerDelta < 1, "Large check remains at the card's landing point");
            entry.phases.push(phase);
            if (id === "pop-overdue" && [0, 322].includes(time)) await p.screenshot({ path: root + `pop-${config.width}${config.dark ? "-dark" : ""}-${time}.png` });
          }
          const [start, contracting, arrival, settling, rest] = entry.phases;
          assert(start.copyOpacity === 1 && start.markOpacity === 0, "Task appears before check");
          assert(contracting.copyWidth < start.copyWidth && contracting.copyOpacity < start.copyOpacity, "Task visibly contracts and fades");
          assert(arrival.copyOpacity === 0 && arrival.markOpacity === 1 && arrival.markWidth > 72, "Task disappears into the enlarged check");
          assert(settling.markWidth < 72 && rest.markWidth === 72, "Check overshoots, settles and rests");
          assert(start.caption === (id === "pop-overdue" ? "Overdue task completed" : "Completed"), "Retain deadline-specific caption");
        }
        await p.waitForTimeout(1100);
        assert(await p.locator(".task-completion-echo,.completion-particle").count() === 0, "Effects clean up");
        assert(await p.evaluate(id => store.listItems().find(task => task.id === id)?.completed, id), "Task remains complete");
        results.push(entry);
      }
      await p.reload();
      await p.waitForFunction(() => store.listItems().filter(task => task.id.startsWith("pop-") && task.completed).length === 2);
      assert(await p.locator(".task-completion-echo").count() === 0, "Reload does not replay completion");
      assert(errors.length === 0, "No page errors");
    } catch (error) { return { runtime: browser.version(), results, failedConfig: config, error: error.message }; }
    finally { await context.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local", sampling: "paused rendered WAAPI phases plus live cleanup/persistence", results };
}
