async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [
    { port: 8043, view: "calendar", width: 1156, original: true },
    { port: 8042, view: "calendar", width: 1156 },
    { port: 8042, view: "tasks", width: 390 },
    { port: 8042, view: "calendar", width: 390 },
    { port: 8042, view: "home", width: 835 },
    { port: 8042, view: "calendar", width: 390, reduced: true }
  ]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 1000 }, serviceWorkers: "block", reducedMotion: config.reduced ? "reduce" : "no-preference" });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", e => errors.push(e.message));
      await p.goto(`http://127.0.0.1:${config.port}/?demo=completion-20261122-4#${config.view}`);
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length > 0);
      await p.evaluate(async () => {
        const date = Model.todayKey();
        await store.upsertItem({ id: "opening-fixture", title: "Finish calculus practice set", classId: "calculus", dueDate: date, dueTime: "23:59", scheduledStart: date + "T09:00", durationMinutes: 45, completed: false, schemaVersion: 2 });
      });
      await p.waitForTimeout(600);
      const area = config.view === "tasks" ? "#view-tasks" : config.view === "home" ? "#view-home" : "#daily-task-panel";
      const input = p.locator(area + ' input[data-task-id="opening-fixture"]:visible');
      await input.scrollIntoViewIfNeeded();
      await p.evaluate(({ area, original }) => {
        const card = document.querySelector(area + ' input[data-task-id="opening-fixture"]').closest(".daily-task-card,.all-task-row,.matrix-task-card");
        const summary = e => { const s = getComputedStyle(e), b = e.getBoundingClientRect(); return { width: b.width, height: b.height, font: s.fontSize, lineHeight: s.lineHeight, grid: s.gridTemplateColumns }; };
        window.openingSource = summary(card); window.openingEcho = null; window.openingFrames = [];
        document.addEventListener("change", () => {
          const start = performance.now();
          const frame = () => {
            const e = document.querySelector(".task-completion-echo"), s = e && getComputedStyle(e);
            if (e && !openingEcho) {
              const animation = e.getAnimations().find(a => a.animationName === "task-finish");
              const elapsed = animation.currentTime;
              const samples = [0, 75, 150.5, 250, 420].map(time => {
                animation.currentTime = time;
                const style = getComputedStyle(e), matrix = new DOMMatrix(style.transform);
                return { time, scale: matrix.a, y: matrix.f, opacity: Number(style.opacity) };
              });
              animation.currentTime = elapsed;
              const rect = e.getBoundingClientRect();
              openingEcho = { ...summary(e), title: summary(e.querySelector(".task-title")), samples,
                dateIcons: e.querySelectorAll(".task-date-icon").length,
                fits: rect.left >= 7 && rect.right <= innerWidth - 7 && rect.top >= 14 && rect.bottom <= innerHeight - 14,
                contentFits: e.scrollHeight <= e.clientHeight + 1,
                keyframes: animation.effect.getKeyframes() };
            }
            openingFrames.push({ time: performance.now() - start, echo: Boolean(e), opacity: s ? Number(s.opacity) : null, scale: s ? new DOMMatrix(s.transform).a : null, sourceHeld: card.isConnected, duck: Boolean(document.querySelector(".completion-duck-reaction")) });
            if (performance.now() - start < 2300) requestAnimationFrame(frame);
          }; requestAnimationFrame(frame);
        }, { once: true });
      }, { area, original: config.original });
      await input.focus(); await input.press("Space");
      await p.waitForTimeout(2450);
      const state = await p.evaluate(area => ({ source: openingSource, echo: openingEcho, frames: openingFrames, completed: store.listItems().some(t => t.id === "opening-fixture" && t.completed), visible: [...document.querySelectorAll(area + ' input[data-task-id="opening-fixture"]')].some(e => e.checkVisibility()), artifacts: document.querySelectorAll(".task-completion-echo,.completion-exit-source,.completion-duck-reaction").length }), area);
      if (!state.completed || state.artifacts || errors.length) throw Error("Completion/cleanup failed " + JSON.stringify({ config, errors }));
      if (!config.original) {
        if (state.visible) throw Error("Task remained active");
        if (!config.reduced) {
          const e = state.echo, samples = e.samples;
          if (Math.abs(samples[2].scale / samples[0].scale - 1.012) > .0001) throw Error("Original opening scale mismatch");
          if (Math.abs(samples[3].scale - samples[2].scale) > .0001 || Math.abs(samples[4].scale - samples[2].scale) > .0001) throw Error("Ending must fade without shrinking");
          if (samples[4].opacity > .01 || e.dateIcons || !e.fits || !e.contentFits) throw Error("Echo fit/icons/fade regression " + JSON.stringify(e));
          if (!state.frames.some(f => f.echo) || state.frames.some(f => f.echo && !f.sourceHeld) || !state.frames.some(f => f.duck)) throw Error("Render hold or duck regression");
        } else if (state.echo) throw Error("Reduced motion must skip echo");
        await p.reload(); await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().some(t => t.id === "opening-fixture" && t.completed));
      }
      results.push({ config, status: "PASS", ...state, frames: state.frames.filter((f, i) => i < 3 || i % 8 === 0) });
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), results };
}
