// RAF-only smoke: no recording and no per-frame computed-style reads.
async (page) => {
  const browser = page.context().browser(), origin = "http://127.0.0.1:8034", cases = [], contexts = new Set();
  try {
    for (const width of [1280, 835]) for (const variant of ["page", "layered"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" }); contexts.add(context);
      const unexpected = [];
      await context.route("**/*", route => { const u = new URL(route.request().url()); if (u.origin !== origin || u.pathname.startsWith("/api/")) { unexpected.push(u.origin + u.pathname); return route.abort(); } return route.continue(); });
      await context.addInitScript(variant => {
        window.__timingQA = [];
        let api;
        Object.defineProperty(window, "DuckViewTransitions", { configurable: true, get: () => api, set(v) { api = variant === "page" ? { ...v, create: a => v.create.call(v, { ...a, getLayers: () => [] }) } : v; } });
        const native = document.startViewTransition.bind(document);
        document.startViewTransition = update => {
          const start = performance.now(), transition = native(update), call = { start, frames: [], readyElapsed: null, done: false };
          window.__timingQA.push(call);
          transition.finished.then(() => { call.done = true; call.finishedElapsed = performance.now() - start; }, () => { call.done = true; });
          transition.ready.then(() => {
            call.readyElapsed = performance.now() - start;
            const trace = now => { if (call.done || window.__timingQA.at(-1) !== call) return; call.frames.push(now); requestAnimationFrame(trace); };
            requestAnimationFrame(trace);
          }, error => { call.readyError = error.name; });
          return transition;
        };
      }, variant);
      try {
        const p = await context.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
        await p.goto(`${origin}/?qa=layered-raf-${width}-${variant}#calendar`);
        await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length > 0, null, { timeout: 5000 });
        await p.evaluate(async () => { for (let i = 0; i < 24; i++) await store.upsertItem({ id: `raf-${i}`, title: `Isolated extended assignment ${i}: read, draft and review a careful response`, classId: null, type: "task", priority: "Medium", dueDate: "2026-11-15", durationMinutes: 45, completed: false, schemaVersion: 2 }); });
        for (const route of ["tasks", "calendar", "settings", "home"]) {
          await p.locator(`.sidebar .nav-item[data-view="${route}"]`).click();
          await p.waitForFunction(() => window.__timingQA.at(-1)?.done && !document.documentElement.dataset.pageTransition, null, { timeout: 5000 });
          await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        }
        const traces = await p.evaluate(() => window.__timingQA.map(c => { const gaps = c.frames.slice(1).map((t, i) => t - c.frames[i]); return { frames: c.frames.length, readyElapsed: c.readyElapsed, finishedElapsed: c.finishedElapsed, readyError: c.readyError, minGap: Math.min(...gaps), maxGap: Math.max(...gaps), medianGap: [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] }; }));
        if (traces.length !== 4 || traces.some(t => t.readyError || t.frames < 5) || unexpected.length) throw new Error("RAF smoke failed");
        cases.push({ width, variant, routes: ["tasks", "calendar", "settings", "home"], traces, unexpected });
      } finally { await context.close(); contexts.delete(context); }
    }
    return { runtime: browser.version(), measurement: "Synthetic Chromium RAF timestamps in each own ready→finished interval. No recording, no style reads per frame; capture ready cost reported separately. Not a device benchmark.", cases, allSyntheticContextsClosed: true };
  } finally { for (const context of contexts) await context.close(); }
}
