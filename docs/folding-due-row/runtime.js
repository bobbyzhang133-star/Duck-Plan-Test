async page => {
  const browser = page.context().browser(), results = [], out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/folding-due-row/";
  const check = (value, message) => { if (!value) throw Error(message); };
  for (const viewport of [{ width: 1280, height: 950 }, { width: 835, height: 1100 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700, serviceWorkers: "block" });
    try {
      await c.addInitScript(() => {
        if (localStorage.getItem("duckplan-demo-tasks-v1")) return;
        localStorage.setItem("duckplan-demo-classes-v1", "[]");
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
          ...Array.from({ length: 5 }, (_, n) => ({ id: `date-${n}`, title: `Date-only assignment ${n + 1}`, dueDate: "2026-11-18", dueTime: "", priority: "Medium", schemaVersion: 2, completed: false })),
          { id: "other-date", title: "Next day reading", dueDate: "2026-11-19", dueTime: "", priority: "Medium", schemaVersion: 2, completed: false },
          { id: "timed", title: "Timed deadline and work", dueDate: "2026-11-18", dueTime: "17:00", scheduledStart: "2026-11-18T15:00", durationMinutes: 60, priority: "Medium", schemaVersion: 2, completed: false }
        ]));
      });
      const p = await c.newPage(), errors = []; p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8034/?qa=folding-due-row#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      const before = await p.evaluate(() => JSON.stringify(store.listItems()));
      for (const mode of ["day", "week"]) {
        await p.evaluate(mode => { document.documentElement.dataset.theme = mode === "week" ? "dark" : "light"; selectedDate = "2026-11-18"; calendarView = mode; deadlineRowExpanded = false; expandedDeadlineDates.clear(); renderAll({ autoScrollCalendar: false }); document.querySelector("#planner-calendar").scrollTop = 200; }, mode);
        await p.waitForTimeout(80);
        const toggle = p.locator(".deadline-row-toggle"), row = p.locator(".timeline-deadlines");
        check(await toggle.getAttribute("aria-expanded") === "false", "Due row did not start folded");
        check(await row.locator(".deadline-day-summary").first().innerText() === "5 due", "Date-only summary mixes in timed deadline");
        const compactHeight = (await row.boundingBox()).height;
        check(compactHeight <= 45.5, "Folded band consumes too much height");
        const scroll = await p.evaluate(() => ({ top: document.querySelector("#planner-calendar").scrollTop, left: document.querySelector("#planner-calendar").scrollLeft }));
        await toggle.focus(); await p.keyboard.press("Space");
        check(await toggle.getAttribute("aria-expanded") === "true", "Space did not expand Due");
        check(await p.evaluate(() => document.activeElement.matches(".deadline-row-toggle")), "Disclosure focus lost");
        const expandedScroll = await p.evaluate(() => ({ top: document.querySelector("#planner-calendar").scrollTop, left: document.querySelector("#planner-calendar").scrollLeft }));
        check(JSON.stringify(scroll) === JSON.stringify(expandedScroll), "Toggle changed scroll position");
        const cell = row.locator('[data-deadline-date="2026-11-18"]');
        check(await cell.locator(".deadline-chip").count() === 3, "Expanded row missing existing preview limit");
        const expandedHeight = (await row.boundingBox()).height;
        check(expandedHeight > compactHeight, "Expanded row did not unfold");
        await cell.locator(".deadline-overflow").click();
        check(await row.locator('[data-deadline-date="2026-11-18"] .deadline-chip').count() === 5, "More does not expose every deadline");
        const marker = await p.locator('.timeline-column[data-column-date="2026-11-18"] [data-deadline-minute="1020"]').evaluate(e => e.getBoundingClientRect().top - e.closest(".timeline-column").getBoundingClientRect().top);
        check(Math.abs(marker - 17 * 62) < 0.01, "Timed deadline moved into folded band or lost exact time");
        check(await row.locator('[data-select-task="timed"]').count() === 0, "Timed task entered date-only row");
        await toggle.focus(); await p.keyboard.press("Enter");
        check(await toggle.getAttribute("aria-expanded") === "false", "Enter did not fold Due");
        await row.locator(".deadline-day-summary").first().click();
        check(await toggle.getAttribute("aria-expanded") === "true", "Day count did not expand row");
        await row.locator('[data-select-task="date-0"]').click();
        await p.waitForFunction(() => document.querySelector("#calendar-task-preview")?.open);
        check(await p.locator("#calendar-preview-title").innerText() === "Date-only assignment 1", "Deadline preview is wrong");
        await p.getByRole("button", { name: "Close task preview", exact: true }).click();
        await p.waitForFunction(() => !document.querySelector("#calendar-task-preview"));
        await toggle.click();
        if (mode === "day" && [835, 390].includes(viewport.width)) {
          await p.screenshot({ path: out + `folded-${viewport.width}.png` });
          await toggle.click(); await p.screenshot({ path: out + `expanded-${viewport.width}.png` }); await toggle.click();
        }
        check(before === await p.evaluate(() => JSON.stringify(store.listItems())), "Folding edited task records");
        check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Page overflow");
        results.push({ viewport, mode, theme: mode === "week" ? "dark" : "light", status: "PASS", compactHeight, expandedHeight, scrollPreserved: true });
      }
      // Live changes update counts; the entire band disappears once no date-only deadlines remain.
      await p.evaluate(async () => { for (let n = 0; n < 5; n++) await store.toggleComplete(`date-${n}`, true); selectedDate = "2026-11-18"; calendarView = "day"; renderCalendar(); });
      check(await rowCount(p) === 0, "Empty date-only row did not disappear");
      await p.reload(); await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      check(await p.evaluate(() => store.listItems().filter(t => t.id.startsWith("date-") && t.completed).length) === 5, "Task completion lost on reload");
      check(!errors.length, errors.join("; "));
      results.push({ viewport, mode: "dynamic empty-band and persistence", status: "PASS", errors });
    } finally { await c.close(); }
  }
  async function rowCount(p) { return p.locator(".timeline-deadlines").count(); }
  return { runtime: browser.version(), mode: "isolated local browser; phone/iPad emulation, not native or authenticated production", results };
}
