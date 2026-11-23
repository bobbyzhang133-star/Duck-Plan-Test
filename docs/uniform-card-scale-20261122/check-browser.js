async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [{ width: 1156, view: "calendar" }, { width: 390, view: "tasks" }, { width: 390, view: "calendar" }, { width: 835, view: "home" }]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 1000 }, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", e => errors.push(e.message));
      await p.goto("http://127.0.0.1:8042/?demo=completion-20261122-5#" + config.view);
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length === 8);
      await p.waitForTimeout(500);
      const area = config.view === "calendar" ? "#daily-task-panel" : config.view === "tasks" ? "#view-tasks" : "#view-home";
      const input = p.locator(area + ' input[data-task-id="completion-20261122-5-1"]:visible');
      await input.scrollIntoViewIfNeeded();
      await p.evaluate(area => {
        const card = document.querySelector(area + ' input[data-task-id="completion-20261122-5-1"]').closest(".daily-task-card,.all-task-row");
        const describe = (element, scale = 1) => {
          const box = element.getBoundingClientRect(), style = getComputedStyle(element);
          const nodes = [...element.querySelectorAll(".task-title,.task-select,.task-meta,.task-date-stack,.task-date-line,.task-date-label,.task-date-value")];
          return { width: box.width / scale, height: box.height / scale, grid: style.gridTemplateColumns, nodes: nodes.map(node => {
            const r = node.getBoundingClientRect(), s = getComputedStyle(node), range = document.createRange(); range.selectNodeContents(node);
            return { cls: node.className, x: (r.left - box.left) / scale, y: (r.top - box.top) / scale, width: r.width / scale, height: r.height / scale, font: s.fontSize, lineHeight: s.lineHeight, textRects: range.getClientRects().length };
          }) };
        };
        window.uniformSource = describe(card); window.uniformEcho = null; window.uniformFrames = [];
        document.addEventListener("change", () => {
          const start = performance.now();
          const frame = () => {
            const e = document.querySelector(".task-completion-echo"), s = e && getComputedStyle(e);
            if (e && !uniformEcho) {
              const a = e.getAnimations().find(a => a.animationName === "task-finish"), time = a.currentTime;
              const samples = [0, 75, 150.5, 250, 420].map(t => { a.currentTime = t; const style = getComputedStyle(e); return { time: t, scale: new DOMMatrix(style.transform).a, opacity: Number(style.opacity) }; });
              a.currentTime = time;
              const scale = new DOMMatrix(getComputedStyle(e).transform).a;
              uniformEcho = { ...describe(e, scale), samples, icons: e.querySelectorAll(".task-date-icon").length };
            }
            uniformFrames.push({ time: performance.now() - start, echo: Boolean(e), sourceHeld: card.isConnected, duck: Boolean(document.querySelector(".completion-duck-reaction")) });
            if (performance.now() - start < 2250) requestAnimationFrame(frame);
          }; requestAnimationFrame(frame);
        }, { once: true });
      }, area);
      await input.focus(); await input.press("Space"); await p.waitForTimeout(2400);
      const state = await p.evaluate(area => ({ source: uniformSource, echo: uniformEcho, frames: uniformFrames, completed: store.listItems().some(t => t.id === "completion-20261122-5-1" && t.completed), visible: [...document.querySelectorAll(area + ' input[data-task-id="completion-20261122-5-1"]')].some(e => e.checkVisibility()), artifacts: document.querySelectorAll(".task-completion-echo,.completion-exit-source,.completion-duck-reaction").length }), area);
      const source = state.source, echo = state.echo;
      if (!echo || errors.length || !state.completed || state.visible || state.artifacts) throw Error("Completion failed " + JSON.stringify({ config, errors, state }));
      const tracks = source.grid.split(" "), copiedTracks = echo.grid.split(" ");
      if (source.nodes.length !== echo.nodes.length || tracks.length !== copiedTracks.length || tracks.some((track, i) => Math.abs(parseFloat(track) - parseFloat(copiedTracks[i])) > .05)) throw Error("Grid or content changed " + JSON.stringify({ config, source, echo }));
      for (const [i, original] of source.nodes.entries()) {
        const copy = echo.nodes[i];
        for (const key of ["x", "y", "width", "height"]) if (Math.abs(original[key] - copy[key]) > .15) throw Error("Formatting changed: " + JSON.stringify({ config, key, original, copy }));
        for (const key of ["font", "lineHeight", "textRects"]) if (original[key] !== copy[key]) throw Error("Text wrapping changed " + JSON.stringify({ config, original, copy }));
      }
      if (Math.abs(source.width - echo.width) > .15 || Math.abs(source.height - echo.height) > .15 || echo.icons) throw Error("Card proportions or date-icon regression");
      const samples = echo.samples;
      if (samples[0].scale <= 1 || Math.abs(samples[2].scale / samples[0].scale - 1.012) > .0001 || samples[2].scale !== samples[4].scale || samples[4].opacity > .01) throw Error("Opening or ending regression");
      if (state.frames.some(f => f.echo && !f.sourceHeld) || !state.frames.some(f => f.duck)) throw Error("Render hold or duck regression");
      await p.reload(); await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().some(t => t.id === "completion-20261122-5-1" && t.completed));
      results.push({ config, status: "PASS", ...state, frames: state.frames.filter((f, i) => i < 3 || i % 8 === 0) });
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), results };
}
