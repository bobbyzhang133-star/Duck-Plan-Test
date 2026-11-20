async page => {
  const browser = page.context().browser(), results = [];
  const check = (value, message) => { if (!value) throw Error(message); };
  const geometry = () => {
    const cal = document.querySelector("#planner-calendar"), headers = [...cal.querySelectorAll(".timeline-days,.timeline-deadlines")].map(e => e.getBoundingClientRect());
    const axis = cal.querySelector(".time-axis").getBoundingClientRect(), bounds = cal.getBoundingClientRect();
    return { x: axis.right + 35, y: Math.min(bounds.bottom - 20, Math.max(...headers.map(h => h.bottom)) + 90), headers: headers.map(h => h.top) };
  };
  for (const viewport of [{ width: 1280, height: 950 }, { width: 835, height: 1100 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", e => errors.push(e.message));
      await p.goto("http://127.0.0.1:8034/?qa=native-rebound-regression#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      const records = await p.evaluate(() => JSON.stringify(store.listItems())), cd = await c.newCDPSession(p);
      for (const mode of ["day", "week"]) for (const bottom of [false, true]) {
        await p.evaluate(({ mode, bottom }) => {
          document.documentElement.dataset.theme = mode === "week" ? "dark" : "light";
          calendarView = mode; renderAll({ autoScrollCalendar: false });
          const cal = document.querySelector("#planner-calendar"); cal.scrollTop = bottom ? cal.scrollHeight : 0;
        }, { mode, bottom }); await p.waitForTimeout(80);
        const xy = await p.evaluate(geometry);
        await p.evaluate(() => {
          const cal = document.querySelector("#planner-calendar"), grid = cal.querySelector(".timeline-calendar");
          window.qaMotion = new Promise(resolve => cal.addEventListener("wheel", () => {
            const start = performance.now(), samples = [];
            const sample = () => { const time = performance.now() - start;
              samples.push({ time, offset: new DOMMatrixReadOnly(getComputedStyle(grid).transform).m42, headers: [...cal.querySelectorAll(".timeline-days,.timeline-deadlines")].map(e => e.getBoundingClientRect().top) });
              if (time < 650) requestAnimationFrame(sample); else resolve(samples);
            }; requestAnimationFrame(sample);
          }, { once: true, capture: true }));
        });
        await cd.send("Input.synthesizeScrollGesture", { x: xy.x, y: xy.y, yDistance: bottom ? -240 : 240, gestureSourceType: "mouse", preventFling: false, speed: 1800 });
        const samples = await p.evaluate(() => qaMotion), peak = Math.max(...samples.map(s => Math.abs(s.offset)));
        check(peak > 4 && peak < 14, "Wheel pull differs from reference-sized movement");
        check(samples.every(s => bottom ? s.offset <= .01 : s.offset >= -.01), "Added oscillation beyond rest");
        check(samples.every(s => s.headers.every((value, i) => Math.abs(value - xy.headers[i]) < .05)), "Header moved");
        check(await p.evaluate(() => !document.querySelector(".timeline-calendar").style.transform), "Return did not clean up");
        results.push({ viewport, mode, edge: bottom ? "bottom" : "top", status: "PASS", peak });
      }
      if (viewport.width === 390) {
        await p.evaluate(() => { document.querySelector("#planner-calendar").scrollTop = 0; }); await p.waitForTimeout(80);
        const xy = await p.evaluate(geometry);
        await cd.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: xy.x, y: xy.y }] });
        for (const dy of [20, 45, 70]) { await cd.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: xy.x, y: xy.y + dy }] }); await p.waitForTimeout(20); }
        await p.waitForTimeout(80);
        const held = await p.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".timeline-calendar")).transform).m42);
        check(held > 5 && held < 48, "Touch no longer holds a resistant pull");
        await cd.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await p.waitForFunction(() => !document.querySelector(".timeline-calendar").style.transform);
        results.push({ viewport, mode: "trusted touch hold and release", status: "PASS", held });
      }
      await p.emulateMedia({ reducedMotion: "reduce" });
      await p.evaluate(() => { document.querySelector("#planner-calendar").scrollTop = 0; }); await p.waitForTimeout(80);
      const xy = await p.evaluate(geometry); await cd.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: xy.x, y: xy.y, deltaX: 0, deltaY: -240 });
      check(await p.evaluate(() => !document.querySelector(".timeline-calendar").style.transform), "Reduced motion still stretches");
      await p.locator('.calendar-slot[data-slot-time="01:00"]').first().click();
      await p.waitForFunction(() => document.querySelector("#task-modal").open);
      check(await p.locator('[name="scheduledTime"]').inputValue() === "01:00", "Slot hit target changed");
      await p.locator("#cancel-task").click();
      await p.evaluate(() => { calendarView = "month"; renderAll({ autoScrollCalendar: false }); });
      check(await p.locator(".time-axis").count() === 0, "Month changed");
      check(records === await p.evaluate(() => JSON.stringify(store.listItems())), "Motion/editor cancellation edited tasks");
      check(!errors.length, errors.join("; "));
      results.push({ viewport, mode: "reduced motion, slot editor/cancel, Month, unchanged records", status: "PASS" });
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated Chromium macOS with real CDP gestures and responsive/touch emulation; not physical trackpad/native WKWebView", results };
}
