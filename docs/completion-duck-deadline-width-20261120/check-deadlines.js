async (page) => {
  const browser = page.context().browser(), results = [];
  const root = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/completion-duck-deadline-width-20261120/";
  const assert = (value, message) => { if (!value) throw new Error(message); };
  for (const config of [{ width: 1156 }, { width: 835 }, { width: 390 }, { width: 320 }, { width: 390, dark: true }]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 900 } });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8034/#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length);
      await p.evaluate(() => {
        const date = Model.todayKey();
        const task = (id, dueTime, extra = {}) => ({ id, title: "Deadline check " + id, dueDate: date, dueTime, completed: false, schemaVersion: 2, ...extra });
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
          task("width-solo", "09:00"), task("width-overlap", "15:15", { scheduledStart: date + "T15:00", durationMinutes: 60 }),
          task("width-group-a", "12:00"), task("width-group-b", "12:05"),
          task("width-midnight", "00:00"), task("width-late", "23:59")
        ]));
      });
      await p.reload();
      await p.waitForFunction(() => store.listItems().some(task => task.id === "width-solo"));
      if (config.dark) await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      for (const mode of ["day", "week"]) {
        await p.locator('[data-calendar-view="' + mode + '"]').click();
        await p.waitForFunction(mode => document.querySelector('[data-calendar-view="' + mode + '"]').getAttribute("aria-pressed") === "true", mode);
        const measurements = await p.evaluate(() => [...document.querySelectorAll(".timed-deadline-anchor")].map(anchor => {
          const marker = anchor.querySelector(".timed-deadline-marker,.timed-deadline-group-trigger"), column = anchor.closest(".timeline-column");
          const m = marker.getBoundingClientRect(), c = column.getBoundingClientRect(), diamond = anchor.querySelector(".timed-deadline-diamond").getBoundingClientRect();
          return { overlap: anchor.classList.contains("has-work-overlap"), group: marker.classList.contains("timed-deadline-group-trigger"),
            columnWidth: c.width, markerWidth: m.width, leftInset: m.left - c.left, rightInset: c.right - m.right,
            backgroundLeft: getComputedStyle(marker, "::before").left, diamondDelta: diamond.left + diamond.width / 2 - m.left,
            diamondInsideColumn: diamond.left >= c.left - 1 && diamond.right <= c.right + 1,
            layer: Number(getComputedStyle(anchor).zIndex) };
        }));
        assert(measurements.length >= 5 && measurements.some(m => m.overlap) && measurements.some(m => m.group), "Include ordinary, overlap, grouped and day-boundary deadlines");
        for (const m of measurements) {
          assert(m.columnWidth - m.markerWidth <= 8 && m.leftInset <= 4 && m.rightInset <= 4, "Deadline fills usable day width");
          assert(m.backgroundLeft === "0px" && Math.abs(m.diamondDelta) <= 3 && m.diamondInsideColumn, "Diamond sits on the filled block's left edge inside the calendar");
          assert(m.layer === 5, "Deadline remains above work");
        }
        const before = await p.evaluate(() => JSON.stringify(store.listItems()));
        await p.locator('.timed-deadline-marker[data-edit-task="width-overlap"]').click();
        await p.locator("#calendar-task-preview[open]").waitFor();
        assert((await p.locator("#calendar-task-preview").innerText()).includes("Deadline check width-overlap"), "Overlapping marker opens the intended preview");
        await p.keyboard.press("Escape");
        await p.locator("#calendar-task-preview").waitFor({ state: "detached" });
        await p.locator(".timed-deadline-group-trigger").first().click();
        await p.locator("#calendar-task-preview[open]").waitFor();
        const groupText = await p.locator("#calendar-task-preview").innerText();
        assert(groupText.includes("width-group-a") && groupText.includes("width-group-b"), "Group retains both deadlines");
        await p.keyboard.press("Escape");
        await p.locator("#calendar-task-preview").waitFor({ state: "detached" });
        assert(await p.evaluate(before => JSON.stringify(store.listItems()) === before, before), "Viewing deadlines does not write task data");
        await p.locator('.timed-deadline-marker[data-edit-task="width-overlap"]').scrollIntoViewIfNeeded();
        await p.screenshot({ path: root + `deadlines-${config.width}-${mode}${config.dark ? "-dark" : ""}.png` });
        results.push({ config, mode, measurements, preview: true, group: true, unchanged: true });
      }
      assert(!errors.length, "No page errors");
    } catch (error) { return { runtime: browser.version(), results, failedConfig: config, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local", results };
}
