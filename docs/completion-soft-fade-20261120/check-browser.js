async (page) => {
  const browser = page.context().browser(), results = [];
  for (const config of [{ width: 1156 }, { width: 390 }, { width: 390, dark: true }, { width: 390, reduced: true }]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 900 }, reducedMotion: config.reduced ? "reduce" : "no-preference" });
    try {
      const p = await c.newPage();
      await p.goto("http://127.0.0.1:8034/#tasks");
      await p.waitForFunction(() => document.querySelector("#view-tasks input[data-task-id]"));
      if (config.dark) await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      const id = await p.locator("#view-tasks input[data-task-id]:visible:not(:checked)").first().getAttribute("data-task-id");
      await p.locator('#view-tasks input[data-task-id="' + id + '"]:visible').click();
      const phases = [];
      if (config.reduced) {
        await p.waitForTimeout(80);
        if (await p.locator(".task-completion-echo").count()) throw new Error("Reduced motion created an echo");
      } else {
        for (const time of [0, 150.5, 430, 950, 1440]) {
          const phase = await p.evaluate(async time => {
            const echo = document.querySelector(".task-completion-echo");
            for (const animation of document.getAnimations().filter(a => a.effect?.target === echo || echo.contains(a.effect?.target))) { animation.pause(); animation.currentTime = time; }
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const copy = echo.querySelector(".completion-echo-copy"), duck = echo.querySelector(".completion-echo-duck");
            return { time, cardOpacity: Number(getComputedStyle(copy).opacity), groupOpacity: Number(getComputedStyle(echo).opacity), duckOpacity: Number(getComputedStyle(duck).opacity), fullDuck: Boolean(duck.querySelector(".duck-feet") && duck.querySelector(".duck-thumbs-up-wing")), overflow: document.documentElement.scrollWidth > innerWidth };
          }, time);
          if (phase.overflow || !phase.fullDuck) throw new Error("Completion layout changed");
          phases.push(phase);
          if (time === 950) await p.screenshot({ path: `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/completion-soft-fade-20261120/soft-fade-${config.width}${config.dark ? "-dark" : ""}.png` });
        }
        const close = (a, b) => Math.abs(a - b) < .001;
        if (!close(phases[0].cardOpacity, .96) || !close(phases[1].cardOpacity, .9) || !close(phases[2].cardOpacity, .86)) throw new Error("Card does not gently fade during the original pop");
        if (!close(phases[3].cardOpacity, .86) || phases[3].groupOpacity !== 1 || phases[3].duckOpacity !== 1) throw new Error("Task did not hold for duck reveal");
        if (!close(phases[4].cardOpacity, .86) || phases[4].groupOpacity >= 1 || phases[4].duckOpacity !== 1) throw new Error("Task and duck do not share the later fade");
      }
      await p.waitForTimeout(1750);
      if (await p.locator(".task-completion-echo,.completion-particle").count()) throw new Error("Effects did not clean up");
      await p.reload();
      await p.waitForFunction(id => store.listItems().some(t => t.id === id && t.completed), id);
      results.push({ config, phases, completedAfterReload: true, cleanup: true });
    } catch (error) { return { runtime: browser.version(), results, failedConfig: config, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local", results };
}
