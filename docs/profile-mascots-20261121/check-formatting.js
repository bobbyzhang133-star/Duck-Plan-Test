async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [
    { view: "calendar", width: 1156 }, { view: "calendar", width: 835 }, { view: "calendar", width: 390 },
    { view: "tasks", width: 1156 }, { view: "tasks", width: 390 }, { view: "tasks", width: 320 },
    { view: "home", width: 1156 }, { view: "matrix", width: 835 }, { view: "tasks", width: 390, dark: true }
  ]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 1000 }, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8042/#" + (config.view === "matrix" ? "tasks" : config.view));
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length);
      await p.evaluate(() => {
        const date = Model.todayKey();
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
          { id: "format-first", title: "Review a longer calculus assignment with careful notes and practice examples", dueDate: date, dueTime: "17:00", scheduledStart: date + "T18:00", durationMinutes: 45, priority: "High", actualMinutes: 20, completed: false, schemaVersion: 2 },
          { id: "format-next", title: "Prepare the next practice task", dueDate: date, completed: false, schemaVersion: 2 }
        ]));
      });
      await p.reload();
      if (config.dark) await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      if (config.view === "tasks") await p.locator('[data-filter="today"]').click();
      if (config.view === "matrix") {
        await p.locator('[data-task-layout="matrix"]').click();
        const group = p.locator(".matrix-unclassified");
        if (!(await group.evaluate(e => e.open))) await group.locator("summary").first().click();
      }
      if (config.view === "calendar" && config.width === 390) { await p.locator("#phone-task-summary").click(); await p.waitForTimeout(500); }
      const area = config.view === "calendar" ? "#daily-task-panel" : config.view === "home" ? "#view-home" : "#view-tasks";
      await p.locator(area + ' input[data-task-id="format-first"]:visible').click();
      const format = await p.evaluate(async () => {
        const echo = document.querySelector(".task-completion-echo"), source = document.querySelector(".completion-exit-source"), animation = echo.getAnimations()[0];
        animation.pause(); animation.currentTime = 0;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const text = card => {
          const origin = card.getBoundingClientRect(), walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT), result = [];
          let node;
          while ((node = walker.nextNode())) {
            if (!node.textContent.trim() || !node.parentElement.checkVisibility()) continue;
            const range = document.createRange(); range.selectNodeContents(node);
            result.push({ text: node.textContent, rects: [...range.getClientRects()].map(r => ({ x: r.x-origin.x, y: r.y-origin.y, w: r.width, h: r.height })) });
          }
          return result;
        };
        const original = text(source), copy = text(echo);
        if (original.length !== copy.length) throw Error("Text missing from completion snapshot");
        let maxDifference = 0; const differences = [];
        original.forEach((a, i) => {
          const b = copy[i];
          if (a.text !== b.text || a.rects.length !== b.rects.length) throw Error("Snapshot changed line wrapping: " + a.text);
          a.rects.forEach((rect, j) => Object.keys(rect).forEach(key => { const delta = Math.abs(rect[key]-b.rects[j][key]); maxDifference = Math.max(maxDifference, delta); if(delta>1)differences.push({text:a.text,key,source:rect[key],copy:b.rects[j][key]}); }));
        });
        const b = echo.getBoundingClientRect();
        const overflow = copy.flatMap(t=>t.rects).some(r => r.x < -1 || r.y < -1 || r.x+r.w > b.width+1 || r.y+r.h > b.height+1);
        return { maxDifference, differences, overflow, sourceHeight: source.getBoundingClientRect().height, height: b.height, textNodes: copy.length, duration: animation.effect.getTiming().duration, icons: echo.querySelectorAll(".task-date-icon").length };
      });
      if (format.maxDifference > 1 || format.overflow || format.icons || format.duration !== 430) throw Error("Snapshot layout differs: " + JSON.stringify(format));
      await p.screenshot({ path: `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/profile-mascots-20261121/clone-${config.view}-${config.width}${config.dark ? "-dark" : ""}.png` });
      await p.waitForTimeout(2200);
      if (errors.length) throw Error(errors.join("; "));
      results.push({ config, format });
    } catch (error) { return { runtime: browser.version(), results, failedConfig: config, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), results };
}
