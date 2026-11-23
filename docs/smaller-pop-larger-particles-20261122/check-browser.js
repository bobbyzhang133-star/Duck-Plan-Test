async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [{ width: 1156 }, { width: 390 }, { width: 1156, last: true }, { width: 390, reduced: true }]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 1000 }, serviceWorkers: "block", reducedMotion: config.reduced ? "reduce" : "no-preference" });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", e => errors.push(e.message));
      await p.goto("http://127.0.0.1:8042/?demo=completion-20261122-8#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length === 8);
      if (config.last) await p.evaluate(async () => { for (const t of store.listItems()) if (t.id !== "completion-20261122-8-1") await store.toggleComplete(t.id, true); });
      await p.waitForTimeout(500);
      const input = p.locator('#daily-task-panel input[data-task-id="completion-20261122-8-1"]:visible');
      await input.scrollIntoViewIfNeeded();
      await p.evaluate(() => {
        window.particleSample = null; window.particleFrames = [];
        document.addEventListener("change", () => {
          const particles = [...document.querySelectorAll(".completion-particle")], echo = document.querySelector(".task-completion-echo"), style = echo && getComputedStyle(echo);
          particleSample = { count: particles.length, scale: style ? Number(style.getPropertyValue("--completion-base-scale")) : null,
            particles: particles.map(e => { const s = getComputedStyle(e); return { width: parseFloat(s.width), height: parseFloat(s.height), x: parseFloat(s.getPropertyValue("--particle-x")), y: parseFloat(s.getPropertyValue("--particle-y")) }; }) };
          const start = performance.now(), frame = () => { particleFrames.push({ time: performance.now() - start, echo: Boolean(document.querySelector(".task-completion-echo")), duck: Boolean(document.querySelector(".completion-duck-reaction")), slides: document.getAnimations().filter(a => a.effect?.getKeyframes().some(k => String(k.transform).startsWith("translate("))).length }); if (performance.now() - start < 2000) requestAnimationFrame(frame); }; requestAnimationFrame(frame);
        }, { once: true });
      });
      await input.focus(); await input.press("Space"); await p.waitForTimeout(2600);
      const state = await p.evaluate(() => ({ sample: particleSample, frames: particleFrames, completed: store.listItems().some(t => t.id === "completion-20261122-8-1" && t.completed), artifacts: document.querySelectorAll(".task-completion-echo,.completion-particle,.completion-duck-reaction").length }));
      if (!state.completed || state.artifacts || errors.length) throw Error("Completion or cleanup failed");
      if (config.reduced) { if (state.sample.count || state.sample.scale) throw Error("Reduced motion must suppress effects"); }
      else {
        const sample = state.sample;
        if (sample.count !== (config.last ? 30 : 16) || sample.scale <= 1 || sample.scale > 1.45) throw Error("Pop size or particle count mismatch");
        if (!sample.particles.some(e => e.width === 9 && e.height === 13) || !sample.particles.some(e => e.width === 8 && e.height === 8)) throw Error("Particle size mismatch");
        if (sample.particles.some(e => Math.hypot(e.x, e.y + 40) < (config.last ? 118 : 70) - .01)) throw Error("Particle spread too small");
        if (!state.frames.some(f => f.duck) || (!config.last && !state.frames.some(f => !f.echo && f.slides > 0))) throw Error("Duck or after-fade slide regression");
      }
      results.push({ config, status: "PASS", ...state, frames: state.frames.filter((f, i) => i % 10 === 0) });
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), results };
}
