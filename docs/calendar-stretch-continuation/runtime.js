async page => {
  const browser = page.context().browser(), results = [], out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-stretch-continuation/";
  const check = (value, message) => { if (!value) throw Error(message); };
  for (const viewport of [{ width: 1156, height: 826 }, { width: 835, height: 1100 }, { width: 390, height: 844 }]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8034/?qa=stretch-continuation#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      for (const mode of ["week", "day"]) for (const theme of ["light", "dark"]) {
        await p.evaluate(({ mode, theme }) => {
          document.documentElement.dataset.theme = theme; selectedDate = Model.todayKey(); calendarView = mode;
          renderAll({ autoScrollCalendar: false }); document.querySelector("#planner-calendar").scrollTop = 0;
        }, { mode, theme });
        await p.waitForTimeout(100);
        const before = await p.evaluate(() => ({ records: JSON.stringify(store.listItems()), header: document.querySelector(".timeline-days").getBoundingClientRect().top,
          heights: [...document.querySelectorAll(".timeline-column")].map(e => e.getBoundingClientRect().height) }));
        const xy = await p.evaluate(() => { const axis = document.querySelector(".time-axis").getBoundingClientRect(), header = document.querySelector(".timeline-days").getBoundingClientRect(); return { x: axis.right + 30, y: header.bottom + 70 }; });
        await p.mouse.move(xy.x, xy.y); await p.mouse.wheel(0, -200);
        await p.waitForTimeout(130);
        const state = await p.evaluate(() => {
          const grid = document.querySelector(".timeline-calendar");
          for (const animation of grid.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 0; }
          return { offset: new DOMMatrixReadOnly(getComputedStyle(grid).transform).m42,
            header: document.querySelector(".timeline-days").getBoundingClientRect().top,
            columns: [...document.querySelectorAll(".timeline-column")].map(e => { const style = getComputedStyle(e), extra = getComputedStyle(e, "::before"); return {
              height: e.getBoundingClientRect().height, background: style.backgroundColor, extensionBackground: extra.backgroundColor,
              border: style.borderLeftWidth, extensionBorder: extra.borderLeftWidth, borderColor: style.borderLeftColor, extensionBorderColor: extra.borderLeftColor,
              extensionHeight: parseFloat(extra.height), extensionTop: parseFloat(extra.top), pointer: extra.pointerEvents }; }),
            midnight: getComputedStyle(document.querySelector(".time-axis > span:first-child .time-axis-label")).visibility,
            overflow: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        check(state.offset === 48, "Did not sample maximum edge pull");
        check(state.header === before.header, "Header moved");
        check(state.columns.every((e, i) => e.extensionHeight >= 48 && e.extensionTop <= -48 && e.background === e.extensionBackground && e.border === e.extensionBorder && e.borderColor === e.extensionBorderColor && e.height === before.heights[i] && e.pointer === "none"), "Continuation material/geometry mismatch");
        check(state.midnight === "hidden" && !state.overflow, "Label or overflow regression");
        if (theme === "light" && mode === "week") await p.screenshot({ path: out + `pulled-${viewport.width}.png` });
        await p.evaluate(() => document.querySelector(".timeline-calendar").getAnimations({ subtree: true }).forEach(a => a.play()));
        await p.waitForFunction(() => !document.querySelector(".timeline-calendar").style.transform, null, { timeout: 2000 });
        check(before.records === await p.evaluate(() => JSON.stringify(store.listItems())), "Paint changed data");
        results.push({ viewport, mode, theme, status: "PASS", offset: state.offset, continuationHeight: state.columns[0].extensionHeight, headerFixed: true });
      }
      check(!errors.length, errors.join("; "));
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local Chromium, phone/iPad emulation rather than native/physical Safari", results };
}
