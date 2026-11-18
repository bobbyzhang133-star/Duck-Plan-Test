async page => {
  const browser = page.context().browser(), results = [], out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/midnight-grid-line/";
  const check = (value, message) => { if (!value) throw Error(message); };
  for (const viewport of [{ width: 1280, height: 950 }, { width: 390, height: 844 }]) {
    const c = await browser.newContext({ viewport, isMobile: viewport.width < 700, hasTouch: viewport.width < 700, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8034/?qa=midnight-line#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      const before = await p.evaluate(() => JSON.stringify(store.listItems()));
      for (const mode of ["day", "week"]) for (const theme of ["light", "dark"]) {
        await p.evaluate(({ mode, theme }) => {
          document.documentElement.dataset.theme = theme; selectedDate = Model.todayKey(); calendarView = mode;
          renderAll({ autoScrollCalendar: false }); document.querySelector("#planner-calendar").scrollTop = 0;
        }, { mode, theme });
        await p.waitForTimeout(70);
        const state = await p.evaluate(() => {
          const first = document.querySelector(".timeline-column"), zero = first.querySelector('[data-slot-time="00:00"]'), one = first.querySelector('[data-slot-time="01:00"]');
          return { image: getComputedStyle(first).backgroundImage, borderTop: getComputedStyle(first).borderTopWidth,
            zeroTop: zero.getBoundingClientRect().top - first.getBoundingClientRect().top,
            oneTop: one.getBoundingClientRect().top - first.getBoundingClientRect().top,
            midnightLabel: getComputedStyle(document.querySelector(".time-axis > span:first-child .time-axis-label")).visibility,
            hours: document.querySelectorAll(".time-axis > span").length,
            overflow: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        check(state.image.startsWith("linear-gradient("), "Midnight hour rule missing");
        check(state.midnightLabel === "hidden" && state.hours === 24, "Midnight label/grid semantics changed");
        check(state.zeroTop === 0 && state.oneTop === 62 && state.borderTop === "0px", "Painting shifted time coordinates");
        check(!state.overflow, "Page overflow");
        if (viewport.width === 1280 && mode === "day" && theme === "light") {
          const box = await p.locator(".timeline-column").first().boundingBox();
          const clip = { x: box.x - 72, y: box.y - 2, width: 300, height: 78 };
          await p.screenshot({ path: out + "after.png", clip });
          await p.evaluate(() => {
            const e = document.querySelector(".timeline-column"), text = getComputedStyle(e).backgroundImage;
            let depth = 0;
            for (let n = 0; n < text.length; n++) {
              if (text[n] === "(") depth++; else if (text[n] === ")") depth--;
              else if (text[n] === "," && depth === 0) { e.style.backgroundImage = text.slice(n + 1); break; }
            }
          });
          await p.screenshot({ path: out + "before.png", clip });
          await p.evaluate(() => document.querySelector(".timeline-column").style.removeProperty("background-image"));
        }
        check(before === await p.evaluate(() => JSON.stringify(store.listItems())), "Grid paint edited records");
        results.push({ viewport, mode, theme, status: "PASS", ...state });
      }
      await p.evaluate(() => { calendarView = "day"; renderCalendar(); document.querySelector("#planner-calendar").scrollTop = 0; });
      await p.locator('.calendar-slot[data-slot-time="00:00"]').first().click();
      await p.waitForFunction(() => document.querySelector("#task-modal").open);
      check(await p.locator('[name="scheduledTime"]').inputValue() === "00:00", "Midnight slot maps to another time");
      await p.locator("#cancel-task").click();
      check(!errors.length, errors.join("; "));
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local Chromium; phone viewport emulation, not physical Safari/native", results };
}
