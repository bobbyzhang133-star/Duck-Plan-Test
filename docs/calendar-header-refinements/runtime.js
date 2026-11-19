async page => {
  const browser = page.context().browser(), results = [], out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-header-refinements/";
  const check = (value, message) => { if (!value) throw Error(message); };
  for (const viewport of [{ width: 1156, height: 900 }, { width: 835, height: 1100 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700, serviceWorkers: "block" });
    try {
      await c.addInitScript(() => {
        localStorage.setItem("duckplan-demo-classes-v1", JSON.stringify([{ id: "qa-blue", name: "Blue class", color: "#538fc5" }]));
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
          { id: "date-blue", title: "Reading reflection", classId: "qa-blue", dueDate: "2026-11-18", dueTime: "", priority: "Medium", completed: false, schemaVersion: 2 },
          { id: "date-personal", title: "Prepare materials", classId: null, dueDate: "2026-11-18", dueTime: "", priority: "Medium", completed: false, schemaVersion: 2 },
          { id: "blue-work", title: "Class work", classId: "qa-blue", dueDate: "2026-11-18", dueTime: "17:00", scheduledStart: "2026-11-18T10:00", durationMinutes: 60, priority: "Medium", completed: false, schemaVersion: 2 },
          { id: "personal-work", title: "Personal work", classId: null, dueDate: "2026-11-18", dueTime: "18:00", scheduledStart: "2026-11-18T12:30", durationMinutes: 45, priority: "Medium", completed: false, schemaVersion: 2 }
        ]));
      });
      const p = await c.newPage(), errors = []; p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8034/?qa=calendar-header-refinements#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      const records = await p.evaluate(() => JSON.stringify(store.listItems()));
      for (const mode of ["day", "week"]) for (const theme of ["light", "dark"]) {
        await p.evaluate(({ mode, theme }) => {
          document.documentElement.dataset.theme = theme; selectedDate = "2026-11-18"; calendarView = mode; deadlineRowExpanded = false;
          renderAll({ autoScrollCalendar: false }); document.querySelector("#planner-calendar").scrollTop = 200;
        }, { mode, theme });
        await p.waitForTimeout(70);
        const state = await p.evaluate(() => {
          const cal = document.querySelector("#planner-calendar"), column = cal.querySelector(".timeline-column.selected-day"), axis = cal.querySelector(".time-axis"), due = cal.querySelector(".deadline-day-summary");
          const visibleHeadings = document.querySelector("#phone-week-strip:not([hidden])") || cal.querySelector(".timeline-days");
          const headings = [...visibleHeadings.querySelectorAll("button")];
          return { column: getComputedStyle(column).backgroundColor, axis: getComputedStyle(axis).backgroundColor,
            extension: getComputedStyle(column, "::before").backgroundColor,
            dueBorder: getComputedStyle(due).borderLeftColor, dueWidth: getComputedStyle(due).borderLeftWidth,
            dueFlag: getComputedStyle(due.querySelector("svg")).color,
            separators: headings.slice(1).map(e => { const s = getComputedStyle(e, "::before"); return { content: s.content, width: s.width, pointer: s.pointerEvents }; }),
            customWork: getComputedStyle(cal.querySelector('[data-calendar-drag-task="blue-work"]')).getPropertyValue("--course-color").trim(),
            personalFill: getComputedStyle(cal.querySelector('[data-calendar-drag-task="personal-work"]')).backgroundColor,
            hours: cal.querySelectorAll(".time-axis > span").length,
            overflow: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        check(state.dueWidth === "1px" && state.dueBorder === state.dueFlag, "Collapsed Due outline and flag mismatch");
        check(state.customWork === "#538fc5", "Class work color changed");
        check(state.column === state.extension && state.hours === 24 && !state.overflow, "Continuation/grid regression");
        if (mode === "day") {
          check(state.column === state.axis, "Day still has selection wash");
          if (theme === "light") check(state.column === "rgb(255, 255, 255)", "Light Day is not white");
        } else {
          check(state.column !== state.axis, "Week selected-day identity disappeared");
          check(state.separators.length === 6 && state.separators.every(s => s.content === '""' && s.width === "1px" && s.pointer === "none"), "Week heading divisions missing");
        }
        const toggle = p.locator(".deadline-row-toggle"); await toggle.focus(); await p.keyboard.press("Space");
        const cards = await p.locator(".timeline-deadlines .calendar-deadline-marker").evaluateAll(items => items.map(e => ({ border: getComputedStyle(e).borderLeftColor, flag: getComputedStyle(e.querySelector("svg")).color, width: getComputedStyle(e).borderLeftWidth })));
        check(cards.length === 2 && cards.every(e => e.border === state.dueBorder && e.flag === state.dueFlag && e.width === "1px"), "Expanded Due cards did not use deadline red");
        if (theme === "light" && ((mode === "week" && viewport.width === 1156) || (mode === "day" && viewport.width === 390))) await p.screenshot({ path: out + `${mode}-${viewport.width}.png` });
        await toggle.focus(); await p.keyboard.press("Enter");
        check(await toggle.getAttribute("aria-expanded") === "false", "Disclosure keyboard regression");
        check(records === await p.evaluate(() => JSON.stringify(store.listItems())), "Styling changed tasks");
        results.push({ viewport, mode, theme, status: "PASS", ...state });
      }
      check(!errors.length, errors.join("; "));
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local browser; phone/iPad emulation, not native or authenticated production", results };
}
