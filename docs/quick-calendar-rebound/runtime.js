async page => {
  const browser = page.context().browser(), results = [];
  const check = (value, message) => { if (!value) throw Error(message); };
  for (const viewport of [{ width: 1280, height: 950 }, { width: 835, height: 1100 }, { width: 390, height: 844 }]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", e => errors.push(e.message));
      await p.goto("http://127.0.0.1:8034/?qa=quick-rebound#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      await p.evaluate(() => { calendarView = "day"; renderAll({ autoScrollCalendar: false }); });
      await p.waitForTimeout(100);
      const before = await p.evaluate(() => JSON.stringify(store.listItems()));
      const cd = await c.newCDPSession(p);
      for (const bottom of [false, true]) {
        await p.evaluate(bottom => { const cal = document.querySelector("#planner-calendar"); cal.scrollTop = bottom ? cal.scrollHeight : 0; }, bottom);
        await p.waitForTimeout(60);
        const xy = await p.evaluate(() => {
          const cal = document.querySelector("#planner-calendar"), grid = cal.querySelector(".timeline-calendar"), header = cal.querySelector(".timeline-days"), a = cal.querySelector(".time-axis").getBoundingClientRect();
          const headerTop = header.getBoundingClientRect().top;
          window.qaTrace = new Promise(resolve => cal.addEventListener("wheel", () => {
            const start = performance.now(), samples = [];
            const sample = () => {
              const time = performance.now() - start;
              samples.push({ time, offset: new DOMMatrixReadOnly(getComputedStyle(grid).transform).m42,
                duration: grid.getAnimations()[0]?.effect.getTiming().duration || 0,
                clean: !grid.style.transform && !grid.getAnimations().length,
                header: header.getBoundingClientRect().top });
              if (time < 400) requestAnimationFrame(sample); else resolve({ headerTop, samples });
            }; requestAnimationFrame(sample);
          }, { capture: true, once: true }));
          return { x: a.right + 30, y: header.getBoundingClientRect().bottom + 90 };
        });
        await cd.send("Input.dispatchMouseEvent", { type: "mouseWheel", ...xy, deltaX: 0, deltaY: bottom ? 180 : -180 });
        const trace = await p.evaluate(() => qaTrace);
        const active = trace.samples.filter(s => s.duration), pulled = trace.samples.filter(s => Math.abs(s.offset) > 0.1);
        const settled = trace.samples.find(s => s.clean && s.time > (active.at(-1)?.time || 0));
        check(active.length && active.every(s => s.duration === 220), "Wrong live spring duration");
        check(pulled.length && settled && settled.time < 350, `Return took too long to clean up: ${JSON.stringify(trace.samples)}`);
        check(trace.samples.every(s => Math.abs(s.header - trace.headerTop) < 0.01), "Date header moved");
        results.push({ viewport, edge: bottom ? "bottom" : "top", status: "PASS", springStartsMs: active[0].time, settledMs: settled.time, trace });
      }
      check(before === await p.evaluate(() => JSON.stringify(store.listItems())), "Rebound changed tasks");
      check(!errors.length, errors.join("; "));
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local Chromium with real CDP wheel input; native/physical Safari not tested", results };
}
