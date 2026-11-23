async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [
    { width: 1280, view: "calendar" },
    { width: 390, view: "tasks" },
    { width: 835, view: "calendar", dark: true }
  ]) {
    const context = await browser.newContext({ viewport: { width: config.width, height: 1100 }, serviceWorkers: "block" });
    try {
      const p = await context.newPage(), errors = [];
      p.on("pageerror", e => errors.push(e.message));
      await p.goto("http://127.0.0.1:8042/?demo=completion-20261123-2#"+config.view);
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length === 8);
      await p.waitForTimeout(700);
      if (config.dark) await p.evaluate(() => document.documentElement.dataset.theme = "dark");
      const scope = config.view === "calendar" ? "#daily-task-panel" : "#view-tasks";
      const inspect = () => p.locator(scope+" [data-task-tone]").evaluateAll(cards => cards.map(card => {
        const s = getComputedStyle(card), dot = getComputedStyle(card.querySelector(".course-dot"));
        const select = card.querySelector("[data-edit-task]");
        return { id: select.dataset.editTask, tone: card.dataset.taskTone, fill: s.backgroundColor, line: s.borderColor, text: getComputedStyle(card.querySelector(".task-title")).color, course: s.getPropertyValue("--course-color").trim(), dot: dot.backgroundColor };
      }));
      const initial = await inspect();
      if (new Set(initial.map(t => t.tone)).size !== 4) throw Error("Missing initial task statuses");
      const headersClear = await p.locator(scope+" .task-section-heading").evaluateAll(headers => headers.every(h => getComputedStyle(h).backgroundColor === "rgba(0, 0, 0, 0)"));
      if (!headersClear) throw Error("Category header tint remains");
      const colors = Object.fromEntries(initial.map(t => [t.tone,t.fill]));
      if (new Set(Object.values(colors)).size !== 4) throw Error("Status fills are not distinct");
      const grouped = {};
      if (config.view === "tasks") {
        for (const grouping of ["class", "priority", "plan"]) {
          await p.locator("#task-grouping").selectOption(grouping);
          await p.waitForTimeout(100);
          const rows = await inspect();
          if (rows.some(r => r.fill !== initial.find(t => t.id === r.id).fill)) throw Error("Grouping changed task colors");
          grouped[grouping] = "PASS";
        }
      }
      const edit = p.locator(scope+' [data-edit-task="completion-20261123-2-1"]').first();
      await edit.click();
      await p.waitForFunction(() => document.querySelector("#task-modal").open);
      await p.locator("#close-task-modal").click();
      await p.waitForFunction(() => !document.querySelector("#task-modal").open);
      const check = p.locator(scope+' .task-check[data-task-id="completion-20261123-2-4"]');
      await check.click();
      await p.waitForFunction(() => store.listItems().find(t=>t.id.endsWith("-4")).completed);
      await p.waitForTimeout(2100);
      if (config.view === "calendar") {
        await p.locator('[data-collapse="completed"]').click();
      } else {
        await p.locator('[data-filter="done"]').click();
      }
      await p.waitForTimeout(500);
      const completed = (await inspect()).find(t => t.id.endsWith("-4"));
      if (completed?.tone !== "completed" || Object.values(colors).includes(completed.fill)) throw Error("Completed color missing");
      if (config.view === "tasks") {
        await p.locator('[data-filter="all"]').click();
        await p.waitForTimeout(200);
      }
      const heading = p.locator(scope+" .task-section-heading").filter({ hasText: "Scheduled" }).first();
      await heading.click();
      const list = p.locator("#"+await heading.getAttribute("aria-controls"));
      await p.waitForTimeout(60);
      if (await list.getAttribute("data-ui-expansion") !== "closing") throw Error("Closing motion missing");
      await p.waitForTimeout(400);
      await heading.click();
      await p.waitForTimeout(60);
      if (await list.getAttribute("data-ui-expansion") !== "opening") throw Error("Opening motion missing");
      await p.waitForTimeout(400);
      await p.mouse.move(0,0);
      await p.screenshot({ path: "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/task-card-status-colors-20261123/"+config.width+"-"+config.view+(config.dark?"-dark":"")+".png" });
      if (errors.length) throw Error(errors.join("; "));
      await p.reload();
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().find(t=>t.id.endsWith("-4"))?.completed);
      results.push({ config, status: "PASS", initial, completed, headersClear, grouping: grouped, edit: "PASS", completionAndReload: "PASS", openingAndClosing: "PASS", errors });
    } finally { await context.close(); }
  }
  return { runtime: browser.version(), results };
}
