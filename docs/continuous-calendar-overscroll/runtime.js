async page => {
  const browser = page.context().browser(), results = [];
  const check = (value, message) => { if (!value) throw Error(message); };
  const state = () => {
    const cal = document.querySelector("#planner-calendar"), grid = cal.querySelector(".timeline-calendar");
    return { top: cal.scrollTop, maximum: cal.scrollHeight - cal.clientHeight,
      offset: new DOMMatrixReadOnly(getComputedStyle(grid).transform).m42,
      headers: [...cal.querySelectorAll(".timeline-days,.timeline-deadlines")].map(e => e.getBoundingClientRect().top) };
  };
  for (const viewport of [{ width: 1156, height: 900 }, { width: 835, height: 1100 }, { width: 390, height: 844 }]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", error => errors.push(error.message));
      const wheelSession = await c.newCDPSession(p);
      const wheel = (x, y, deltaY) => wheelSession.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY });
      await p.goto("http://127.0.0.1:8034/?qa=continuous-overscroll#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      await p.evaluate(() => { calendarView = "day"; selectedDate = Model.todayKey(); renderAll({ autoScrollCalendar: false }); }); await p.waitForTimeout(100);
      const records = await p.evaluate(() => JSON.stringify(store.listItems()));
      for (const bottom of [false, true]) {
        await p.evaluate(bottom => { const cal = document.querySelector("#planner-calendar"); cal.scrollTop = bottom ? cal.scrollHeight - cal.clientHeight - 20 : 20; }, bottom); await p.waitForTimeout(60);
        const initial = await p.evaluate(state);
        const xy = await p.evaluate(() => { const cal = document.querySelector("#planner-calendar"), h = cal.querySelector(".timeline-days").getBoundingClientRect(), a = cal.querySelector(".time-axis").getBoundingClientRect(); return { x: a.right + 35, y: h.bottom + 100 }; });
        await wheel(xy.x, xy.y, bottom ? 100 : -100); await p.waitForTimeout(20);
        const crossed = await p.evaluate(state);
        check(bottom ? crossed.offset < 0 : crossed.offset > 0, "First movement crossing the limit did not stretch");
        check(Math.abs(crossed.offset) < 48 && JSON.stringify(crossed.headers) === JSON.stringify(initial.headers), "Boundary/header regression");
        if (!bottom) {
          const gapY = initial.headers[0] + 48 + 8; // Day header height on phone.
          const gap = await p.evaluate(({ x, fallback }) => {
            const cal = document.querySelector("#planner-calendar"), headers = [...cal.querySelectorAll(".timeline-days,.timeline-deadlines")].map(e => e.getBoundingClientRect().bottom);
            const y = Math.max(...headers) + 5, e = document.elementFromPoint(x, y);
            return { x, y: Number.isFinite(y) ? y : fallback, tag: e?.className };
          }, { x: xy.x, fallback: gapY });
          await wheel(gap.x, gap.y, -50); await p.waitForTimeout(20);
          const continued = await p.evaluate(state);
          check(continued.offset > crossed.offset && continued.offset < 48, "Pull stopped over its exposed edge");
          await wheel(xy.x, xy.y, 10); await p.waitForTimeout(20);
          const reversed = await p.evaluate(state);
          check(reversed.offset > 0 && reversed.offset < continued.offset && reversed.top === 0, "Reverse gesture snapped instead of unwinding");
          await wheel(xy.x, xy.y, 180); await p.waitForTimeout(30);
          const inside = await p.evaluate(state);
          check(inside.offset === 0 && inside.top > 0, "Reverse leftover did not rejoin ordinary scrolling");
          results.push({ viewport, case: "cross-top, continue through gap, unwind and rejoin", status: "PASS", crossed, continued, reversed, inside });
        } else {
          await p.waitForFunction(() => !document.querySelector(".timeline-calendar").style.transform, null, { timeout: 2000 });
          results.push({ viewport, case: "cross-bottom and rebound", status: "PASS", crossed });
        }
      }
      if (viewport.width === 390) {
        await p.evaluate(() => { document.querySelector("#planner-calendar").scrollTop = 35; }); await p.waitForTimeout(80);
        const xy = await p.evaluate(() => { const h = document.querySelector(".timeline-days").getBoundingClientRect(), a = document.querySelector(".time-axis").getBoundingClientRect(); return { x: a.right + 40, y: h.bottom + 90 }; });
        const cd = await c.newCDPSession(p);
        await cd.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [xy] });
        for (const dy of [15, 40, 80, 130, 170]) { await cd.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: xy.x, y: xy.y + dy }] }); await p.waitForTimeout(25); }
        const pulled = await p.evaluate(state);
        check(pulled.top === 0 && pulled.offset > 0, "A real native touch pan could not continue past the limit");
        await cd.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cd.detach();
        await p.waitForFunction(() => !document.querySelector(".timeline-calendar").style.transform, null, { timeout: 2000 });
        check(await p.locator("#task-modal[open]").count() === 0, "Touch stretch opened a task");
        results.push({ viewport, case: "trusted touch pan crosses top and releases", status: "PASS", pulled });
      }
      check(records === await p.evaluate(() => JSON.stringify(store.listItems())), "Gesture edited records");
      check(!errors.length, errors.join("; "));
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local Chromium, real wheel/CDP touch input; not physical Safari or exact Google OS-physics equivalence", results };
}
