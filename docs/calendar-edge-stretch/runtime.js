async page => {
  const browser = page.context().browser(), results = [];
  const check = (value, message) => { if (!value) throw Error(message); };
  const geometry = () => {
    const root = document.querySelector("#planner-calendar"), axis = root.querySelector(".time-axis"), body = root.querySelector(".timeline-columns");
    const header = root.querySelector(".timeline-days").getBoundingClientRect();
    const toolbar = document.querySelector(".calendar-toolbar").getBoundingClientRect();
    const bound = root.getBoundingClientRect();
    const y = Math.max(header.bottom, bound.top) + 70;
    return { headerTop: header.top, toolbarTop: toolbar.top, x: axis.getBoundingClientRect().right + 25, y,
      axisTop: axis.getBoundingClientRect().top, bodyTop: body.getBoundingClientRect().top,
      body: new DOMMatrixReadOnly(getComputedStyle(root.querySelector(".timeline-calendar")).transform).m42,
      scroll: root.scrollTop, max: root.scrollHeight - root.clientHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  };
  for (const viewport of [{ width: 1280, height: 950 }, { width: 835, height: 1100 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", error => errors.push(error.message));
      const wheelSession = await c.newCDPSession(p);
      const wheel = (x, y, deltaY) => wheelSession.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY });
      await p.goto("http://127.0.0.1:8034/?qa=edge-stretch#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      const before = await p.evaluate(() => JSON.stringify(store.listItems()));
      for (const mode of ["day", "week"]) {
        await p.evaluate(mode => {
          document.documentElement.dataset.theme = mode === "week" ? "dark" : "light";
          selectedDate = Model.todayKey(); calendarView = mode; renderAll({ autoScrollCalendar: false });
          document.querySelector("#planner-calendar").scrollTop = 0;
        }, mode);
        await p.waitForTimeout(120);
        const rest = await p.evaluate(geometry);
        await wheel(rest.x, rest.y, -150); await p.waitForTimeout(25);
        const top = await p.evaluate(geometry);
        check(top.body > 0 && top.body <= 48 && Math.abs(top.axisTop - rest.axisTop - top.body) < 0.01 && Math.abs(top.bodyTop - rest.bodyTop - top.body) < 0.01, "Top stretch missing or mismatched");
        check(top.headerTop === rest.headerTop && top.toolbarTop === rest.toolbarTop, "Header moved with stretch");
        await p.waitForFunction(() => !document.querySelector(".timeline-calendar").style.transform && !document.querySelector(".timeline-calendar").getAnimations().length, null, { timeout: 2000 });
        await wheel(rest.x, rest.y, 180); await p.waitForTimeout(110);
        check((await p.evaluate(geometry)).scroll > 0, "Normal wheel scroll blocked");
        await p.evaluate(() => { const root = document.querySelector("#planner-calendar"); root.scrollTop = root.scrollHeight; });
        await p.waitForTimeout(70);
        const bottomRest = await p.evaluate(geometry);
        await wheel(bottomRest.x, bottomRest.y, 150); await p.waitForTimeout(25);
        const bottom = await p.evaluate(geometry);
        check(bottom.body < 0 && bottom.body >= -48 && Math.abs(bottom.axisTop - bottomRest.axisTop - bottom.body) < 0.01 && Math.abs(bottom.bodyTop - bottomRest.bodyTop - bottom.body) < 0.01, "Bottom stretch missing or mismatched");
        check(bottom.headerTop === bottomRest.headerTop && bottom.toolbarTop === bottomRest.toolbarTop, "Bottom pull moved header");
        await p.waitForFunction(() => !document.querySelector(".timeline-calendar").style.transform && !document.querySelector(".timeline-calendar").getAnimations().length, null, { timeout: 2000 });
        check(!bottom.overflow, "Page overflow");
        check(before === await p.evaluate(() => JSON.stringify(store.listItems())), "Edge gesture edited tasks");
        results.push({ viewport, mode, theme: mode === "week" ? "dark" : "light", status: "PASS", topOffset: top.body, bottomOffset: bottom.body });
      }
      // Real Chromium touch input, rather than dispatched TouchEvent-only evidence.
      if (viewport.width === 390) {
        await p.evaluate(() => { document.querySelector("#planner-calendar").scrollTop = 0; }); await p.waitForTimeout(70);
        const rest = await p.evaluate(geometry), cd = await c.newCDPSession(p);
        await cd.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rest.x + 30, y: rest.y }] });
        for (const dy of [20, 45, 70]) {
          await cd.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: rest.x + 30, y: rest.y + dy }] });
          await p.waitForTimeout(20);
        }
        const touch = await p.evaluate(geometry);
        check(touch.body > 0 && touch.headerTop === rest.headerTop && Math.abs(touch.axisTop - rest.axisTop - touch.body) < 0.01, "Trusted touch failed");
        await cd.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cd.detach();
        await p.waitForFunction(() => !document.querySelector(".timeline-calendar").style.transform && !document.querySelector(".timeline-calendar").getAnimations().length, null, { timeout: 2000 });
        results.push({ viewport, mode: "trusted touch Week", status: "PASS", offset: touch.body });
      }
      await p.emulateMedia({ reducedMotion: "reduce" });
      await p.evaluate(() => { document.querySelector("#planner-calendar").scrollTop = 0; }); await p.waitForTimeout(70);
      const rest = await p.evaluate(geometry); await wheel(rest.x, rest.y, -150); await p.waitForTimeout(30);
      check((await p.evaluate(geometry)).body === 0, "Reduced motion still stretched");
      // A real blank slot still opens the correct editor after boundary interaction.
      const slot = p.locator('.calendar-slot[data-slot-time="01:00"]').first();
      await slot.click(); await p.waitForFunction(() => document.querySelector("#task-modal").open);
      check(await p.locator('[name="scheduledTime"]').inputValue() === "01:00", "Slot hit testing changed");
      await p.locator("#cancel-task").click();
      check(before === await p.evaluate(() => JSON.stringify(store.listItems())), "Editor cancellation changed tasks");
      await p.emulateMedia({ reducedMotion: "no-preference" });
      // Month has no timetable and therefore receives no artificial edge stretch.
      await p.evaluate(() => { calendarView = "month"; renderCalendar(); }); await p.waitForTimeout(70);
      check(await p.locator(".time-axis").count() === 0, "Month setup failed");
      check(!errors.length, errors.join("; "));
      results.push({ viewport, mode: "reduced motion, slot click/cancel, Month", status: "PASS", errors });
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local browser; phone/iPad viewport and trusted Chromium touch emulation, not physical Safari/native", results };
}
