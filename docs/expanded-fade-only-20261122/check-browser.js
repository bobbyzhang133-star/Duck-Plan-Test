async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [{ width: 1156, view: "calendar" }, { width: 390, view: "tasks" }, { width: 390, view: "calendar", reduced: true }]) {
    const context = await browser.newContext({ viewport: { width: config.width, height: 1000 }, serviceWorkers: "block", reducedMotion: config.reduced ? "reduce" : "no-preference" });
    try {
      const p = await context.newPage(), errors = [];
      p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8042/?demo=completion-20261122-3#" + config.view);
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length === 8);
      await p.waitForTimeout(500);
      const area = config.view === "tasks" ? "#view-tasks" : "#daily-task-panel";
      const source = p.locator(area + ' input[data-task-id="completion-20261122-3-1"]:visible');
      await source.scrollIntoViewIfNeeded();
      await p.evaluate(area => {
        const root = document.querySelector(area);
        const next = () => root.querySelector('input[data-task-id="completion-20261122-3-2"]')?.closest(".daily-task-card,.all-task-row,.matrix-task-card");
        const y = () => next()?.getBoundingClientRect().top - root.getBoundingClientRect().top;
        window.fadeFrames = []; window.fadeBefore = y(); window.fadeStart = null;
        document.addEventListener("change", () => { window.fadeStart = performance.now(); }, { once: true });
        const frame = () => {
          if (fadeStart !== null) {
            const echo = document.querySelector(".task-completion-echo"), style = echo && getComputedStyle(echo);
            fadeFrames.push({ time: performance.now() - fadeStart, y: y(), echo: Boolean(echo), transform: style?.transform, opacity: style ? Number(style.opacity) : null, duck: Boolean(document.querySelector(".completion-duck-reaction")), layoutAnimations: next()?.getAnimations().length || 0 });
            if (performance.now() - fadeStart > 2300) return;
          }
          requestAnimationFrame(frame);
        }; requestAnimationFrame(frame);
      }, area);
      await source.focus(); await source.press("Space");
      await p.waitForTimeout(2450);
      const state = await p.evaluate(area => ({ before: fadeBefore, frames: fadeFrames, completed: store.listItems().find(t => t.id === "completion-20261122-3-1").completed, visible: [...document.querySelectorAll(area + ' input[data-task-id="completion-20261122-3-1"]')].some(e => e.checkVisibility()), artifacts: document.querySelectorAll(".task-completion-echo,.completion-exit-source,.completion-duck-reaction").length }), area);
      if (!state.completed || state.visible || state.artifacts || errors.length) throw Error("Completion/cleanup failed");
      const shown = state.frames.filter(f => f.echo), after = state.frames.filter(f => !f.echo);
      if (!config.reduced) {
        if (shown.length < 5 || shown.some(f => f.transform !== shown[0].transform)) throw Error("Expanded pose must remain fixed throughout fade");
        if (shown[0].opacity - shown.at(-1).opacity < .5) throw Error("Fade did not run");
        if (shown.some(f => Math.abs(f.y - state.before) > 1)) throw Error("List moved before fade ended");
        if (!state.frames.some(f => f.duck)) throw Error("Duck reaction missing");
      } else if (shown.length) throw Error("Reduced motion should skip echo");
      if (after.length < 5 || after.some(f => Math.abs(f.y - after.at(-1).y) > 1 || f.layoutAnimations)) throw Error("List must snap without sliding");
      await p.reload();
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().some(t => t.id === "completion-20261122-3-1" && t.completed));
      results.push({ config, status: "PASS", ...state });
    } finally { await context.close(); }
  }
  return { runtime: browser.version(), results };
}
