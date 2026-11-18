async page => {
  const browser = page.context().browser(), results = [];
  const check = (value, message) => { if (!value) throw Error(message); };
  for (const viewport of [{ width: 1280, height: 950 }, { width: 835, height: 1100 }, { width: 390, height: 844 }]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8034/?qa=bouncy-edge#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      await p.evaluate(() => { selectedDate = Model.todayKey(); calendarView = "day"; renderAll({ autoScrollCalendar: false }); });
      await p.waitForTimeout(120);
      const records = await p.evaluate(() => JSON.stringify(store.listItems()));
      for (const bottom of [false, true]) {
        await p.evaluate(bottom => { const root = document.querySelector("#planner-calendar"); root.scrollTop = bottom ? root.scrollHeight : 0; }, bottom);
        await p.waitForTimeout(70);
        const rest = await p.evaluate(() => {
          const root = document.querySelector("#planner-calendar"), h = root.querySelector(".timeline-days").getBoundingClientRect(), a = root.querySelector(".time-axis").getBoundingClientRect();
          return { x: a.right + 30, y: Math.max(h.bottom, root.getBoundingClientRect().top) + 70, header: h.top };
        });
        await p.mouse.move(rest.x, rest.y); await p.mouse.wheel(0, bottom ? 180 : -180);
        await p.waitForTimeout(130);
        const phases = await p.evaluate(() => {
          const grid = document.querySelector(".timeline-calendar"), moving = grid.getAnimations({ subtree: true }).filter(a => a.effect.target.matches(".timeline-calendar,.timeline-corner,.timeline-days,.timeline-deadline-label,.timeline-deadlines"));
          if (moving.length < 3) throw Error("No active coordinated spring");
          moving.forEach(a => a.pause());
          const phases = [0, 150, 210, 264, 350, 430].map(time => {
            moving.forEach(a => { a.currentTime = time; });
            return { time, offset: new DOMMatrixReadOnly(getComputedStyle(grid).transform).m42, header: document.querySelector(".timeline-days").getBoundingClientRect().top };
          });
          moving.forEach(a => a.play());
          return phases;
        });
        const rebound = bottom ? Math.max(...phases.map(p => p.offset)) : -Math.min(...phases.map(p => p.offset));
        check(rebound > 2 && rebound < 4, "Rendered return did not rebound past rest");
        check(phases.every(phase => Math.abs(phase.header - rest.header) < 0.01), "Header bounced with timetable");
        await p.waitForTimeout(160);
        check(await p.evaluate(() => !document.querySelector(".timeline-calendar").style.transform && !document.querySelector(".timeline-calendar").getAnimations().length), "Spring did not release its styles");
        results.push({ viewport, edge: bottom ? "bottom" : "top", status: "PASS", rebound, phases });
      }
      check(records === await p.evaluate(() => JSON.stringify(store.listItems())), "Bounce changed task data");
      check(!errors.length, errors.join("; "));
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "real Chromium animation sampling; local desktop and emulated phone/iPad, not physical Safari/native", results };
}
