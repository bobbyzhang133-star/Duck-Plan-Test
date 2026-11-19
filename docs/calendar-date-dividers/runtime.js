async page => {
  const browser = page.context().browser(), results = [];
  const check = (value, message) => { if (!value) throw Error(message); };
  for (const viewport of [{ width: 1156, height: 900 }, { width: 835, height: 1100 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", e => errors.push(e.message));
      await p.goto("http://127.0.0.1:8034/?qa=half-date-dividers#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      const records = await p.evaluate(() => JSON.stringify(store.listItems()));
      for (const theme of ["light", "dark"]) {
        await p.evaluate(theme => { document.documentElement.dataset.theme = theme; calendarView = "week"; renderAll({ autoScrollCalendar: false }); }, theme);
        await p.waitForTimeout(80);
        const state = await p.evaluate(() => {
          const root = document.querySelector("#phone-week-strip:not([hidden])") || document.querySelector(".timeline-days"), buttons = [...root.querySelectorAll("button")];
          return { first: getComputedStyle(buttons[0], "::before").content,
            dividers: buttons.slice(1).map(e => { const s = getComputedStyle(e, "::before"), b = e.getBoundingClientRect(); return { content: s.content, width: s.width, height: parseFloat(s.height), headerHeight: b.height, top: parseFloat(s.top), bottom: parseFloat(s.bottom), opacity: s.opacity, color: s.backgroundColor, pointer: s.pointerEvents }; }),
            overflow: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        check(state.first === "none", "Extra divider before the first date");
        check(state.dividers.length === 6 && state.dividers.every(d => d.content === '""' && d.width === "1px" && Math.abs(d.height / d.headerHeight - .5) < .04 && Math.abs(d.top - d.bottom) < .02 && d.opacity === "1" && d.pointer === "none"), "Missing or incorrect half-height dividers");
        check(!state.overflow, "Page overflows");
        const dates = p.locator(viewport.width < 700 ? "#phone-week-strip .phone-week-day" : ".timeline-days .calendar-date-button");
        await dates.nth(1).click();
        const selected = await dates.nth(1).getAttribute("aria-pressed");
        check(selected === "true", "Divider interfered with date selection");
        if (theme === "light" && [1156, 390].includes(viewport.width)) await p.screenshot({ path: `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-date-dividers/week-${viewport.width}.png` });
        await p.evaluate(() => { calendarView = "day"; renderAll({ autoScrollCalendar: false }); });
        const day = await p.locator(".timeline-days .calendar-date-button").evaluate(e => getComputedStyle(e, "::before").content);
        check(day === "none", "Week divider leaked into Day view");
        check(records === await p.evaluate(() => JSON.stringify(store.listItems())), "Header interaction changed records");
        results.push({ viewport, theme, status: "PASS", ...state });
      }
      check(!errors.length, errors.join("; "));
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local Chromium responsive/touch emulation; not physical Safari/native", results };
}
