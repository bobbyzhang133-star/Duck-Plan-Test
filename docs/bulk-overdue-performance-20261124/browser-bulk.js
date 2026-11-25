// Playwright MCP function. Disposable browser storage/accounts on localhost only.
async (page) => {
  const browser = page.context().browser(), cases = [], origin = "http://127.0.0.1:8788";
  const evidence = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/bulk-overdue-performance-20261124/";
  const assert = (value, message) => { if (!value) throw Error(message); };
  const configs = [
    { name: "phone-small", width: 320, height: 568, touch: true, count: 24 },
    { name: "phone", width: 390, height: 844, touch: true, count: 24 },
    { name: "phone-landscape", width: 844, height: 390, touch: true, count: 24 },
    { name: "ipad", width: 835, height: 1112, touch: true, count: 24 },
    { name: "desktop", width: 1280, height: 900, count: 24 },
    { name: "benchmark100", width: 1280, height: 900, count: 100, reduced: true },
    { name: "benchmark1000", width: 1280, height: 900, count: 1000, reduced: true },
    { name: "benchmark2000", width: 1280, height: 900, count: 2000, reduced: true },
    { name: "phone1000", width: 390, height: 844, touch: true, count: 1000 },
  ];
  for (const config of configs) {
    const c = await browser.newContext({ viewport: { width: config.width, height: config.height }, hasTouch: Boolean(config.touch), isMobile: Boolean(config.touch && config.width < 500), reducedMotion: config.reduced ? "reduce" : "no-preference", serviceWorkers: "block", timezoneId: "America/Los_Angeles" });
    const p = await c.newPage(), result = { ...config, mode: "local browser storage", errors: [] };
    p.on("pageerror", error => result.errors.push(error.message));
    p.setDefaultTimeout(12000);
    try {
      await p.addInitScript(({ count, benchmark }) => {
        if (sessionStorage.getItem("bulk-seeded")) return;
        sessionStorage.setItem("bulk-seeded", "yes");
        const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        const tasks = Array.from({ length: count }, (_, i) => ({ id: "perf-" + i, title: i === 0 && !benchmark ? "A very long overdue task title that should wrap cleanly on a small phone without covering its buttons or the deadline" : "Overdue task " + i, classId: null, type: "task", priority: "Medium", durationMinutes: 45, dueDate: "2026-01-01", dueTime: "12:00", completed: false, schemaVersion: 2, ...(!benchmark && i === 0 ? { scheduledStart: today + "T10:00" } : {}) }));
        if (!benchmark) tasks.push({ id: "future", title: "Keep this future task open", classId: null, type: "task", priority: "Medium", durationMinutes: 45, dueDate: "2027-12-01", dueTime: "12:00", scheduledStart: today + "T11:00", completed: false, schemaVersion: 2 });
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify(tasks));
      }, { count: config.count, benchmark: config.name.startsWith("benchmark") || config.name === "phone1000" });
      await p.goto(origin + "/#calendar", { timeout: 25000 });
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length && workAlertContextReady);
      await p.waitForTimeout(550);
      const phone = await p.evaluate(() => phonePlannerQuery.matches);
      if (phone) { await p.locator("#phone-task-summary").tap(); await p.waitForTimeout(450); }
      const button = p.locator("#overdue-section [data-complete-overdue]");
      await button.scrollIntoViewIfNeeded();
      await p.screenshot({ path: evidence + config.name + "-before.png" });
      await p.evaluate(() => {
        window.bulkMetrics = { writes: 0, bytes: 0, renders: 0, animations: [], longTasks: [] };
        const set = Storage.prototype.setItem, render = window.renderAll, animate = Element.prototype.animate, complete = window.completeAllOverdue;
        Storage.prototype.setItem = function(k,v) { if(k === "duckplan-demo-tasks-v1") { bulkMetrics.writes++; bulkMetrics.bytes += v.length; } return set.call(this,k,v); };
        window.renderAll = (...args) => { bulkMetrics.renders++; return render(...args); };
        Element.prototype.animate = function(frames, options) { bulkMetrics.animations.push({ target: this.id || this.className, duration: options?.duration }); return animate.call(this, frames, options); };
        if (PerformanceObserver.supportedEntryTypes.includes("longtask")) new PerformanceObserver(entries => bulkMetrics.longTasks.push(...entries.getEntries().map(e => e.duration))).observe({ type: "longtask" });
        window.completeAllOverdue = async (...args) => { const start = performance.now(); await complete(...args); bulkMetrics.elapsedMs = performance.now()-start; bulkMetrics.finished = true; };
      });
      if (config.touch) await button.tap();
      else { await button.focus(); await p.keyboard.press("Enter"); }
      await p.waitForFunction(() => bulkMetrics.finished);
      await p.waitForTimeout(60);
      if (!config.reduced) await p.screenshot({ path: evidence + config.name + "-closing.png" });
      const closing = await p.evaluate(() => ({ sections: [...document.querySelectorAll("[data-completion-section-exit]")].map(el => ({ id: el.id, height: el.getBoundingClientRect().height, oldCards: el.querySelectorAll("input[data-task-id]").length, inert: el.inert })) }));
      await p.waitForTimeout(500);
      const state = await p.evaluate(() => ({ metrics: bulkMetrics, completed: store.listItems().filter(t => t.completed).length, savedCompleted: JSON.parse(localStorage.getItem("duckplan-demo-tasks-v1")).filter(t=>t.completed).length, futureOpen: !store.listItems().find(t=>t.id === "future")?.completed, overflow: document.documentElement.scrollWidth > innerWidth+1, exitNodes: document.querySelectorAll("[data-completion-section-exit]").length, echoes: document.querySelectorAll(".completion-exit-source,.completion-card-echo").length, focused: document.activeElement.id }));
      result.result = state; result.closing = closing;
      assert(state.completed === config.count && state.savedCompleted === config.count, "Incomplete bulk persistence");
      assert(state.metrics.writes === 1 && state.metrics.renders === 1, "Per-task save/render regression");
      assert(state.futureOpen && !state.overflow && !state.exitNodes && !state.echoes, "Layout/motion cleanup or scope regression");
      assert(!state.metrics.animations.some(a => /daily-task-card|all-task-row|matrix-task-card|completion-card/.test(a.target)), "Per-card bulk animation");
      await p.screenshot({ path: evidence + config.name + "-after.png" });
      if (config.count === 24) {
        const heading = p.locator('[data-collapse="completed"]');
        await heading.scrollIntoViewIfNeeded();
        if (config.touch) await heading.tap(); else await heading.click();
        await p.waitForTimeout(450);
        assert(await p.locator('#completed-task-list input[data-task-id="perf-0"]').isVisible(), "Completed section did not expand");
        await p.screenshot({ path: evidence + config.name + "-completed-open.png" });
        if (config.touch) await heading.tap(); else await heading.click();
        await p.waitForTimeout(450);
        assert(!await p.locator('#completed-task-list input[data-task-id="perf-0"]').isVisible(), "Completed section did not collapse");
        if (phone) {
          await p.locator(".task-panel-close-button[data-close-task-panel]").tap(); await p.waitForTimeout(450);
          assert(!await p.evaluate(() => document.body.classList.contains("task-panel-open")), "Phone sheet failed to close");
          await p.locator("#phone-task-summary").tap(); await p.waitForTimeout(450);
          assert(await p.evaluate(() => document.body.classList.contains("task-panel-open")), "Phone sheet failed to reopen");
        }
        result.sectionOpenClose = true;
      }
      await p.reload(); await p.waitForFunction(count => typeof store !== "undefined" && store.listItems().filter(t=>t.completed).length === count, config.count);
      assert(!result.errors.length, result.errors.join("; ")); result.passed = true;
    } catch (error) { result.passed = false; result.error = error.message; await p.screenshot({ path: evidence + config.name + "-failure.png" }).catch(()=>{}); }
    finally { await c.close(); }
    cases.push(result);
  }
  return { runtime: browser.version(), origin, cases, passed: cases.every(c=>c.passed), physicalDeviceClaims: false, productionWrites: false };
}
