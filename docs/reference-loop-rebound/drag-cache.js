async page => {
  const browser = page.context().browser(), results = [];
  const c = await browser.newContext({ viewport: { width: 1280, height: 950 }, serviceWorkers: "block" });
  try {
    await c.addInitScript(() => { if (!localStorage.getItem("qa-seeded")) {
      localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([{ id: "qa-drag", title: "QA task", classId: null, dueDate: "2026-11-19", dueTime: "18:00", durationMinutes: 60, priority: "Medium", completed: false, schemaVersion: 2 }])); localStorage.setItem("qa-seeded", "yes");
    } });
    const p = await c.newPage(); await p.goto("http://127.0.0.1:8034/?qa=loop-final-drag#calendar");
    await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
    await p.evaluate(() => { selectedDate = "2026-11-19"; calendarView = "day"; renderAll({ autoScrollCalendar: false }); document.querySelector("#planner-calendar").scrollTop = 0; }); await p.waitForTimeout(100);
    const target = p.locator('.calendar-slot[data-slot-time="03:00"]').first(), b = await target.boundingBox();
    await p.mouse.move(b.x + 25, b.y + 2); await p.mouse.wheel(0, -240); await p.waitForTimeout(450);
    const source = p.locator('button[data-drag-task="qa-drag"]').filter({ visible: true }).first(), s = await source.boundingBox(), d = await target.boundingBox();
    await p.mouse.move(s.x + s.width / 2, s.y + 15); await p.mouse.down(); await p.mouse.move(s.x + s.width / 2 + 15, s.y + 15, { steps: 5 });
    await p.mouse.move(d.x + d.width / 2, d.y + 2, { steps: 20 }); await p.mouse.move(d.x + d.width / 2 + 1, d.y + 2); await p.mouse.up(); await p.waitForTimeout(500);
    await p.reload(); await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
    const saved = await p.evaluate(() => store.listItems().find(t => t.id === "qa-drag"));
    if (saved.scheduledStart !== "2026-11-19T03:00" || saved.dueTime !== "18:00") throw Error("Drag/reload/deadline regression");
    results.push({ case: "real task drag after rebound, preserved deadline and reload", status: "PASS", scheduledStart: saved.scheduledStart });
  } finally { await c.close(); }
  const offline = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  try {
    const p = await offline.newPage(); await p.goto("http://127.0.0.1:8034/?qa=loop-final-cache#calendar");
    await p.evaluate(() => navigator.serviceWorker.register("./service-worker.js")); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForFunction(() => navigator.serviceWorker.controller);
    const evidence = await p.evaluate(async () => {
      const cache = await caches.open("duckplan-app-motion-preview-v91"), saved = await cache.match("./calendar-viewport.js"), current = await fetch("./calendar-viewport.js", { cache: "no-store" }), text = await current.text();
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return { equal: await saved.text() === text, sha256: [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, "0")).join(""), script: document.querySelector('script[src*="calendar-viewport.js"]').src, keys: await caches.keys() };
    }); if (!evidence.equal) throw Error("Stale cache");
    await offline.setOffline(true); await p.reload(); await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
    await p.evaluate(() => { calendarView = "day"; renderAll({ autoScrollCalendar: false }); document.querySelector("#planner-calendar").scrollTop = 0; }); await p.waitForTimeout(100);
    const xy = await p.evaluate(() => ({ x: document.querySelector(".time-axis").getBoundingClientRect().right + 35, y: document.querySelector(".timeline-days").getBoundingClientRect().bottom + 90 })), cd = await offline.newCDPSession(p);
    await cd.send("Input.dispatchMouseEvent", { type: "mouseWheel", ...xy, deltaX: 0, deltaY: -240 }); await p.waitForTimeout(40);
    const animation = await p.evaluate(() => {
      const a = document.querySelector(".timeline-calendar").getAnimations()[0];
      return a ? { duration: a.effect.getTiming().duration, startTime: a.startTime, easings: a.effect.getKeyframes().map(f => f.easing) } : null;
    });
    // CSSOM canonicalizes steps(1,end) to steps(1); these have the same behavior.
    if (!animation || !Number.isFinite(animation.startTime) || !animation.easings.every(e => ["steps(1)", "steps(1, end)", "steps(1,end)"].includes(e))) throw Error("Offline return mismatch");
    results.push({ case: "v91 cache equality and offline synchronized pixel-rounded return", status: "PASS", ...evidence, duration: animation.duration });
  } finally { await offline.close(); }
  return { runtime: browser.version(), results };
}
